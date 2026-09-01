/**
 * In-VR controls panel, with a minimised state.
 *
 * A first-time user in a headset has no way to discover the bindings - there is
 * no manual, and the DOM UI is hidden the moment the XR session starts. So the
 * panel opens maximised on the first VR entry and remembers its state after
 * that: obvious when you need it, out of the way when you do not.
 *
 * Drawn to a 2D canvas rather than built from meshes or a UI toolkit. Text is
 * the entire content, canvas gives crisp glyphs at any size for one texture and
 * one draw call, and it keeps this file dependency-free.
 *
 * It is world-locked, not head-locked. A panel welded to your face is the
 * classic VR comfort mistake - it never leaves your view and it fights every
 * head movement. This one is placed in front of you when opened and then stays
 * put, so you can simply look away from it.
 *
 * Two comfort toggles live on the panel as well as in the desktop UI, because
 * "turning makes me queasy" is a thing you discover while in the headset, and
 * having to take it off to fix that is exactly the wrong answer.
 */
import {
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  C,
  fitText,
  hitAt,
  makeCanvasSurface,
  roundRect,
  type CanvasSurface,
  type Rect,
} from "./canvas-ui";
import type { InputMode } from "./input-sources";
import type { ComfortSettings } from "./vr-input";

/**
 * What the user is holding. Drives which bindings the panel claims exist.
 *
 * Owned by input-sources.ts now that a single registry decides it; re-exported
 * here so this file stays the one import site for anything panel-shaped.
 */
export type { InputMode };

/** Re-exported so controller-hints.ts keeps its one import site. */
export { C } from "./canvas-ui";

const FULL_W = 1024;
/**
 * Tall enough for two rows of comfort buttons under the bindings, plus the
 * error line. The metre width is fixed, so height only changes how much of the
 * vertical FOV the panel takes at PLACE_DISTANCE - 0.97 m at 1.6 m is roughly
 * 33 degrees, which sits inside a comfortable reading cone.
 */
const FULL_H = 900;
const MINI_W = 640;
const MINI_H = 88;

/**
 * Layout anchors, in canvas pixels.
 *
 * The comfort grid's top is a CONSTANT rather than "wherever the bindings list
 * happened to end". The bindings are now input-mode dependent - seven rows with
 * controllers, five with tracked hands - so deriving the grid position from them
 * would slide every button up by 124 px the moment somebody put their
 * controllers down, and slide the headless check's ray targets off with them.
 */
const BINDINGS_TOP = 132;
const BINDING_PITCH = 62;
const GRID_TOP = 616;
/** Four columns: 36 px margins, 20 px gutters, 223 px buttons, 36 px right margin. */
const GRID_COLS = 4;
const BTN_W = 223;
const BTN_H = 62;
const BTN_GUTTER = 20;
const BTN_GAP = 16;

/** Panel width in metres; height follows the canvas aspect. */
const FULL_METRES = 1.15;
const MINI_METRES = 0.62;

/** Where the panel is placed relative to the viewer when it opens. */
const PLACE_DISTANCE = 1.6;
const PLACE_HEIGHT = 1.35;

export type PanelAction =
  | "minimize"
  | "expand"
  | "toggleTurn"
  | "toggleMove"
  | "toggleVertical"
  | "toggleHotspots"
  | "toggleVignette"
  | "toggleHints"
  | "toggleHaptics"
  | "recentre";
/** What the panel looks like after a toggle - callers key other UI off this. */
export type PanelState = "full" | "mini";

type Hit = { action: PanelAction };

/**
 * The bindings, derived from the settings rather than written out.
 *
 * This list used to be a hardcoded "Left Stick = walk, Right Stick = turn",
 * which is simply false once dominantHand is "left" - vr-input swaps both
 * sticks, and controller-hints.ts already derives its own labels correctly, so
 * the two in-VR surfaces contradicted each other for every left-handed user.
 * A controls panel that lies is worse than no controls panel.
 */
