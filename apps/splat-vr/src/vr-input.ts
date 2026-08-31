/**
 * VR controller mapping + comfort options.
 *
 * Spark's built-in controller defaults do not match what Quest users expect,
 * and three of the mismatches are actively harmful in a walkaround scene, so
 * all four getters are overridden here:
 *
 *   - DEFAULT_CONTROLLER_GETMOVE binds the LEFT trigger and grip to fly up/down.
 *     Grip is universally "grab" and trigger is "primary action"; nobody expects
 *     either to launch them into the air. This scene is a walkaround, so there
 *     is no vertical axis at all now.
 *   - DEFAULT_CONTROLLER_GETFAST binds the RIGHT trigger to a 5x speed boost,
 *     which turns the expected "select" button into a 6 m/s lurch across the
 *     room. Removed.
 *   - `moveHeading: true` applies the FULL head orientation to the move vector,
 *     pitch included - look up at the roofline, push forward, and you fly off
 *     the floor. Walking has to be yaw-only, which is Spark's `moveDirection`.
 *   - DEFAULT_CONTROLLER_GETROTATE is smooth-turn only. Continuous turning is
 *     the single biggest sim-sickness trigger, so snap turn is the default here
 *     and smooth is opt-in.
 *
 * Resulting scheme, matching the community-standard layout:
 *
 *   Left thumbstick   walk / strafe (yaw-relative to where you are looking)
 *   Right thumbstick  X: turn - snap 45 deg by default, smooth optional
 *                     Y: rise and duck (see below)
 *   Index trigger     select / press panel buttons and hazard markers
 *   Grip              reserved (deliberately inert - see above)
 *   A / X             accept
 *   B / Y             toggle the controls panel
 *
 * ON THE VERTICAL AXIS: the turn stick's Y was the one input on either
 * controller that nothing read, in either movement style. It is now height,
 * which solves a real problem in a walkaround of a vehicle - you cannot inspect
 * an undercarriage or see down into an engine bay without either lying on the
 * floor of your actual room or standing on something. It is deliberately NOT on
 * the left stick: that would cost walking, and in teleport mode it would fight
 * the aiming gesture. Slower than walking, clamped at both ends, and it raises
 * the vignette like any other translation, because vertical motion with no
 * matching sensation in the inner ear is a strong sickness trigger.
 *
 * NOTE ON THE MENU BUTTON: the community convention is that the left Menu (=)
 * button opens the app menu, but on Quest that button is captured by the system
 * shell and is never delivered to a WebXR page - there is no button index for it
 * in the `xr-standard` gamepad mapping. The panel toggle is therefore on Y/B,
 * which is the nearest convention-compatible binding ("B/Y opens sub-menus").
 */
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Vector3,
  WebGLRenderer,
} from "three";
import type { SparkXrControllers, XrGamepads } from "@sparkjsdev/spark";

export type TurnStyle = "snap" | "smooth";
export type MovementStyle = "walk" | "teleport";
export type Handedness = "right" | "left";

export type ComfortSettings = {
  turnStyle: TurnStyle;
  /**
   * "teleport" is the standard escape hatch for users who cannot tolerate
   * stick locomotion at all - it is the most comfortable option there is,
   * because the view never moves while the world does. See teleport.ts.
   */
  movementStyle: MovementStyle;
  /** Degrees per snap. 45 is the common default; 30 suits sensitive users. */
  snapDegrees: number;
  /** Radians/sec for smooth turning. */
  smoothTurnSpeed: number;
  /** Metres/sec walking speed. */
  moveSpeed: number;
  /** Tunnel-vision blinders while moving. Reduces sickness, hurts immersion. */
  vignette: boolean;
  /** "left" mirrors the sticks for left-handed users. */
  dominantHand: Handedness;
  /**
   * Rise/duck on the turn stick's Y axis. On by default: the whole point of a
   * walkaround is inspecting parts of the vehicle you cannot get your eyes to
   * otherwise. Switchable because a user who never wants it will find it under
   * their thumb every time they turn.
   */
  verticalMove: boolean;
  /** Show the hazard and cut-point markers on the vehicle. */
  hotspots: boolean;
  /** Labelled callouts pinned to the controllers - see controller-hints.ts. */
  controllerHints: boolean;
  /**
   * Controller vibration on snap turn, teleport and button presses. A discrete
   * action with no physical feedback reads as "did that register?", and the
   * Quest Browser exposes the Gamepad API's hapticActuators for exactly this.
   */
  haptics: boolean;
};

