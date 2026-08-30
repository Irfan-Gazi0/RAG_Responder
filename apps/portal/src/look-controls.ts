import { createSystem, VisibilityState } from "@iwsdk/core";

// Desktop / touch drag-to-look for the 360° videosphere.
//
// IWSDK is XR-first and ships no browser look controls, so on a flat screen
// (desktop, or embedded in the Streamlit iframe) the camera is frozen facing
// -Z with no way to pan — even though the UI promises "Drag to rotate". This
// restores the v1 A-Frame `look-controls` feel: hold-and-drag on the canvas
// yaws/pitches the camera.
//
// We drive `world.camera` directly (not `world.player`): locomotion is off and
// the player rig stays at the sphere centre, so the camera's local rotation IS
// its world rotation. The Transform binding is zero-copy *through* the
// Object3D (see FollowSystem, which lerps `object3D.position` directly), so
// writing `camera.rotation` is the supported path — TransformSystem reads it
// back, it doesn't overwrite us.
//
// Gated to VisibilityState.NonImmersive so it never fights the headset pose:
// in XR the WebXR head tracking owns the camera and these writes are skipped.

const SENSITIVITY = 0.0026; // radians of rotation per pixel dragged
const MAX_PITCH = Math.PI / 2 - 0.05; // clamp just shy of straight up/down

export class DesktopLookSystem extends createSystem({}) {
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private activePointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private canvas: HTMLCanvasElement | null = null;

  init() {
    const canvas = this.world.renderer.domElement as HTMLCanvasElement;
    this.canvas = canvas;
    canvas.style.touchAction = "none"; // we own drag gestures; no page pan/zoom
    canvas.style.userSelect = "none";
    canvas.style.cursor = "grab";

    // YXZ keeps yaw (Y) and pitch (X) independent — no creeping roll.
    this.world.camera.rotation.order = "YXZ";

    const isFlat = () =>
      this.world.visibilityState.value === VisibilityState.NonImmersive;

    const onDown = (e: PointerEvent) => {
      if (!isFlat() || (e.button !== 0 && e.pointerType === "mouse")) return;
      this.dragging = true;
      this.activePointer = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onMove = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== this.activePointer) return;
      // Match v1's drag feel: drag right → look right, drag down → look down.
      this.yaw -= (e.clientX - this.lastX) * SENSITIVITY;
      this.pitch -= (e.clientY - this.lastY) * SENSITIVITY;
      if (this.pitch > MAX_PITCH) this.pitch = MAX_PITCH;
      else if (this.pitch < -MAX_PITCH) this.pitch = -MAX_PITCH;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      this.dragging = false;
      this.activePointer = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    this.cleanupFuncs.push(() => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    });

    // Swap the grab cursor out (and drop any in-flight drag) while in XR.
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (!this.canvas) return;
        const immersive = state !== VisibilityState.NonImmersive;
        this.canvas.style.cursor = immersive ? "default" : "grab";
        if (immersive) {
          this.dragging = false;
          this.activePointer = null;
        }
      }),
    );
  }

  update() {
    // In XR the headset owns the camera pose — leave it alone.
    if (this.world.visibilityState.value !== VisibilityState.NonImmersive) return;
    this.world.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
