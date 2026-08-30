/**
 * Teleport locomotion - the comfort escape hatch for stick walking.
 *
 * Smooth stick locomotion is the single biggest sim-sickness trigger in VR:
 * the world moves while the inner ear insists you are standing still. Snap turn
 * and the vignette blunt it, but for a proportion of users nothing short of not
 * moving the view at all works - which is what teleport is. The view never
 * translates; it cuts. Meta's own comfort guidance ranks it the most comfortable
 * locomotion scheme there is, and for a training tool that has to work for
 * whoever picks up the headset that matters more than immersion.
 *
 * Gesture (bound in vr-input.ts): push the move stick forward to raise the arc,
 * steer with the wrist, push further to throw further, release to commit, or
 * yank the stick back to cancel.
 *
 * Two details that are easy to get wrong:
 *
 *   - The arc has to be a real ballistic curve, not a straight ray. A straight
 *     ray aimed at the floor gives almost no precision at distance, and no
 *     feedback about range at all; the parabola's apex is what makes "how far
 *     am I about to go" legible before you commit.
 *   - The cut has to be masked. Teleporting on a hard frame cut is disorienting
 *     because the scene changes with no transition to tell you it was you that
 *     moved. A short blink - black out, move, fade back - reads as intentional
 *     and is the standard fix.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";

/** Arc samples. 40 is smooth at this length without being a per-frame cost. */
const SEGMENTS = 40;
/** Launch speed at minimum and maximum stick push, m/s. */
const SPEED_MIN = 4.5;
const SPEED_MAX = 9.0;
/** Arc gravity. Steeper than real gravity so the curve stays readable indoors. */
const GRAVITY = 14;
/** Integration step, seconds of simulated flight per sample. */
const STEP = 0.045;
/**
 * How far above the player's own foot plane an arc is launched from, at minimum.
 * A hand reaching below its own feet cannot throw anything. See aim().
 */
const MIN_LAUNCH_Y = 0.02;
/**
 * Landing has to stay on the synthetic floor - past its outer radius there is
 * nothing under your feet and the horizon fade has already begun. Matches
 * ground.ts OUTER.
 */
const MAX_RADIUS = 16;
/** Seconds to black out, and to come back. Out is faster than in on purpose. */
const BLINK_OUT = 0.09;
const BLINK_IN = 0.18;

const VALID = new Color("#7dd3fc");
const INVALID = new Color("#f87171");

type Blink = "none" | "out" | "in";

export class Teleport {
  readonly group = new Group();

  private arc: Line;
  private reticle: Group;
  private ringMesh: Mesh;
  private diskMesh: Mesh;
  private blinkMesh: Mesh;

  /** The live vertex buffer of `arc`, written in place each aiming frame. */
  private points: Float32Array;
  /** parent.matrixWorld inverted, refreshed once per aim rather than per sample. */
  private toLocal = new Matrix4();
  private target = new Vector3();
  private valid = false;

  private blink: Blink = "none";
  private blinkT = 0;
  private pending: Vector3 | null = null;

  private _v = new Vector3();
  private _p = new Vector3();
  private _q = new Quaternion();

  /**
   * @param parent  World-space container for the arc and reticle. NOT the player
   *                rig: the arc is computed in world coordinates and must not be
   *                dragged around by the very movement it is aiming.
   */
  constructor(
    private parent: Object3D,
    private playerRig: Object3D,
    private camera: PerspectiveCamera,
  ) {
    const geo = new BufferGeometry();
    // Float32BufferAttribute copies what it is given, so take the buffer back
    // from the attribute - writing to any other array would draw nothing.
    const attr = new Float32BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3);
    this.points = attr.array as Float32Array;
    geo.setAttribute("position", attr);
    this.arc = new Line(
      geo,
      new LineBasicMaterial({ color: VALID, transparent: true, opacity: 0.9 }),
    );
    this.arc.frustumCulled = false; // the vertices move every frame
    this.arc.renderOrder = 890;

