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
 *   Right thumbstick  turn - snap 45 deg by default, smooth optional
 *   Index trigger     select / press panel buttons
 *   Grip              reserved (deliberately inert - see above)
 *   A / X             accept
 *   B / Y             toggle the controls panel
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
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Vector3,
  WebGLRenderer,
} from "three";
import type { SparkXrControllers, XrGamepads } from "@sparkjsdev/spark";

export type TurnStyle = "snap" | "smooth";
export type Handedness = "right" | "left";

export type ComfortSettings = {
  turnStyle: TurnStyle;
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
};

export const DEFAULT_COMFORT: ComfortSettings = {
  turnStyle: "snap",
  snapDegrees: 45,
  smoothTurnSpeed: 2.0,
  moveSpeed: 1.2,
  vignette: true,
  dominantHand: "right",
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

export function saveComfort(s: ComfortSettings) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* private browsing - settings just do not persist */
  }
}

/** xr-standard gamepad button indices. */
const BTN = { trigger: 0, grip: 1, stick: 3, primary: 4, secondary: 5 } as const;
/** xr-standard thumbstick axes (0/1 are the unused touchpad). */
const AX = { x: 2, y: 3 } as const;

const DEADZONE = 0.18;
/** Push past this to fire a snap turn... */
const SNAP_ON = 0.7;
/** ...and back inside this before it can fire again. */
const SNAP_OFF = 0.35;

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
  private listeners: ((e: VrButtonEvent) => void)[] = [];

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
        const pad = this.moveHand(g);
        if (!pad || this.moveIsHand(g)) return new Vector3();
        return new Vector3(dz(pad.axes[AX.x] ?? 0), 0, dz(pad.axes[AX.y] ?? 0));
      },
      // Handled in update(); returning zero keeps Spark from also turning us.
      getRotate: () => new Vector3(),
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
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), radians);
    const pivot = this.camera.getWorldPosition(new Vector3());
    this.playerRig.parent?.worldToLocal(pivot);
    this.playerRig.position.sub(pivot).applyQuaternion(quat).add(pivot);
    this.playerRig.quaternion.premultiply(quat);
  }

  update(dt: number) {
    const g = this.gamepads();

    // --- turning ---
    const turnPad = this.turnHand(g);
    const isHand =
      this.settings.dominantHand === "left" ? g.leftIsHand : g.rightIsHand;
    const tx = turnPad && !isHand ? (turnPad.axes[AX.x] ?? 0) : 0;

    if (this.settings.turnStyle === "snap") {
      if (Math.abs(tx) < SNAP_OFF) this.snapArmed = true;
      if (this.snapArmed && Math.abs(tx) > SNAP_ON) {
        this.turnBy(-Math.sign(tx) * (this.settings.snapDegrees * Math.PI) / 180);
        this.snapArmed = false;
      }
    } else if (Math.abs(tx) > DEADZONE) {
      this.turnBy(-tx * this.settings.smoothTurnSpeed * dt);
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
    const movePad = this.moveHand(g);
    const speed = movePad
      ? Math.hypot(dz(movePad.axes[AX.x] ?? 0), dz(movePad.axes[AX.y] ?? 0))
      : 0;
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

  applySettings(patch: Partial<ComfortSettings>) {
    this.settings = { ...this.settings, ...patch };
    saveComfort(this.settings);
  }
}
