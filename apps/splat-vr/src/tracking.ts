/**
 * WebXR tracking diagnostics.
 *
 * Why this exists
 * ---------------
 * The viewer was reported as feeling like a 360 video in the headset: you can
 * look around, but walking and leaning do nothing. That is the signature of a
 * 3DoF (orientation-only) session.
 *
 * The obvious suspect - locomotion code writing `camera.position` and cancelling
 * the head pose - is not what is happening here. The camera has always lived
 * inside `playerRig`, every locomotion path writes the rig, and the desktop
 * controls only run in the non-presenting branch of the render loop. So the
 * cause is upstream of this app, and the useful thing to build is not another
 * refactor but a readout that names which cause it is, without taking the
 * headset off.
 *
 * The four candidates, in rough order of likelihood:
 *
 *   1. `xr-spatial-tracking` is not permitted. An embedding page (an iframe
 *      without that allow-list entry) gets poses with the translation stripped.
 *      This project has already lost days to exactly this: Streamlit's
 *      `components.iframe()` withholds the feature, which is why splat-vr is
 *      linked rather than embedded. Opening it inside any frame brings it back.
 *   2. The session did not actually get `local-floor`. `enabledFeatures` says so
 *      outright.
 *   3. The runtime is delivering poses but has dropped to orientation-only, or
 *      is failing to produce a viewer pose at all (tracking loss, guardian off,
 *      a dark room). The null-pose counter catches this.
 *   4. Something moves the rig against the head. Showing both together separates
 *      "the head is not moving" from "the head moves and is being cancelled".
 *
 * `headTravel` is the decisive number. It is the size of the axis-aligned box
 * the head pose has swept out since the session started, in rig-local metres.
 * Take three steps and it should read tens of centimetres. If it stays at
 * millimetres, no line of code in this repo is responsible.
 */
