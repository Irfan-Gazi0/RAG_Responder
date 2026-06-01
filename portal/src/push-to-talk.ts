import { createSystem, Hovered, InputComponent } from "@iwsdk/core";
import {
  isCurrentlyRecording,
  isVoiceSupported,
  startRecognition,
  stopRecognition,
} from "./voice.js";

// Push-to-talk on the right hand's primary action.
//
// We key off the *select* action (getSelectStart/End) rather than the raw
// trigger: select maps to the controller trigger AND to a hand-tracking pinch,
// so the same code path gives controller-free pinch-to-talk for free. The
// trigger button is OR'd in as a belt-and-suspenders fallback; the recording
// guards below make a double-signal on controllers harmless.
//
// Skip starting voice if the laser is hovering an Interactable (UIKit button) —
// there the select should fire the button click, so we emit a short haptic
// confirmation instead.
export class PushToTalkSystem extends createSystem({
  hovered: { required: [Hovered] },
}) {
  update() {
    if (!isVoiceSupported()) return;
    const right = this.input.xr.gamepads.right;
    if (!right) return;

    const startPressed =
      right.getSelectStart() || right.getButtonDown(InputComponent.Trigger);
    const endPressed =
      right.getSelectEnd() || right.getButtonUp(InputComponent.Trigger);

    if (startPressed) {
      const hoveringUI = this.queries.hovered.entities.size > 0;
      if (hoveringUI) {
        this.pulse(0.4, 25); // tactile confirm for a button press
      } else if (!isCurrentlyRecording()) {
        startRecognition({ source: "vr" });
        this.pulse(0.6, 60); // confirm voice capture started
      }
    }
    if (endPressed && isCurrentlyRecording()) {
      stopRecognition();
      this.pulse(0.3, 40); // confirm voice capture stopped
    }
  }

  // Best-effort controller rumble via the raw WebXR gamepad. No-ops on devices
  // (or hands) without a haptic actuator.
  private pulse(intensity: number, durationMs: number) {
    const actuators = (
      this.input.xr.gamepads.right?.gamepad as Gamepad | undefined
    )?.hapticActuators;
    actuators?.[0]?.pulse?.(intensity, durationMs);
  }
}