function bindingRows(
  s: ComfortSettings,
  mode: InputMode,
): [string, string][] {
  // With tracked hands there is no stick to name and no face buttons to press,
  // so the controller list is not merely incomplete - every line of it is false.
  if (mode === "hands") {
    return [
      ["Pinch", "Select buttons and hazard markers"],
      ["Pinch + hold", "Aim the arc, let go to teleport"],
      ["Palm up", "Show or hide this panel"],
      ["Turning", "Turn your body - hands have no turn stick"],
      ["Rise / duck", "Pick up a controller for the height axis"],
    ];
  }

  const moveStick = s.dominantHand === "left" ? "Right Stick" : "Left Stick";
  const turnStick = s.dominantHand === "left" ? "Left Stick" : "Right Stick";
  return [
    [
      moveStick,
      s.movementStyle === "teleport"
        ? "Push to aim, release to teleport"
        : "Walk and strafe",
    ],
    [
      `${turnStick} <->`,
      s.turnStyle === "snap" ? `Turn ${s.snapDegrees}\u00b0 per flick` : "Turn",
    ],
    [
      `${turnStick} up/down`,
      s.verticalMove ? "Rise and duck" : "Off - enable Height below",
    ],
    ["Trigger / Pinch", "Select buttons and hazard markers"],
    ["Grip", "Not used in this scene"],
    ["A / X", "Accept"],
    ["B / Y", "Show or hide this panel"],
  ];
}

export class HelpPanel {
  readonly group = new Group();

  private full: CanvasSurface;
  private mini: CanvasSurface;

  private fullHits: (Rect & Hit)[] = [];
  private miniHits: (Rect & Hit)[] = [];

  private minimized = false;
  private errorText: string | null = null;
  /** Input mode the bindings list was last painted for. */
  private mode: InputMode = "controllers";
  /**
   * Tracking diagnostics, when there are any. Replaces the footer hints rather
   * than being squeezed in beside them: if positional tracking is broken, how to
   * press a button is not the most useful thing on screen.
   */
  private diagnostics: string[] | null = null;
  /** Signature of the settings the full canvas was last painted from. */
  private drawnSig = "";
  private raycaster = new Raycaster();

  constructor(private settings: ComfortSettings) {
    this.full = makeCanvasSurface(FULL_W, FULL_H, FULL_METRES, 900);
    this.mini = makeCanvasSurface(MINI_W, MINI_H, MINI_METRES, 900);
    this.group.add(this.full.mesh, this.mini.mesh);
    this.group.visible = false;
    this.redraw();
  }

  // --- drawing ------------------------------------------------------------

  private redraw() {
    this.drawFull();
    this.drawMini();
    this.full.mesh.visible = !this.minimized;
    this.mini.mesh.visible = this.minimized;
  }

  private drawFull() {
    const ctx = this.full.ctx;
    this.fullHits = [];
    ctx.clearRect(0, 0, FULL_W, FULL_H);

    ctx.fillStyle = C.panel;
    roundRect(ctx, 0, 0, FULL_W, FULL_H, 26);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 3;
    ctx.stroke();

    // header
    ctx.fillStyle = C.header;
    roundRect(ctx, 0, 0, FULL_W, 84, 26);
    ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.font = "600 40px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("CONTROLS", 36, 44);

    // minimise button
    const mb: Rect = { x: FULL_W - 92, y: 20, w: 56, h: 44 };
    ctx.fillStyle = C.btn;
    roundRect(ctx, mb.x, mb.y, mb.w, mb.h, 10);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.fillRect(mb.x + 16, mb.y + mb.h / 2 - 2, 24, 4);
    this.fullHits.push({ ...mb, action: "minimize" });

    // binding rows
    ctx.textBaseline = "middle";
    let y = BINDINGS_TOP;
    for (const [key, action] of bindingRows(this.settings, this.mode)) {
      ctx.fillStyle = C.key;
      roundRect(ctx, 36, y - 24, 300, 48, 10);
      ctx.fill();
      ctx.strokeStyle = C.panelEdge;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = C.accent;
      // Hand-mode keys ("Pinch + hold") are longer than "B / Y" and would
      // otherwise run out of their pill.
      fitText(ctx, key, 268, 27, 20);
      ctx.fillText(key, 56, y);

      ctx.fillStyle = C.text;
      fitText(ctx, action, FULL_W - 402, 26, 21, "");
      ctx.fillText(action, 366, y);
      y += BINDING_PITCH;
    }

    // comfort toggles. Anchored to GRID_TOP, not to where the bindings ended.
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, GRID_TOP - 64);
    ctx.lineTo(FULL_W - 36, GRID_TOP - 64);
    ctx.stroke();

