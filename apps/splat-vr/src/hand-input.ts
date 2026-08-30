/**
 * Hand tracking as a real input path.
 *
 * What was actually wrong
 * ----------------------
 * `enableHands: true` bought exactly one thing: SparkXr pushes "hand-tracking"
 * into the session's optionalFeatures. Nothing else. Spark's own joint poller,
 * `updateHands()`, is never called from anywhere, so its joint dictionaries stay
 * empty forever; and every input path in vr-input.ts bails the moment
 * `inputSource.hand` is truthy, because all of them read a Gamepad and a tracked
 * hand does not have one. Put the controllers down and you could not move, turn,
 * or open the panel.
 *
 * The fix does not need Spark at all - three already does the work:
 *
 *   - `renderer.xr.getController(i)` returns a posed target ray for a hand input
 *     source exactly as it does for a controller (the Quest supplies the pinch
 *     aim ray), so pointing needs no branching.
 *   - WebXRManager forwards session-level `selectstart` / `selectend` to that
 *     same object with no hand/controller discrimination, and the Quest fires
 *     them on a pinch. So the existing trigger handling IS pinch handling.
 *
 * That is why the primary activation stays `selectstart`, not three's own
 * `pinchstart`: the latter is a bare 20 mm fingertip-distance test with no aim
 * gating and no palm rejection, and it fires whenever your fingers happen to
 * touch. The system classifier is better than anything measured here.
 *
 * This module therefore owns only the three things three does NOT give us:
 * calling `getHand(i)` at all (without it three never populates joints and never
 * emits pinch events), drawing something where the hands are, and the palm-up
 * gesture that stands in for the B/Y panel button.
 */
import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Handedness } from "./vr-input";

/** WebXR names the 25 hand joints; three keys `hand.joints` by these strings. */
const JOINTS = [
  "wrist",
  "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip",
  "index-finger-metacarpal", "index-finger-phalanx-proximal",
  "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip",
  "middle-finger-metacarpal", "middle-finger-phalanx-proximal",
  "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip",
  "ring-finger-metacarpal", "ring-finger-phalanx-proximal",
  "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip",
  "pinky-finger-metacarpal", "pinky-finger-phalanx-proximal",
  "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip",
] as const;

/**
 * Palm-up gesture thresholds.
 *
 * `PALM_DOT_ON` is cos(~30 deg): the palm has to be pointed fairly squarely at
 * your face, not merely in the general direction, or the gesture fires every
 * time you gesture while talking. The release threshold is deliberately much
 * looser so a steady hold does not chatter.
 */
const PALM_DOT_ON = 0.86;
const PALM_DOT_OFF = 0.6;
/** Seconds the palm must be held facing you before it counts. */
const PALM_HOLD = 0.35;
/** Ignore the gesture unless the hand is within arm's reach of the head. */
const PALM_MAX_DISTANCE = 0.75;

/**
 * Which way the palm faces along the wrist joint's own axes.
 *
 * WebXR gives every hand joint an orientation, and the palm direction is a fixed
 * axis of it for BOTH hands - which is why this is one constant rather than a
 * chirality test on the knuckle positions. The axis sign is the one thing here
 * that cannot be settled without a headset, so it is URL-overridable
 * (?palmsign=1) exactly like fbscale and foveation: flip it on device, see which
 * way round the gesture works, then fix the constant.
 */
const DEFAULT_PALM_SIGN = -1;

type HandSpace = ReturnType<WebGLRenderer["xr"]["getHand"]>;
type TrackedJoint = Object3D & { jointRadius?: number };

export type HandEvent = "togglePanel";

export class HandInput {
  /** The hand spaces. Fetching these is what makes three track joints at all. */
  readonly hands: HandSpace[] = [];

  private renderer: WebGLRenderer;
  private meshes: InstancedMesh[] = [];
  private handedness: (Handedness | null)[] = [null, null];
  private palmHeld = [0, 0];
  private palmArmed = [true, true];
  private listeners: ((e: HandEvent) => void)[] = [];
  private palmSign: number;
  private enabled = true;

  private _m = new Matrix4();
  private _v = new Vector3();
  private _q = new Quaternion();
  private _head = new Vector3();

