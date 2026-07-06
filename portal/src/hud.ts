import {
  AudioSource,
  AudioUtils,
  createSystem,
  type Entity,
  eq,
  PanelDocument,
  PanelUI,
  PlaybackMode,
  UIKit,
  UIKitDocument,
  VisibilityState,
} from "@iwsdk/core";
import { fmt, getActiveVideo, getCurrentVideoIdx, switchVideo } from "./videosphere.js";
import {
  getRenderedHistory,
  setChatListener,
  setTranscriptListener,
} from "./hud-mirror.js";
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
  private chatText: UIKit.Text | null = null;
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
    this.chatText = doc.getElementById("hud-chat-text") as UIKit.Text;
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
      this.chatText?.setProperties({ text: getRenderedHistory() });
      if (role === "bot") this.playChime();
    });
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
