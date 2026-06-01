import { createSystem, Hovered, InputComponent } from "@iwsdk/core";
import {
  isCurrentlyRecording,
  isVoiceSupported,
  startRecognition,
  stopRecognition,
} from "./voice.js";

// Push-to-talk on the right controller's trigger.
// Skip if the laser is currently hovering an Interactable (UIKit button) — the
// trigger should fire the click instead of starting voice.
export class PushToTalkSystem extends createSystem({
  hovered: { required: [Hovered] },
}) {
  update() {
    if (!isVoiceSupported()) return;
    const right = this.input.xr.gamepads.right;
    if (!right) return;

    if (right.getButtonDown(InputComponent.Trigger)) {
      const hoveringUI = this.queries.hovered.entities.size > 0;
      if (!hoveringUI && !isCurrentlyRecording()) {
        startRecognition({ source: "vr" });
      }
    }
    if (right.getButtonUp(InputComponent.Trigger)) {
      if (isCurrentlyRecording()) stopRecognition();
    }
  }
}