  constructor(opts: { renderer: WebGLRenderer; playerRig: Group; palmSign?: number }) {
    this.renderer = opts.renderer;
    this.palmSign = opts.palmSign ?? DEFAULT_PALM_SIGN;

    // A single instanced sphere per hand rather than three's XRHandModelFactory.
    // The factory's primitive profile builds its mesh with a MeshStandardMaterial
    // and this scene has no lights whatsoever, so those spheres render pure
    // black; the mesh profile would need a GLTF downloaded from a CDN. Twenty-five
    // unlit spheres is less code than working around either.
    const geo = new SphereGeometry(1, 8, 6);
    for (let i = 0; i < 2; i++) {
      const hand = this.renderer.xr.getHand(i);
      const mesh = new InstancedMesh(
        geo,
        new MeshBasicMaterial({ color: 0x9fd8f5, transparent: true, opacity: 0.85 }),
        JOINTS.length,
      );
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.count = 0;
      hand.add(mesh);
      opts.playerRig.add(hand);
      this.hands.push(hand);
      this.meshes.push(mesh);

      const slot = i;
      hand.addEventListener("connected", (event) => {
        const h = (event as unknown as { data?: XRInputSource }).data?.handedness;
        this.handedness[slot] = h === "left" || h === "right" ? h : null;
      });
      hand.addEventListener("disconnected", () => {
        this.handedness[slot] = null;
        mesh.visible = false;
        mesh.count = 0;
      });
    }
  }

  onEvent(cb: (e: HandEvent) => void) {
    this.listeners.push(cb);
  }

  private emit(e: HandEvent) {
    for (const cb of this.listeners) cb(e);
  }

  setVisible(v: boolean) {
    this.enabled = v;
    if (!v) for (const m of this.meshes) m.visible = false;
  }

  private jointsOf(index: number): Record<string, TrackedJoint> | null {
    const hand = this.hands[index] as unknown as {
      joints?: Record<string, TrackedJoint>;
    };
    const joints = hand.joints;
    if (!joints) return null;
    const wrist = joints["wrist"];
    // `visible` is three's tracking-confidence flag: it goes false whenever
    // getJointPose returns null, and the stale position stays behind it.
    return wrist?.visible ? joints : null;
  }

  update(dt: number, camera: PerspectiveCamera) {
    if (!this.enabled) return;
    camera.getWorldPosition(this._head);

    for (let i = 0; i < this.hands.length; i++) {
      const joints = this.jointsOf(i);
      const mesh = this.meshes[i];
      if (!joints) {
        mesh.visible = false;
        mesh.count = 0;
        this.palmHeld[i] = 0;
        continue;
      }
      this.drawJoints(joints, mesh);
      this.updatePalm(i, joints, dt);
    }
  }

  /**
   * One instance per joint, scaled to the runtime's own reported joint radius so
   * the hand looks like the hand rather than a uniform string of beads.
   */
  private drawJoints(joints: Record<string, TrackedJoint>, mesh: InstancedMesh) {
    let n = 0;
    for (const name of JOINTS) {
      const joint = joints[name];
      if (!joint?.visible) continue;
      const r = joint.jointRadius ?? 0.008;
      // The mesh is a child of the hand space, so joint poses - which three
      // writes in that same space - go in without any conversion.
      this._m.compose(joint.position, joint.quaternion, this._v.setScalar(r));
      mesh.setMatrixAt(n++, this._m);
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Palm-up-toward-the-face opens the controls panel - the stand-in for B/Y,
   * which a tracked hand obviously does not have. It is the gesture the Quest
   * shell itself uses for its menu, so it is the one a user is most likely to
   * try unprompted.
   *
   * The mini panel is also one big press target, so this gesture is a
   * convenience rather than the only way back in: a hand user is never locked
   * out of the controls even if the sign below turns out to be inverted.
   */
  private updatePalm(index: number, joints: Record<string, TrackedJoint>, dt: number) {
    const wrist = joints["wrist"];
    if (!wrist) return;

    wrist.getWorldPosition(this._v);
    const toHead = this._head.clone().sub(this._v);
    const distance = toHead.length();
    if (distance > PALM_MAX_DISTANCE || distance < 1e-4) {
      this.palmHeld[index] = 0;
      return;
    }
    toHead.divideScalar(distance);

    wrist.getWorldQuaternion(this._q);
    const palm = new Vector3(0, 0, this.palmSign).applyQuaternion(this._q).normalize();
    const facing = palm.dot(toHead);

    if (facing < PALM_DOT_OFF) {
      // Turned away - re-arm so the next deliberate turn-up fires again.
      this.palmHeld[index] = 0;
      this.palmArmed[index] = true;
      return;
    }
    if (facing < PALM_DOT_ON || !this.palmArmed[index]) return;

    this.palmHeld[index] += dt;
    if (this.palmHeld[index] >= PALM_HOLD) {
      this.palmHeld[index] = 0;
      this.palmArmed[index] = false;
      this.emit("togglePanel");
    }
  }
}