export const DEFAULT_COMFORT: ComfortSettings = {
  turnStyle: "snap",
  movementStyle: "walk",
  snapDegrees: 45,
  smoothTurnSpeed: 2.0,
  moveSpeed: 1.2,
  vignette: true,
  dominantHand: "right",
  verticalMove: true,
  hotspots: true,
  controllerHints: true,
  haptics: true,
};

const STORE_KEY = "splatvr.comfort.v1";

export function loadComfort(): ComfortSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_COMFORT };
    // Merge over defaults so a stored blob from an older build cannot leave a
    // field undefined and silently zero out a speed.
    return { ...DEFAULT_COMFORT, ...(JSON.parse(raw) as Partial<ComfortSettings>) };
  } catch {
    return { ...DEFAULT_COMFORT };
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: ComfortSettings | undefined;

function writeComfort(s: ComfortSettings) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private browsing - settings just do not persist */
  }
}

/**
 * Coalesced write. localStorage.setItem is synchronous and hits disk, and the
 * walk-speed slider fires `input` on every pixel of drag - persisting each one
 * put a blocking write in the middle of the render loop for no benefit. The
 * flush on pagehide is what keeps the last drag from being lost.
 */
export function saveComfort(s: ComfortSettings) {
  pendingSave = s;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (pendingSave) writeComfort(pendingSave);
    pendingSave = undefined;
  }, 250);
}

/** Persist immediately - on page hide, and before entering an XR session. */
export function flushComfort() {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  if (pendingSave) writeComfort(pendingSave);
  pendingSave = undefined;
}

/**
 * Wire the debounced comfort write to the page going away. Call once, from
 * main.ts.
 *
 * Explicit rather than a module-level side effect on import: importing a type or
 * a constant from this file used to silently register two window listeners, which
 * is the kind of thing that makes a module impossible to test in isolation and
 * impossible to reason about from its import site.
 */
export function installComfortFlush() {
  window.addEventListener("pagehide", flushComfort);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushComfort();
  });
}

/** xr-standard gamepad button indices. */
const BTN = { trigger: 0, grip: 1, primary: 4, secondary: 5 } as const;
/** xr-standard thumbstick axes (0/1 are the unused touchpad). */
const AX = { x: 2, y: 3 } as const;

const DEADZONE = 0.18;
/** Push past this to fire a snap turn... */
const SNAP_ON = 0.7;
/** ...and back inside this before it can fire again. */
const SNAP_OFF = 0.35;

/**
 * Rise/duck limits and rate, metres. The rig's y is an offset from the real
 * floor, so the head ends up at roughly this plus standing height.
 *
 * VERT_MIN puts the eyes near the deck without going so far under that the
 * vehicle is above the top of your view - enough to look along an undercarriage.
 * VERT_MAX clears the roofline of a raised hood. The rate is under two thirds of
 * the default walk speed: vertical motion is the least familiar of the three and
 * the easiest to overshoot.
 */
const VERT_MIN = -1.4;
const VERT_MAX = 1.5;
const VERTICAL_SPEED = 0.7;

function dz(v: number) {
  return Math.abs(v) < DEADZONE ? 0 : v;
}