    this.ringMesh = new Mesh(
      new RingGeometry(0.34, 0.42, 48),
      new MeshBasicMaterial({ color: VALID, transparent: true, opacity: 0.95, side: DoubleSide }),
    );
    this.diskMesh = new Mesh(
      new RingGeometry(0.001, 0.34, 48),
      new MeshBasicMaterial({ color: VALID, transparent: true, opacity: 0.22, side: DoubleSide }),
    );
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.diskMesh.rotation.x = -Math.PI / 2;
    // Clear of the floor plane at -0.004 and of the scans' own captured ground,
    // which both sit within a few millimetres of y=0.
    this.ringMesh.position.y = 0.012;
    this.diskMesh.position.y = 0.011;
    this.ringMesh.renderOrder = 892;
    this.diskMesh.renderOrder = 891;

    this.reticle = new Group();
    this.reticle.add(this.diskMesh, this.ringMesh);

    this.group.add(this.arc, this.reticle);
    this.group.visible = false;
    this.parent.add(this.group);

    // Blink plane rides the camera, like the vignette. Big enough to cover the
    // headset FOV at this distance with room to spare - a gap at the edge of a
    // "black out" is worse than no blink at all.
    this.blinkMesh = new Mesh(
      new PlaneGeometry(4, 4),
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.blinkMesh.position.z = -0.35;
    this.blinkMesh.renderOrder = 1000; // above the panel and the hints
    this.blinkMesh.frustumCulled = false;
    this.blinkMesh.visible = false;
    this.camera.add(this.blinkMesh);
  }

  /**
   * Trace the arc from a controller and park the reticle where it lands.
   *
   * `push` (0..1) is how far the stick is held forward and scales the launch
   * speed, so range is controlled with the same gesture that raises the arc.
   * `lateral` nudges the aim sideways for fine adjustment without having to
   * rotate the wrist.
   */
  aim(controller: Object3D, lateral: number, push: number) {
    const origin = controller.getWorldPosition(this._v).clone();

    // The arc is traced against the plane the player's own feet are on, not
    // world y = 0.
    //
    // Rise/duck (vr-input.ts) is a translation on the rig and the only thing
    // that writes rig.y, so ducking to -1.4 m to look along an undercarriage
    // takes the HAND under y = 0 with it. The landing test below only fires on
    // a DESCENDING crossing, which an arc that starts below the plane never
    // produces - so teleport silently stopped working while ducked, showing
    // nothing but a red reticle, in the one mode (hands) where it is the only
    // locomotion there is.
    //
    // Using the foot plane keeps the arc attached to the hand and keeps the
    // throw distance identical crouched or upright: what sets the range is hand
    // height above your own feet, which ducking does not change. The commit
    // still puts you on the real floor - moveTo() resets the height axis,
    // because you aimed at a point on the FLOOR.
    const floorY = this.playerRig.position.y;
    // Last-ditch: a hand reaching below its own foot plane has no throw at all.
    origin.y = Math.max(origin.y, floorY + MIN_LAUNCH_Y);
    controller.getWorldQuaternion(this._q);

    const dir = new Vector3(0, 0, -1).applyQuaternion(this._q);
    if (lateral !== 0) {
      const right = new Vector3(1, 0, 0).applyQuaternion(this._q);
      dir.addScaledVector(right, lateral * 0.35).normalize();
    }

    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * Math.min(1, Math.max(0, push));
    const vel = dir.multiplyScalar(speed);

    // One inverse for the whole trace. worldToLocal() copies and inverts the
    // parent matrix on every call, and this runs 40+ times per aiming frame.
    this.parent.updateWorldMatrix(true, false);
    this.toLocal.copy(this.parent.matrixWorld).invert();

    const p = origin.clone();
    let hit = false;
    let n = 0;
    this.writePoint(n++, p);

    for (; n <= SEGMENTS; n++) {
      const prevY = p.y;
      // Step position with the current velocity, then apply gravity to it, so
      // `vel.x * STEP` below is exactly the horizontal displacement just taken.
      p.addScaledVector(vel, STEP);
      vel.y -= GRAVITY * STEP;
      if (p.y <= floorY && prevY > floorY) {
        // Land exactly on the plane, not at whichever sample first went under
        // it: back the step out by the fraction that overshot, or the reticle
        // visibly floats short of the arc's actual landing point.
        const overshoot = 1 - (prevY - floorY) / (prevY - p.y);
        p.x -= vel.x * STEP * overshoot;
        p.z -= vel.z * STEP * overshoot;
        p.y = floorY;
        this.writePoint(n, p);
        hit = true;
        break;
      }
      this.writePoint(n, p);
    }

    // Collapse any unused tail onto the last real sample so no stale segment
    // from a longer previous arc is left hanging in the air.
    for (let i = n + 1; i <= SEGMENTS; i++) this.writePoint(i, p);

    this.valid = hit && Math.hypot(p.x, p.z) <= MAX_RADIUS;
    this.target.copy(p);

    const colour = this.valid ? VALID : INVALID;
    (this.arc.material as LineBasicMaterial).color.copy(colour);
    (this.ringMesh.material as MeshBasicMaterial).color.copy(colour);
    (this.diskMesh.material as MeshBasicMaterial).color.copy(colour);

    this.reticle.position.copy(p).applyMatrix4(this.toLocal);
    this.reticle.visible = this.valid;
    this.arc.geometry.attributes.position.needsUpdate = true;
    this.arc.geometry.computeBoundingSphere();
    this.group.visible = true;
  }

