import {
  createSystem,
  eq,
  PanelDocument,
  PanelUI,
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

  init() {
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
      window.document.getElementById("btn-play")?.click(),
    );
    this.muteText?.addEventListener("click", () =>
      window.document.getElementById("btn-mute")?.click(),
    );
    this.vidButtons.forEach((btn, i) =>
      btn?.addEventListener("click", () => switchVideo(i)),
    );

    this.xrButton?.addEventListener("click", () => {
      if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
        this.world.launchXR();
      } else {
        this.world.exitXR();
      }
    });

    // Register listeners so chat/voice modules can push updates into the HUD
    setChatListener(() => {
      this.chatText?.setProperties({ text: getRenderedHistory() });
    });
    setTranscriptListener((text) => {
      this.transcriptText?.setProperties({ text });
    });
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
    const idx = getCurrentVideoIdx();
    this.vidButtons.forEach((btn, i) => {
      btn?.setProperties({
        backgroundColor: i === idx ? "#1e3a8a" : "#1e293b",
      });
    });
  }
}
