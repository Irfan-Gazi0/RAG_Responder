import {
  AudioSource,
  AudioUtils,
  createSystem,
  type Entity,
  eq,
  InputComponent,
  PanelDocument,
  PanelUI,
  PlaybackMode,
  UIKit,
  UIKitDocument,
  VisibilityState,
} from "@iwsdk/core";
import { fmt, getActiveVideo, getCurrentVideoIdx, switchVideo } from "./videosphere.js";
import {
  getChatHistory,
  setChatListener,
  setTranscriptListener,
} from "./hud-mirror.js";
import { askQuickQuestion } from "./chat.js";
import { pttStopWasRecent } from "./push-to-talk.js";

const HUD_CONFIG_PATH = "./ui/hud.json";

export class HudSystem extends createSystem({
  hudPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", HUD_CONFIG_PATH)],
  },
}) {
  private hudDoc: UIKitDocument | null = null;
  private playText: UIKit.Text | null = null;
  private muteText: UIKit.Text | null = null;
  private timeText: UIKit.Text | null = null;
  private vidButtons: UIKit.Text[] = [];
  private chatScroll: UIKit.Container | null = null;
  private progressFill: UIKit.Container | null = null;
  private transcriptText: UIKit.Text | null = null;
  private xrButton: UIKit.Text | null = null;
  private elapsedSinceUpdate = 0;
  private lastActiveIdx = -1;
  private clickAudio: Entity | null = null;
  private chimeAudio: Entity | null = null;
  private loggedFirstBubble = false;

  // Bubbles we created, in display order. We track them ourselves instead of
  // walking scroll.children so removal can never touch anything UIKit owns.
  private bubbles: UIKit.Container[] = [];
  private placeholder: UIKit.Text | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  // Each bot answer is ~1800 plain-text chars ≈ 1800 live glyph instances. On a
  // Quest that budget is shared with the 4K360 video texture, so the HUD renders
  // only the most recent exchanges. Older turns stay in hud-mirror's history and
  // in the DOM chat panel — nothing is truncated, just not built as geometry.
  private static readonly MAX_BUBBLES = 6;

  init() {
    // Non-positional UI sounds: a click to confirm button presses and a chime
    // when an AI answer lands (the user may be looking away at the scene).
    // Separate entities because AudioSource is one-per-entity; preloaded so the
    // first play has no fetch latency.
    this.clickAudio = this.world
      .createTransformEntity()
      .addComponent(AudioSource, {
        src: "./audio/click.mp3",
        positional: false,
        volume: 0.5,
        playbackMode: PlaybackMode.Restart,
      });
    this.chimeAudio = this.world
      .createTransformEntity()
      .addComponent(AudioSource, {
        src: "./audio/chime.mp3",
        positional: false,
        volume: 0.6,
        playbackMode: PlaybackMode.Restart,
      });
    AudioUtils.preload(this.clickAudio);
    AudioUtils.preload(this.chimeAudio);

    // elics 'qualify' fires only on FUTURE transitions. The panel adds
    // PanelDocument asynchronously (after the hud.json fetch), so it *usually*
    // qualifies after this subscribe runs — but the ordering is timing-dependent
    // and can differ on device / behind CloudFront caching. If the panel already
    // qualified, the event was missed and wireHud never runs → dead buttons AND
    // a null chatListener (plan2.md H1, symptoms A + B). Subscribe for future
    // transitions AND catch up on any entity that already matches.
    this.queries.hudPanel.subscribe("qualify", (entity) => this.adopt(entity));
    for (const entity of this.queries.hudPanel.entities) this.adopt(entity);

    // DOM Enter VR button → launchXR
    const enterBtn = window.document.getElementById("btn-enter-vr");
    if (enterBtn) {
      enterBtn.addEventListener("click", () => {
        if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
          this.world.launchXR();
        } else {
          this.world.exitXR();
        }
      });
    }

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        const inXR = state !== VisibilityState.NonImmersive;
        for (const entity of this.queries.hudPanel.entities) {
          if (entity.object3D) entity.object3D.visible = inXR;
        }
        if (this.xrButton) {
          this.xrButton.setProperties({ text: inXR ? "Exit VR" : "Enter VR" });
        }
        if (enterBtn) {
          enterBtn.textContent = inXR ? "🚪 Exit VR" : "🥽 Enter VR";
        }
      }),
    );
  }

  // Wire a HUD panel entity exactly once. Guarded so the qualify subscription
  // and the init-time catch-up loop can't double-wire the same document.
  private adopt(entity: Entity) {
    const document = PanelDocument.data.document[entity.index] as UIKitDocument;
    if (!document || this.hudDoc === document) return;
    this.hudDoc = document;
    this.wireHud();
  }

  private wireHud() {
    const doc = this.hudDoc;
    if (!doc) return;

    this.playText = doc.getElementById("hud-play") as UIKit.Text;
    this.muteText = doc.getElementById("hud-mute") as UIKit.Text;
    this.timeText = doc.getElementById("hud-time") as UIKit.Text;
    this.vidButtons = [
      doc.getElementById("hud-vid1") as UIKit.Text,
      doc.getElementById("hud-vid2") as UIKit.Text,
      doc.getElementById("hud-vid3") as UIKit.Text,
    ];
    this.chatScroll = doc.getElementById("hud-chat-scroll") as UIKit.Container;
    this.progressFill = doc.getElementById("hud-progress-fill") as UIKit.Container;
    this.transcriptText = doc.getElementById("hud-transcript") as UIKit.Text;
    this.xrButton = doc.getElementById("xr-button") as UIKit.Text;

    // HUD buttons proxy to DOM controls (re-uses existing playback/lecture logic)
    this.playText?.addEventListener("click", () =>
      this.guardedClick(() => window.document.getElementById("btn-play")?.click()),
    );
    this.muteText?.addEventListener("click", () =>
      this.guardedClick(() => window.document.getElementById("btn-mute")?.click()),
    );
    this.vidButtons.forEach((btn, i) =>
      btn?.addEventListener("click", () => this.guardedClick(() => switchVideo(i))),
    );

    doc.getElementById("hud-back10")?.addEventListener("click", () =>
      this.guardedClick(() => this.seekBy(-10)),
    );
    doc.getElementById("hud-fwd10")?.addEventListener("click", () =>
      this.guardedClick(() => this.seekBy(10)),
    );

    // One-click common questions - no typing or voice needed with gloves on.
    const QUICK_QUESTIONS: [string, string][] = [
      ["hud-chip1", "How do I shut down the high-voltage system on an EV?"],
      ["hud-chip2", "How should I respond to an EV battery fire?"],
      ["hud-chip3", "Where are the safe cut points for extrication on an EV?"],
    ];
    for (const [id, q] of QUICK_QUESTIONS) {
      doc.getElementById(id)?.addEventListener("click", () =>
        this.guardedClick(() => askQuickQuestion(q)),
      );
    }

    this.xrButton?.addEventListener("click", () =>
      this.guardedClick(() => {
        if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
          this.world.launchXR();
        } else {
          this.world.exitXR();
        }
      }),
    );

    // Register listeners so chat/voice modules can push updates into the HUD.
    // The listener now handles LIVE messages only — renderInitial() below seeds
    // the list from existing history, so nothing replays through here and past
    // bot answers can't fire a burst of chimes.
    setChatListener((role, text) => {
      // Breadcrumb: proves the DOM->HUD chat bridge reached the HUD on device
      // (symptom B is "bubbles never render in VR"). Logged once to avoid spam.
      if (!this.loggedFirstBubble) {
        console.log("[hud] first chat bubble render, role =", role);
        this.loggedFirstBubble = true;
      }
      this.appendBubble(role, text);
      if (role === "bot") this.playChime();
    });
    this.renderInitial(); // placeholder, or the tail of any existing history
    // hud-mirror merges the live + transient channels before calling this, so we
    // just render. Hide the element when empty so it reserves no blank line. (The
    // span is seeded with a placeholder in hud.uikitml so UIKit builds it as a
    // Text — an empty span compiles to a Container and ignores text updates.)
    setTranscriptListener((text) => {
      this.transcriptText?.setProperties({ display: text ? "flex" : "none", text });
    });
    // Start hidden — nothing to show until a voice/chat status arrives.
    this.transcriptText?.setProperties({ display: "none", text: "" });

    // Breadcrumb: proves wireHud ran on device. If this line never appears in
    // the Quest console, buttons are dead (A) and no chat listener is attached
    // (B) — the single root cause in plan2.md's working hypothesis.
    console.log("[hud] wireHud complete - buttons + chat listener wired");
  }

  // Build the list once at wire time from whatever history already exists.
  // Steady-state updates go through appendBubble(), not through here — a full
  // rebuild per message is O(n^2) allocation churn and was a prime suspect for
  // the on-device crash.
  private renderInitial() {
    const scroll = this.chatScroll;
    if (!scroll) return;

    for (const bubble of this.bubbles) {
      scroll.remove(bubble);
      bubble.dispose();
    }
    this.bubbles.length = 0;

    const history = getChatHistory();
    const recent = history.slice(-HudSystem.MAX_BUBBLES);
    if (recent.length === 0) {
      this.showPlaceholder();
      return;
    }
    for (const m of recent) this.appendBubble(m.role, m.text);
  }

  // Add exactly one bubble and retire the oldest once over the cap.
  private appendBubble(role: "user" | "bot", text: string) {
    const scroll = this.chatScroll;
    if (!scroll) return;

    if (this.placeholder) {
      scroll.remove(this.placeholder);
      this.placeholder.dispose();
      this.placeholder = null;
    }

    const bubble = this.makeBubble(role, text);
    scroll.add(bubble);
    this.bubbles.push(bubble);

    while (this.bubbles.length > HudSystem.MAX_BUBBLES) {
      const oldest = this.bubbles.shift()!;
      scroll.remove(oldest);
      oldest.dispose();
    }

    this.scrollToBottomSoon();
  }

  private showPlaceholder() {
    const scroll = this.chatScroll;
    if (!scroll || this.placeholder) return;
    this.placeholder = new UIKit.Text({
      text: "First Responder GPT - ask about EV emergency response.",
      fontSize: 2,
      color: "#94a3b8",
      width: "100%",
    });
    scroll.add(this.placeholder);
  }

  // Layout is async, so scrolling to the newest message has to wait a beat. One
  // shared timer: a burst of messages re-arms it instead of queueing N timers.
  private scrollToBottomSoon() {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      const scroll = this.chatScroll;
      if (!scroll) return;
      const maxY = scroll.maxScrollPosition.value[1];
      if (!Number.isFinite(maxY)) return;
      scroll.scrollPosition.value = [0, maxY as number];
    }, 50);
  }

  private makeBubble(role: "user" | "bot", text: string): UIKit.Container {
    const isUser = role === "user";
    // `width` (definite), NOT `maxWidth`: with a shrink-to-fit container the
    // panel rect honours the cap but Yoga still measures the Text at its full
    // unwrapped width, so glyphs paint outside the bubble and past the scroll
    // viewport. A definite width gives the Text something to wrap against, and
    // overflow:hidden makes the clip non-negotiable.
    const bubble = new UIKit.Container({
      flexDirection: "column",
      gap: 0.3,
      width: "85%",
      alignSelf: isUser ? "flex-end" : "flex-start",
      backgroundColor: isUser ? "#1e3a8a" : "#334155",
      borderRadius: 1.2,
      padding: 1,
      flexShrink: 0,
      overflow: "hidden",
    });
    bubble.add(
      new UIKit.Text({
        text: isUser ? "You" : "First Responder GPT",
        fontSize: 1.5,
        color: isUser ? "#93c5fd" : "#94a3b8",
        width: "100%",
      }),
    );
    bubble.add(
      new UIKit.Text({
        text,
        fontSize: 2,
        color: "#e2e8f0",
        width: "100%",
        wordBreak: "break-word",
      }),
    );
    return bubble;
  }

  private seekBy(seconds: number) {
    const v = getActiveVideo();
    if (!v || !v.duration || isNaN(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  }

  // Suppress the phantom click UIKit dispatches when a push-to-talk release
  // happens with the laser over a HUD button. No playClick() on suppression so
  // there's no stray click sound either.
  private guardedClick(fn: () => void) {
    if (pttStopWasRecent()) return;
    this.playClick();
    fn();
  }

  private playClick() {
    if (this.clickAudio) AudioUtils.play(this.clickAudio);
  }

  private playChime() {
    if (this.chimeAudio) AudioUtils.play(this.chimeAudio);
  }

  update(delta: number) {
    if (!this.hudDoc) return;

    // Left-thumbstick scrolls the chat history (right hand is push-to-talk).
    const left = this.input.xr.gamepads.left;
    const axes = left?.getAxesValues(InputComponent.Thumbstick);
    if (this.chatScroll && axes && Math.abs(axes.y) > 0.2) {
      const pos = this.chatScroll.scrollPosition.value;
      const max = this.chatScroll.maxScrollPosition.value[1];
      const cur = pos[1];
      // Bail unless both are real numbers: NaN here writes NaN into the scroll
      // signal, which poisons the panel's transform and takes the renderer down.
      if (Number.isFinite(max) && Number.isFinite(cur)) {
        const y = Math.max(0, Math.min(max as number, (cur as number) + axes.y * delta * 40));
        this.chatScroll.scrollPosition.value = [pos[0] ?? 0, y];
      }
    }

    this.elapsedSinceUpdate += delta;
    if (this.elapsedSinceUpdate < 0.25) return;
    this.elapsedSinceUpdate = 0;

    const v = getActiveVideo();
    if (!v) return;
    this.playText?.setProperties({ text: v.paused ? "Play" : "Pause" });
    this.muteText?.setProperties({ text: v.muted ? "Unmute" : "Mute" });
    if (v.duration && !isNaN(v.duration)) {
      this.timeText?.setProperties({
        text: `${fmt(v.currentTime)} / ${fmt(v.duration)}`,
      });
      const pct = Math.round((v.currentTime / v.duration) * 100);
      this.progressFill?.setProperties({ width: `${pct}%` });
    }
    // Active-lecture highlight via the .hud-btn-active class (blue border+fill
    // from hud.uikitml). Only re-toggle on change, not every 0.25 s poll.
    const idx = getCurrentVideoIdx();
    if (idx !== this.lastActiveIdx) {
      this.lastActiveIdx = idx;
      this.vidButtons.forEach((btn, i) => {
        if (!btn) return;
        const active = i === idx;
        const has = btn.classList.contains("hud-btn-active");
        // Guard add/remove (UIKit's ClassList.remove warns on a missing class).
        if (active && !has) btn.classList.add("hud-btn-active");
        else if (!active && has) btn.classList.remove("hud-btn-active");
      });
    }
  }
}