  private writePoint(i: number, worldPoint: Vector3) {
    const local = this._p.copy(worldPoint).applyMatrix4(this.toLocal);
    this.points[i * 3] = local.x;
    this.points[i * 3 + 1] = local.y;
    this.points[i * 3 + 2] = local.z;
  }

  /**
   * Where the last aim() landed. Read-only, and the only window the headless
   * check (scripts/vr_check.mjs) has into arc maths that cannot otherwise be
   * exercised without a headset.
   */
  get landing() {
    return {
      valid: this.valid,
      x: this.target.x,
      y: this.target.y,
      z: this.target.z,
    };
  }

  /** Commit to the current reticle. Returns false if there was nowhere valid. */
  commit(): boolean {
    this.group.visible = false;
    if (!this.valid) return false;
    this.pending = this.target.clone();
    this.blink = "out";
    this.blinkT = 0;
    this.blinkMesh.visible = true;
    return true;
  }

  cancel() {
    this.group.visible = false;
  }

  /** Hide everything, including a blink caught mid-fade (used on session exit). */
  reset() {
    this.group.visible = false;
    this.pending = null;
    this.blink = "none";
    this.blinkT = 0;
    this.blinkMesh.visible = false;
    (this.blinkMesh.material as MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    if (this.blink === "none") return;
    this.blinkT += dt;
    const mat = this.blinkMesh.material as MeshBasicMaterial;

    if (this.blink === "out") {
      mat.opacity = Math.min(1, this.blinkT / BLINK_OUT);
      if (this.blinkT >= BLINK_OUT) {
        if (this.pending) this.moveTo(this.pending);
        this.pending = null;
        this.blink = "in";
        this.blinkT = 0;
        mat.opacity = 1;
      }
      return;
    }

    mat.opacity = Math.max(0, 1 - this.blinkT / BLINK_IN);
    if (this.blinkT >= BLINK_IN) {
      this.blink = "none";
      mat.opacity = 0;
      this.blinkMesh.visible = false;
    }
  }

  /**
   * Put the user's feet on the target. It is the HEAD's ground position that has
   * to land there, not the rig origin - the rig origin is wherever the play
   * space happens to be centred, which is metres away once someone has walked
   * around their room.
   *
   * Height is reset rather than carried. The arc is aimed at a point on the
   * FLOOR, so arriving still hovering a metre above it - or sunk under it, from
   * looking at an undercarriage - contradicts the reticle you just aimed with.
   * Rise/duck is for inspecting a spot, not a mode you travel in.
   */
  private moveTo(target: Vector3) {
    const head = this.camera.getWorldPosition(this._v).clone();
    head.y = 0;
    const delta = target.clone().sub(head);
    // Horizontal only. The target sits on the player's foot plane, which while
    // ducked is below the floor - carrying that into the move would put the
    // duck straight back after the line below cleared it.
    delta.y = 0;
    this.playerRig.position.y = 0;
    // Rig-parent space, not world: identical while the rig hangs off the scene
    // root, but this survives someone parenting it under a transformed group.
    const parent = this.playerRig.parent;
    if (parent) {
      const a = parent.worldToLocal(new Vector3(0, 0, 0));
      const b = parent.worldToLocal(delta.clone());
      delta.copy(b.sub(a));
    }
    this.playerRig.position.add(delta);
  }
}
