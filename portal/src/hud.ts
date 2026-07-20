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

    this.queries.hudPanel.subscribe("qualify", (entity) => {
      const document = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!document) return;
      this.hudDoc = document;
      this.wireHud();
    });

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
    // History is empty at wire time, so the replay inside setChatListener never
    // chimes for past messages — only live "bot" answers do.
    setChatListener((role) => {
      this.renderChatBubbles();
      if (role === "bot") this.playChime();
    });
    this.renderChatBubbles(); // initial render (placeholder or replayed history)
    // hud-mirror merges the live + transient channels before calling this, so we
    // just render. Hide the element when empty so it reserves no blank line. (The
    // span is seeded with a placeholder in hud.uikitml so UIKit builds it as a
    // Text — an empty span compiles to a Container and ignores text updates.)
    setTranscriptListener((text) => {
      this.transcriptText?.setProperties({ display: text ? "flex" : "none", text });
    });
    // Start hidden — nothing to show until a voice/chat status arrives.
    this.transcriptText?.setProperties({ display: "none", text: "" });
  }

  // Rebuild the bubble list from scratch. Runs only when a message arrives
  // (not per frame), and history is capped at 40, so rebuild-all is cheap
  // and far simpler than diffing.
  private renderChatBubbles() {
    const scroll = this.chatScroll;
    if (!scroll) return;
    for (const child of [...scroll.children]) {
      scroll.remove(child);
      (child as unknown as { dispose?: () => void }).dispose?.();
    }
    const history = getChatHistory();
    if (history.length === 0) {
      const placeholder = new UIKit.Text({
        text: "First Responder GPT - ask about EV emergency response.",
        fontSize: 2,
        color: "#94a3b8",
      });
      scroll.add(placeholder);
      return;
    }
    for (const m of history) {
      scroll.add(this.makeBubble(m.role, m.text));
    }
    // Layout is async; scroll to the newest message a frame later.
    setTimeout(() => {
      const max = scroll.maxScrollPosition.value;
      scroll.scrollPosition.value = [0, max[1] ?? 0];
    }, 50);
  }

  private makeBubble(role: "user" | "bot", text: string): UIKit.Container {
    const isUser = role === "user";
    const bubble = new UIKit.Container({
      flexDirection: "column",
      gap: 0.3,
      maxWidth: "85%",
      alignSelf: isUser ? "flex-end" : "flex-start",
      backgroundColor: isUser ? "#1e3a8a" : "#334155",
      borderRadius: 1.2,
      padding: 1,
      flexShrink: 0,
    });
    bubble.add(
      new UIKit.Text({
        text: isUser ? "You" : "First Responder GPT",
        fontSize: 1.5,
        color: isUser ? "#93c5fd" : "#94a3b8",
      }),
    );
    bubble.add(
      new UIKit.Text({
        text,
        fontSize: 2,
        color: "#e2e8f0",
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
      const max = this.chatScroll.maxScrollPosition.value[1] ?? 0;
      const y = Math.max(0, Math.min(max, (pos[1] ?? 0) + axes.y * delta * 40));
      this.chatScroll.scrollPosition.value = [pos[0] ?? 0, y];
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