function makeVignetteTexture(): CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Wide clear centre, then a soft ramp - a hard-edged hole is more distracting
  // than the motion it is meant to mask.
  g.addColorStop(0.0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(0.78, "rgba(0,0,0,0.55)");
  g.addColorStop(1.0, "rgba(0,0,0,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new CanvasTexture(c);
}

export type VrButtonEvent = "togglePanel" | "accept";

/** The controls that carry an on-controller hint label. */
export type VrControl = "stick" | "trigger" | "secondary";

/**
 * Teleport is a push-and-release gesture on the move stick: pushing forward
 * raises the aiming arc, letting go commits to wherever it landed, and pulling
 * back without releasing forward cancels. `aim` carries the stick vector so the
 * arc can be steered slightly with the stick as well as with the wrist.
 */
export type TeleportEvent =
  | { phase: "aim"; hand: Handedness; x: number; y: number }
  | { phase: "commit"; hand: Handedness }
  | { phase: "cancel" };

/** Minimum forward push to raise the arc, and the release point that fires it. */
const TELE_ON = 0.6;
const TELE_OFF = 0.3;

export class VrInput {
  settings: ComfortSettings;

  /**
   * Controller ray spaces. Typed off getController's return rather than as
   * Group so the XR event map (`selectstart`/`selectend`) survives - annotating
   * these as Group compiles but makes addEventListener("selectstart") a type error.
   */
  readonly controllers: ReturnType<WebGLRenderer["xr"]["getController"]>[] = [];

  private renderer: WebGLRenderer;
  private playerRig: Group;
  private camera: PerspectiveCamera;

  private snapArmed = true;
  private vignetteMesh: Mesh;
  private vignetteOpacity = 0;

  private prevButtons = new Map<string, boolean>();

  /**
   * Scratch. getMove/getRotate are called once per frame by Spark and turnBy
   * runs every frame of a smooth turn; all three used to allocate.
   */
  private _move = new Vector3();
  private _rotate = new Vector3();
  private _turnQuat = new Quaternion();
  private _up = new Vector3();
  private _pivot = new Vector3();
  private listeners: ((e: VrButtonEvent) => void)[] = [];
  private useListeners: ((hand: Handedness, control: VrControl) => void)[] = [];
  private teleListeners: ((e: TeleportEvent) => void)[] = [];
  private teleAiming = false;

  /**
   * Which physical hand each controller index turned out to be. getController(i)
   * is indexed by input-source slot, NOT by handedness, and the mapping is not
   * guaranteed - so anything that needs "the controller in the moving hand"
   * (the teleport arc) has to learn it from the connected event.
   */
  private handOfIndex: (Handedness | null)[] = [null, null];

  /**
   * Whether each slot is a tracked hand rather than a controller. Learned from
   * the same `connected` event, because a hand and a controller arrive through
   * the identical target-ray object and the difference only shows on the input
   * source - and it decides whether a select is a trigger pull or a pinch, which
   * are bound to different things.
   */
  private slotIsHand: boolean[] = [false, false];

  constructor(opts: {
    renderer: WebGLRenderer;
    playerRig: Group;
    camera: PerspectiveCamera;
    settings?: ComfortSettings;
  }) {
    this.renderer = opts.renderer;
    this.playerRig = opts.playerRig;
    this.camera = opts.camera;
    this.settings = opts.settings ?? loadComfort();

    // Controller rays. three's WebXRManager owns the pose; we only attach the
    // visual. Parented to the rig so locomotion carries them along.
    for (let i = 0; i < 2; i++) {
      const ctrl = this.renderer.xr.getController(i);
      const geo = new BufferGeometry().setAttribute(
        "position",
        new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3),
      );
      const line = new Line(
        geo,
        new LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.75 }),
      );
      line.scale.z = 3;
      ctrl.add(line);
      this.controllers.push(ctrl);
      this.playerRig.add(ctrl);

      const slot = i;
      ctrl.addEventListener("connected", (event) => {
        const h = event.data?.handedness;
        this.handOfIndex[slot] = h === "left" || h === "right" ? h : null;
        this.slotIsHand[slot] = !!event.data?.hand;
      });
      ctrl.addEventListener("disconnected", () => {
        this.handOfIndex[slot] = null;
        this.slotIsHand[slot] = false;
      });
    }

    // Vignette rides on the camera so it stays locked to the view. Large enough
    // to cover the headset's ~110 deg FOV at this distance.
    this.vignetteMesh = new Mesh(
      new PlaneGeometry(2.6, 2.6),
      // Normal blending, not additive: the texture is black with an alpha ramp,
      // and additive black composites to nothing at all.
      new MeshBasicMaterial({
        map: makeVignetteTexture(),
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.vignetteMesh.position.z = -0.6;
    this.vignetteMesh.renderOrder = 999;
    this.vignetteMesh.frustumCulled = false;
    this.vignetteMesh.visible = false;
    this.camera.add(this.vignetteMesh);
  }

  onButton(cb: (e: VrButtonEvent) => void) {
    this.listeners.push(cb);
  }

  private emit(e: VrButtonEvent) {
    for (const cb of this.listeners) cb(e);
  }

  /**
   * Fires the first time a given control is actuated. Drives hint retirement:
   * a label whose control you have already used has done its job.
   */
  onUse(cb: (hand: Handedness, control: VrControl) => void) {
    this.useListeners.push(cb);
  }

  private emitUse(hand: Handedness, control: VrControl) {
    for (const cb of this.useListeners) cb(hand, control);
  }

  onTeleport(cb: (e: TeleportEvent) => void) {
    this.teleListeners.push(cb);
  }

  private emitTele(e: TeleportEvent) {
    for (const cb of this.teleListeners) cb(e);
  }

  /** The ray space of a given physical hand, once it has announced itself. */
  controllerFor(hand: Handedness) {
    const i = this.handOfIndex.indexOf(hand);
    return i === -1 ? null : this.controllers[i];
  }

  /**
   * Is this target ray a pinching hand rather than a held controller?
   *
   * three routes session-level selectstart/selectend to hand input sources with
   * no discrimination at all, so a pinch and a trigger pull arrive identically.
   * They must not do the same thing: a controller's trigger only presses UI
   * (its teleport lives on the thumbstick), while a hand's pinch has to press UI
   * AND be the teleport gesture, because there is no stick to put it on.
   */
  isHandController(controller: Object3D): boolean {
    const i = this.controllers.indexOf(
      controller as (typeof this.controllers)[number],
    );
    return i === -1 ? false : this.slotIsHand[i];
  }

  /** Inverse of controllerFor: which hand a given ray space belongs to. */
  handOf(controller: Object3D): Handedness | null {
    const i = this.controllers.indexOf(
      controller as (typeof this.controllers)[number],
    );
    return i === -1 ? null : this.handOfIndex[i];
  }

  /** Which hand currently drives movement (and therefore the teleport arc). */
  get moveHandedness(): Handedness {
    return this.settings.dominantHand === "left" ? "right" : "left";
  }

  /**
   * What the user is actually holding, this frame.
   *
   * Every surface that names a control has to key off this. A panel that says
   * "press B / Y" to somebody with empty hands is not a minor cosmetic problem -
   * it is the panel confidently describing a button that does not exist, which
   * is how a user concludes the app is broken rather than that they are in a
   * different input mode.
   */
  get inputMode(): "controllers" | "hands" | "mixed" | "none" {
    let hands = 0;
    let pads = 0;
    for (const src of this.renderer.xr.getSession()?.inputSources ?? []) {
      if (src.hand) hands++;
      else if (src.gamepad) pads++;
    }
    if (hands && pads) return "mixed";
    if (hands) return "hands";
    if (pads) return "controllers";
    return "none";
  }

  /**
   * The movement style actually in force.
   *
   * A tracked hand has no thumbstick, so walking is simply not available - but
   * the stored preference is left alone rather than rewritten, so putting the
   * controllers back down restores whatever the user chose.
   */
  get effectiveMovementStyle(): MovementStyle {
    return this.inputMode === "hands" ? "teleport" : this.settings.movementStyle;
  }

  /** Current rise/duck offset, metres above the real floor. */
  get height(): number {
    return this.playerRig.position.y;
  }

  /** Clamp-respecting setter, so callers cannot put the user out of bounds. */
  setHeight(y: number) {
    this.playerRig.position.y = MathUtils.clamp(y, VERT_MIN, VERT_MAX);
  }

  static readonly HEIGHT_RANGE: readonly [number, number] = [VERT_MIN, VERT_MAX];

  /**
   * Fire the controller's rumble motor.
   *
   * WebXR itself has no haptics; the vibration lives on the Gamepad API's
   * `hapticActuators`, which the Quest Browser implements. It is still marked
   * experimental and absent on plenty of runtimes, so every part of the lookup
   * is optional and the returned promise is deliberately dropped - a headset
   * without a rumble motor must not turn a snap turn into an unhandled
   * rejection.
   */
  pulse(hand: Handedness, intensity: number, ms: number) {
    if (!this.settings.haptics) return;
    const g = this.gamepads();
    const pad = hand === "left" ? g.left : g.right;
    const actuator = (
      pad as (Gamepad & { hapticActuators?: { pulse?: (i: number, d: number) => unknown }[] })
        | undefined
    )?.hapticActuators?.[0];
    try {
      actuator?.pulse?.(intensity, ms);
    } catch {
      /* unsupported runtime */
    }
  }

  /** Which physical controller drives movement, honouring the left-handed swap. */
  private moveHand(g: XrGamepads) {
    return this.settings.dominantHand === "left" ? g.right : g.left;
  }

  private turnHand(g: XrGamepads) {
    return this.settings.dominantHand === "left" ? g.left : g.right;
  }

  private moveIsHand(g: XrGamepads) {
    return this.settings.dominantHand === "left" ? g.rightIsHand : g.leftIsHand;
  }

  /**
   * Config handed to SparkXr. Movement stays Spark's (it already does the
   * yaw-only basis and delta-time integration correctly); turning is taken over
   * completely because snap turn is discrete and Spark's path is continuous.
   */
  sparkConfig(): SparkXrControllers {
    // moveSpeed is a getter, not a value: Spark reads `controllers.moveSpeed`
    // every frame, so this picks up slider changes live. Snapshotting it here
    // would leave the walk-speed control silently inert after startup.
    const self = this;
    return {
      get moveSpeed() {
        return self.settings.moveSpeed;
      },
      // Yaw-only, so looking up while walking does not lift you off the floor.
      moveHeading: false,
      moveDirection: true,
      getMove: (g: XrGamepads) => {
        // In teleport mode the same stick aims the arc, so Spark must not also
        // slide the rig - otherwise a teleport push walks you forward first.
        // effectiveMovementStyle, not the stored preference: with tracked hands
        // there is no stick to walk with whatever the user chose.
        //
        // Spark mutates whatever this returns (applyQuaternion, multiplyScalar)
        // and calls it exactly once a frame, and every path below rewrites all
        // three components, so a scratch vector is safe and saves an allocation
        // per frame in each of these two callbacks.
        if (this.effectiveMovementStyle === "teleport") return this._move.set(0, 0, 0);
        const pad = this.moveHand(g);
        if (!pad || this.moveIsHand(g)) return this._move.set(0, 0, 0);
        return this._move.set(dz(pad.axes[AX.x] ?? 0), 0, dz(pad.axes[AX.y] ?? 0));
      },
      // Handled in update(); returning zero keeps Spark from also turning us.
      getRotate: () => this._rotate.set(0, 0, 0),
      getFast: () => false,
      getSlow: () => false,
    };
  }

  private gamepads(): XrGamepads {
    const out: XrGamepads = {};
    for (const src of this.renderer.xr.getSession()?.inputSources ?? []) {
      if (!src.gamepad) continue;
      if (src.handedness === "left") {
        out.left = src.gamepad;
        out.leftIsHand = !!src.hand;
      } else if (src.handedness === "right") {
        out.right = src.gamepad;
        out.rightIsHand = !!src.hand;
      }
    }
    return out;
  }

  /** Rising-edge detect, so a held button fires once. */
  private pressed(key: string, down: boolean): boolean {
    const was = this.prevButtons.get(key) ?? false;
    this.prevButtons.set(key, down);
    return down && !was;
  }

  /** Rotate the rig about the user's actual head, not the rig origin - turning
   * around a point you are not standing on feels like being swung on a rope. */
  private turnBy(radians: number) {
    const quat = this._turnQuat.setFromAxisAngle(this._up.set(0, 1, 0), radians);
    const pivot = this.camera.getWorldPosition(this._pivot);
    this.playerRig.parent?.worldToLocal(pivot);
    this.playerRig.position.sub(pivot).applyQuaternion(quat).add(pivot);
    this.playerRig.quaternion.premultiply(quat);
  }

  update(dt: number) {
    const g = this.gamepads();

    // --- usage signals ---
    // Rising edges only, and emitted BEFORE the button block below: a B/Y press
    // retires its own hint here and then re-shows the whole set via
    // togglePanel, so the "Controls panel" label does not vanish on the very
    // press that asked for help.
    for (const hand of ["left", "right"] as const) {
      const pad = hand === "left" ? g.left : g.right;
      const isHandInput = hand === "left" ? g.leftIsHand : g.rightIsHand;
      if (!pad || isHandInput) continue;
      const b = pad.buttons;
      const stickLive =
        Math.abs(dz(pad.axes[AX.x] ?? 0)) + Math.abs(dz(pad.axes[AX.y] ?? 0)) > 0;
      if (this.pressed(`u:${hand}:stick`, stickLive)) this.emitUse(hand, "stick");
      if (this.pressed(`u:${hand}:trig`, !!b[BTN.trigger]?.pressed)) {
        this.emitUse(hand, "trigger");
      }
      if (this.pressed(`u:${hand}:sec`, !!b[BTN.secondary]?.pressed)) {
        this.emitUse(hand, "secondary");
      }
    }

    // --- turning ---
    const turnPad = this.turnHand(g);
    const isHand =
      this.settings.dominantHand === "left" ? g.leftIsHand : g.rightIsHand;
    const tx = turnPad && !isHand ? (turnPad.axes[AX.x] ?? 0) : 0;

    let smoothTurning = false;
    if (this.settings.turnStyle === "snap") {
      if (Math.abs(tx) < SNAP_OFF) this.snapArmed = true;
      if (this.snapArmed && Math.abs(tx) > SNAP_ON) {
        this.turnBy(-Math.sign(tx) * (this.settings.snapDegrees * Math.PI) / 180);
        this.snapArmed = false;
        // Short and light: the tick confirms the discrete step landed, which is
        // otherwise ambiguous when the world jumps but nothing else changes.
        this.pulse(this.settings.dominantHand, 0.35, 25);
      }
    } else if (Math.abs(tx) > DEADZONE) {
      this.turnBy(-tx * this.settings.smoothTurnSpeed * dt);
      smoothTurning = true;
    }

    // --- rise / duck ---
    // The turn stick's Y axis, which nothing else reads. Clamped rather than
    // wrapped or accelerated, so the extremes are a wall you can lean on instead
    // of a value you have to hunt for.
    const vy =
      this.settings.verticalMove && turnPad && !isHand
        ? dz(turnPad.axes[AX.y] ?? 0)
        : 0;
    let climbRate = 0;
    if (vy !== 0) {
      const before = this.playerRig.position.y;
      // xr-standard puts stick-forward at -1, and forward should be up.
      const after = MathUtils.clamp(
        before - vy * VERTICAL_SPEED * dt,
        VERT_MIN,
        VERT_MAX,
      );
      this.playerRig.position.y = after;
      // Normalised against a full-speed climb, so it feeds the vignette on the
      // same 0..1 scale as walking. Reads zero once clamped at either end -
      // pushing into the limit is not motion and should not blinker the view.
      climbRate = dt > 0 ? Math.abs(after - before) / (VERTICAL_SPEED * dt) : 0;
    }

    // --- teleport aiming ---
    // Runs after turning so the arc drawn this frame reflects the orientation
    // the user is actually looking along.
    if (this.effectiveMovementStyle === "teleport") {
      const pad = this.moveHand(g);
      const live = !!pad && !this.moveIsHand(g);
      const ax = live ? dz(pad.axes[AX.x] ?? 0) : 0;
      // xr-standard puts forward at -1 on the Y axis; flip it so `push` reads
      // as "how far forward".
      const ay = live ? -dz(pad.axes[AX.y] ?? 0) : 0;
      const hand = this.moveHandedness;

      if (!this.teleAiming && ay > TELE_ON) {
        this.teleAiming = true;
      } else if (this.teleAiming && ay < TELE_OFF) {
        this.teleAiming = false;
        // Releasing forward commits; yanking the stick backwards past the
        // deadzone is the cancel gesture, which is the near-universal binding.
        if (ay < -DEADZONE || !live) this.emitTele({ phase: "cancel" });
        else this.emitTele({ phase: "commit", hand });
      }
      if (this.teleAiming) this.emitTele({ phase: "aim", hand, x: ax, y: ay });
    } else if (this.teleAiming) {
      // Style switched mid-aim (from the in-VR panel) - drop the arc.
      this.teleAiming = false;
      this.emitTele({ phase: "cancel" });
    }

    // --- buttons ---
    // Y (left secondary) and B (right secondary) both toggle the panel, so it is
    // reachable regardless of which hand is free.
    const lb = g.left?.buttons ?? [];
    const rb = g.right?.buttons ?? [];
    if (
      this.pressed("l5", !!lb[BTN.secondary]?.pressed) ||
      this.pressed("r5", !!rb[BTN.secondary]?.pressed)
    ) {
      this.emit("togglePanel");
    }
    if (
      this.pressed("l4", !!lb[BTN.primary]?.pressed) ||
      this.pressed("r4", !!rb[BTN.primary]?.pressed)
    ) {
      this.emit("accept");
    }

    // --- vignette ---
    // Continuous *rotation* is the strongest sim-sickness trigger of the two,
    // so smooth turning has to raise the blinders as well - the first version
    // only watched the move stick, which left the riskiest motion uncovered.
    // Teleport never needs it: nothing moves while the view is still.
    //
    // Rising and ducking counts too, in every movement style. Vertical motion
    // has no everyday equivalent for the inner ear to match it against, so it
    // provokes more than walking does - and unlike walking it is still available
    // when the user has chosen teleport precisely to avoid smooth motion.
    const movePad = this.moveHand(g);
    const walking =
      this.effectiveMovementStyle === "walk" && movePad
        ? Math.hypot(dz(movePad.axes[AX.x] ?? 0), dz(movePad.axes[AX.y] ?? 0))
        : 0;
    const speed = Math.max(walking, smoothTurning ? Math.abs(tx) : 0, climbRate);
    const target = this.settings.vignette && speed > 0 ? Math.min(1, speed) : 0;
    // Asymmetric easing: fade in fast enough to actually help, out slowly so it
    // does not pop the instant the stick centres.
    const k = target > this.vignetteOpacity ? 6 : 3;
    this.vignetteOpacity += (target - this.vignetteOpacity) * Math.min(1, k * dt);
    const mat = this.vignetteMesh.material as MeshBasicMaterial;
    mat.opacity = this.vignetteOpacity;
    this.vignetteMesh.visible = this.vignetteOpacity > 0.01;
  }

  setVisible(v: boolean) {
    for (const c of this.controllers) c.visible = v;
    if (!v) {
      this.vignetteMesh.visible = false;
      this.vignetteOpacity = 0;
    }
  }
}