    ctx.fillStyle = C.dim;
    ctx.font = "600 23px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("COMFORT", 36, GRID_TOP - 28);

    // Naming the current input mode is not decoration: it is how a user whose
    // hand tracking silently dropped back to controllers (or the reverse) finds
    // out, rather than concluding the bindings list is wrong.
    ctx.textAlign = "right";
    ctx.fillStyle = C.dim;
    ctx.font = "21px sans-serif";
    ctx.fillText(
      this.mode === "hands"
        ? "Hand tracking"
        : this.mode === "mixed"
          ? "Controller + hand"
          : this.mode === "none"
            ? "No input detected"
            : "Controllers",
      FULL_W - 36,
      GRID_TOP - 28,
    );
    ctx.textAlign = "left";

    const s2 = this.settings;
    const grid: { label: string; on: boolean; action: PanelAction }[] = [
      {
        label: s2.turnStyle === "snap" ? `Turn: Snap ${s2.snapDegrees}\u00b0` : "Turn: Smooth",
        on: s2.turnStyle === "snap",
        action: "toggleTurn",
      },
      {
        label: s2.movementStyle === "teleport" ? "Move: Teleport" : "Move: Walk",
        on: s2.movementStyle === "teleport",
        action: "toggleMove",
      },
      {
        label: `Height: ${s2.verticalMove ? "On" : "Off"}`,
        on: s2.verticalMove,
        action: "toggleVertical",
      },
      {
        label: `Hazards: ${s2.hotspots ? "On" : "Off"}`,
        on: s2.hotspots,
        action: "toggleHotspots",
      },
      {
        label: `Vignette: ${s2.vignette ? "On" : "Off"}`,
        on: s2.vignette,
        action: "toggleVignette",
      },
      {
        label: `Hints: ${s2.controllerHints ? "On" : "Off"}`,
        on: s2.controllerHints,
        action: "toggleHints",
      },
      {
        label: `Haptics: ${s2.haptics ? "On" : "Off"}`,
        on: s2.haptics,
        action: "toggleHaptics",
      },
      { label: "Recentre view", on: false, action: "recentre" },
    ];

    grid.forEach((g, i) => {
      const r: Rect = {
        x: 36 + (i % GRID_COLS) * (BTN_W + BTN_GUTTER),
        y: GRID_TOP + Math.floor(i / GRID_COLS) * (BTN_H + BTN_GAP),
        w: BTN_W,
        h: BTN_H,
      };
      this.drawButton(ctx, r, g.label, g.on);
      this.fullHits.push({ ...r, action: g.action });
    });

    // Errors are otherwise invisible in a session: the DOM #status bar is hidden
    // on entry, so a scan that failed to load looked identical to one that was
    // still loading. Reserved space, so adding a message never reflows the panel.
    let fy = FULL_H - 112;
    if (this.errorText) {
      ctx.fillStyle = C.danger;
      ctx.font = "600 24px sans-serif";
      ctx.fillText(this.errorText.slice(0, 68), 36, fy);
    }
    fy += 30;

    if (this.diagnostics?.length) {
      ctx.font = "21px sans-serif";
      for (const line of this.diagnostics.slice(0, 3)) {
        // A leading "!" marks the verdict - the one line that says what is
        // actually wrong - so it gets the colour and the rest stay quiet.
        const loud = line.startsWith("!");
        ctx.fillStyle = loud ? C.caution : C.dim;
        ctx.font = `${loud ? "600 " : ""}21px sans-serif`;
        ctx.fillText((loud ? line.slice(1).trim() : line).slice(0, 96), 36, fy);
        fy += 27;
      }
    } else {
      ctx.fillStyle = C.dim;
      ctx.font = "22px sans-serif";
      ctx.fillText(
        this.mode === "hands"
          ? "Point with a hand and pinch to press a button."
          : "Point with a controller and pull the trigger to press a button.",
        36,
        fy,
      );
      ctx.fillText(
        "The Meta (O) button is the system menu - hold it to recentre your view.",
        36,
        fy + 32,
      );
    }