import type { PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { Box3, Vector3 as V3 } from "three";

export type TrackingReport = {
  /** Is the page allowed positional tracking at all? Null when unknowable. */
  spatialTrackingAllowed: boolean | null;
  /** True if we are inside a frame - the usual reason the answer above is no. */
  framed: boolean;
  /** Features the runtime actually granted, as opposed to the ones requested. */
  enabledFeatures: string[];
  /** Whether three currently holds a reference space. */
  hasReferenceSpace: boolean;
  /** Head pose in rig-local metres - what three decomposes from the view matrix. */
  head: [number, number, number];
  /** Rig position, so rig motion can be told apart from head motion. */
  rig: [number, number, number];
  /** Extent of the box the head has swept since entry, metres. */
  headTravel: [number, number, number];
  /** Largest single dimension of that box - the one number worth reading. */
  maxTravel: number;
  /** Frames presented since entry, and how many produced no viewer pose. */
  frames: number;
  poseFailures: number;
  /** Plain-language verdict, or null while there is nothing to say. */
  verdict: string | null;
};

/** Below this much head travel, after enough frames, we call it 3DoF. */
const TRAVEL_EPS = 0.03;
/** Give the user this many presented frames to move before judging. */
const JUDGE_AFTER = 600;

export class Tracking {
  private box = new Box3();
  private scratch = new V3();
  private frames = 0;
  private poseFailures = 0;
  private started = false;

  constructor(
    private renderer: WebGLRenderer,
    private camera: PerspectiveCamera,
    private rig: { position: Vector3 },
  ) {}

  /**
   * Permissions-policy check. Runs before any session exists, so the warning can
   * be raised the moment the page loads rather than after someone has put a
   * headset on and found the world nailed to their face.
   *
   * `featurePolicy` is non-standard and absent on some browsers; a missing API
   * is reported as "unknown", never as "denied" - a false alarm here would send
   * the next person chasing an iframe that is not there.
   */
  static spatialTrackingAllowed(): boolean | null {
    const fp = (
      document as Document & {
        featurePolicy?: { allowsFeature(f: string): boolean };
      }
    ).featurePolicy;
    if (!fp?.allowsFeature) return null;
    try {
      return fp.allowsFeature("xr-spatial-tracking");
    } catch {
      return null;
    }
  }

  static framed(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      // A cross-origin parent throws on access, which is itself proof of framing.
      return true;
    }
  }

  /**
   * The warning to show before entering VR, or null if nothing looks wrong.
   * Deliberately says what to do, not just what is broken.
   */
  static preflightWarning(): string | null {
    const allowed = Tracking.spatialTrackingAllowed();
    if (allowed === false) {
      return "No xr-spatial-tracking permission - VR will be orientation-only. Open this page directly, not inside a frame.";
    }
    // Only when the permission is not affirmatively granted. A framed page that
    // HAS xr-spatial-tracking tracks perfectly well, and warning about it anyway
    // is exactly the false alarm this file's docstring says would send the next
    // person chasing an iframe that is not the problem.
    if (Tracking.framed() && allowed !== true) {
      return "This page is inside a frame, which usually blocks positional tracking. Open the splat-vr URL directly.";
    }
    return null;
  }

  /** Reset the accumulators. Called on every session entry. */
  begin() {
    this.box.makeEmpty();
    this.frames = 0;
    this.poseFailures = 0;
    this.started = true;
  }

  end() {
    this.started = false;
  }

  /**
   * Sample the head pose. Must run while presenting and AFTER three has written
   * the frame's head pose into the camera, i.e. from inside the animation loop.
   */
  update() {
    if (!this.started || !this.renderer.xr.isPresenting) return;
    this.frames++;
    const frame = this.renderer.xr.getFrame();
    const space = this.renderer.xr.getReferenceSpace();
    // A frame that yields no viewer pose is tracking loss, and it is invisible
    // from the camera alone - three simply leaves the last pose in place.
    if (frame && space && !frame.getViewerPose(space)) this.poseFailures++;
    this.box.expandByPoint(this.scratch.copy(this.camera.position));
  }

  report(): TrackingReport {
    const size = this.box.isEmpty() ? new V3() : this.box.getSize(new V3());
    const maxTravel = Math.max(size.x, size.y, size.z);
    const session = this.renderer.xr.getSession();
    const enabledFeatures = [
      ...(((session as XRSession & { enabledFeatures?: string[] })?.enabledFeatures) ?? []),
    ];

    return {
      spatialTrackingAllowed: Tracking.spatialTrackingAllowed(),
      framed: Tracking.framed(),
      enabledFeatures,
      hasReferenceSpace: !!this.renderer.xr.getReferenceSpace(),
      head: this.camera.position.toArray() as [number, number, number],
      rig: this.rig.position.toArray() as [number, number, number],
      headTravel: size.toArray() as [number, number, number],
      maxTravel,
      frames: this.frames,
      poseFailures: this.poseFailures,
      verdict: this.verdict(maxTravel, enabledFeatures),
    };
  }

  /**
   * Turn the readings into the one sentence worth reading in a headset. Ordered
   * so the most actionable cause wins: a permissions problem explains everything
   * else, so it is reported instead of the symptom it causes.
   */
  private verdict(maxTravel: number, enabledFeatures: string[]): string | null {
    if (Tracking.spatialTrackingAllowed() === false) {
      return "3DoF: xr-spatial-tracking is blocked for this page. Open it directly, outside any frame.";
    }
    if (!this.started || this.frames < JUDGE_AFTER) return null;
    if (this.poseFailures > this.frames * 0.25) {
      return "Tracking is dropping out - the runtime is not returning a viewer pose. Check lighting and the guardian boundary.";
    }
    if (maxTravel < TRAVEL_EPS) {
      const floor =
        enabledFeatures.length && !enabledFeatures.includes("local-floor")
          ? " local-floor was NOT granted."
          : "";
      return `3DoF: the head pose is not translating (${(maxTravel * 100).toFixed(1)} cm over ${this.frames} frames).${floor}`;
    }
    return null;
  }
}