    this.full.tex.needsUpdate = true;
  }

  /** Surface a load/runtime failure inside the headset. Pass null to clear. */
  setError(text: string | null) {
    if (this.errorText === text) return;
    this.errorText = text;
    this.drawFull();
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    label: string,
    on: boolean,
  ) {
    ctx.fillStyle = on ? C.btnOn : C.btn;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = on ? C.accent : C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textBaseline = "middle";
    // Four columns are 223 px wide, and "Turn: Snap 45 deg" does not fit at 26.
    fitText(ctx, label, r.w - 32, 26, 18);
    ctx.fillText(label, r.x + 18, r.y + r.h / 2);
  }

  private drawMini() {
    const ctx = this.mini.ctx;
    this.miniHits = [];
    ctx.clearRect(0, 0, MINI_W, MINI_H);

    ctx.fillStyle = C.header;
    roundRect(ctx, 0, 0, MINI_W, MINI_H, 18);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = C.accent;
    ctx.font = "600 30px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("CONTROLS", 28, MINI_H / 2);

    ctx.fillStyle = C.dim;
    ctx.font = "23px sans-serif";
    ctx.fillText(
      this.mode === "hands"
        ? "turn a palm toward you, or point and pinch"
        : "press B / Y, or point and pull the trigger",
      210,
      MINI_H / 2,
    );

    this.miniHits.push({ x: 0, y: 0, w: MINI_W, h: MINI_H, action: "expand" });
    this.mini.tex.needsUpdate = true;
  }

  // --- state --------------------------------------------------------------

  get visible() {
    return this.group.visible;
  }

  /**
   * The mesh currently being displayed (full or minimised). Exposed so the
   * headless check can aim a ray at a known point on the panel without having
   * to re-derive its pose and canvas mapping from the outside - see
   * scripts/vr_check.mjs.
   */
  get surface(): Mesh {
    return this.minimized ? this.mini.mesh : this.full.mesh;
  }

  setSettings(s: ComfortSettings) {
    this.settings = s;
    // The walk-speed slider fires `input` continuously, and every tick used to
    // repaint a 1024x860 canvas and re-upload the texture for a value this panel
    // does not even show. Repaint only when something drawn here actually moved.
    this.repaintIfChanged();
  }

  /**
   * Tell the panel what the user is holding. Cheap to call every frame - it
   * repaints only when the answer changes.
   */
  setMode(mode: InputMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.repaintIfChanged();
  }

  /**
   * Show tracking diagnostics in place of the footer hints. Prefix a line with
   * "!" to mark it as the verdict.
   */
  setDiagnostics(lines: string[] | null) {
    const next = lines?.length ? lines : null;
    if (JSON.stringify(next) === JSON.stringify(this.diagnostics)) return;
    this.diagnostics = next;
    this.drawFull();
  }

  /**
   * Repaint only when something drawn here actually moved. The walk-speed slider
   * fires `input` continuously, and every tick used to re-upload a 1024x900
   * canvas for a value this panel does not even show.
   */
  private repaintIfChanged() {
    const s = this.settings;
    const sig = [
      s.turnStyle, s.snapDegrees, s.movementStyle, s.dominantHand,
      s.vignette, s.controllerHints, s.haptics, s.verticalMove, s.hotspots,
      this.mode,
    ].join("|");
    if (sig === this.drawnSig) return;
    this.drawnSig = sig;
    this.drawFull();
    this.drawMini();
  }

  show(camera: PerspectiveCamera, rig: Object3D) {
    this.place(camera, rig);
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /** Cycles full -> mini -> full. Returns the state it landed in. */
  toggle(camera: PerspectiveCamera, rig: Object3D): PanelState {
    if (this.group.visible && !this.minimized) {
      this.minimized = true;
      this.redraw();
      return "mini";
    }
    this.minimized = false;
    this.redraw();
    if (this.group.visible) this.place(camera, rig);
    else this.show(camera, rig);
    return "full";
  }

  /**
   * Drop the panel in front of the viewer at a comfortable height, facing them,
   * using yaw only - inheriting head pitch/roll would leave it visibly canted.
   */
  private place(camera: PerspectiveCamera, rig: Object3D) {
    const camPos = camera.getWorldPosition(new Vector3());
    const camQuat = camera.getWorldQuaternion(new Quaternion());

    // Yaw-only forward: if the user is looking at the floor when they open the
    // panel, it should still appear at eye level ahead of them, not on the ground.
    const fwd = new Vector3(0, 0, -1).applyQuaternion(camQuat);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();

    const target = camPos.clone().addScaledVector(fwd, PLACE_DISTANCE);
    target.y = PLACE_HEIGHT;

    // The group is parented to the rig, so convert into rig-local space.
    this.group.position.copy(rig.worldToLocal(target.clone()));

    // Face the viewer, level - aiming at the viewer's height rather than their
    // eyes keeps the panel upright instead of tipping back.
    //
    // WORLD space, not rig-local. Object3D.lookAt takes a WORLD-space target: it
    // reads the object's own position off matrixWorld and only converts the
    // RESULT back through the parent's rotation. Feeding it the rig-local camera
    // position mixed the two frames, and the error is exactly the rig's own
    // translation - which onEnterXr guarantees is non-zero, because it calls
    // recentre() (rig -> 0,0,4.5) immediately before showing the panel. The
    // panel came up rotated 180 degrees away from the user on EVERY VR entry,
    // and since the surface material is front-sided it rendered as nothing at
    // all. It only looked correct with the rig at the origin, which is the one
    // case a headless check happened to exercise.
    this.group.lookAt(camPos.x, target.y, camPos.z);
  }

  // --- interaction --------------------------------------------------------

  /**
   * Raycast a controller at the panel. Returns the action under the pointer, or
   * null. Callers use this both for hover and for trigger presses.
   */
  hitTest(controller: Object3D): PanelAction | null {
    if (!this.group.visible) return null;
    const mesh = this.minimized ? this.mini.mesh : this.full.mesh;
    const hits = this.minimized ? this.miniHits : this.fullHits;
    const w = this.minimized ? MINI_W : FULL_W;
    const h = this.minimized ? MINI_H : FULL_H;

    const origin = controller.getWorldPosition(new Vector3());
    const dir = new Vector3(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(new Quaternion()))
      .normalize();
    this.raycaster.set(origin, dir);

    const inter = this.raycaster.intersectObject(mesh, false)[0];
    if (!inter?.uv) return null;

    const uv: Vector2 = inter.uv;
    // Canvas Y runs down, UV runs up.
    const hit = hitAt(hits, uv.x * w, (1 - uv.y) * h);
    return hit ? hit.action : null;
  }

  /**
   * The painted hit rectangles for the surface on show, in canvas pixels.
   *
   * Exposed for the headless check, which used to hard-code this layout's
   * margins and pitches to work out where to aim. That duplication silently
   * rotted every time the panel was re-laid out - and it has just been re-laid
   * out, from a 3x2 grid to 4x2. Reading the rectangles back means the check
   * still exercises the real ray-to-action path without owning a second copy of
   * the layout.
   */
  get hitRegions(): (Rect & Hit)[] {
    return (this.minimized ? this.miniHits : this.fullHits).map((r) => ({ ...r }));
  }

  /** Canvas dimensions of the surface on show, to normalise those rectangles. */
  get surfaceSize(): { w: number; h: number } {
    return this.minimized
      ? { w: MINI_W, h: MINI_H }
      : { w: FULL_W, h: FULL_H };
  }

  /** Apply a press. Returns a settings patch for the caller to persist. */
  activate(action: PanelAction): Partial<ComfortSettings> | null {
    switch (action) {
      case "minimize":
        this.minimized = true;
        this.redraw();
        return null;
      case "expand":
        this.minimized = false;
        this.redraw();
        return null;
      case "toggleTurn":
        return { turnStyle: this.settings.turnStyle === "snap" ? "smooth" : "snap" };
      case "toggleMove":
        return {
          movementStyle: this.settings.movementStyle === "walk" ? "teleport" : "walk",
        };
      case "toggleVertical":
        return { verticalMove: !this.settings.verticalMove };
      case "toggleHotspots":
        return { hotspots: !this.settings.hotspots };
      case "toggleVignette":
        return { vignette: !this.settings.vignette };
      case "toggleHints":
        return { controllerHints: !this.settings.controllerHints };
      case "toggleHaptics":
        return { haptics: !this.settings.haptics };
      case "recentre":
        // Pure side effect, handled by the caller - there is no setting for it.
        return null;
    }
  }
}
