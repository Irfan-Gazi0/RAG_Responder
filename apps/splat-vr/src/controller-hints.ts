/**
 * The on-controller legend: one panel per hand, and the buttons themselves lit.
 *
 * The world-locked CONTROLS panel (help-panel.ts) answers "what are the
 * bindings", but it does so as a list you have to read and then map onto a device
 * you cannot see. This answers the more immediate question - "what does THIS
 * button do" - by lighting the three buttons that do something and naming them on
 * a small legend that rides above the controller.
 *
 * WHAT THIS REPLACED, AND WHY
 * ---------------------------
 * It used to be three labelled pills per hand, each with a leader line down to a
 * ring around its button. Two things were wrong with that:
 *
 *   - THE RINGS WERE PROXIES FOR THE BUTTONS. Positioning, orienting and sizing a
 *     ring so it sits convincingly on a button is work that can only be checked in
 *     a headset, and it was all in service of pointing at something the model
 *     already draws exactly. controller-models.ts now lights the button mesh
 *     itself, which is correct by construction on any profile and cannot drift.
 *
 *   - THE PILLS OVERLAPPED EACH OTHER. They were 0.115 m wide with centres 0.111,
 *     0.120 and 0.196 m apart, they billboarded INDEPENDENTLY, and they shared
 *     renderOrder 950 with depthTest off. Sighting down the controller's own axis
 *     - which is what you do every time you point at something and then glance at
 *     your hand - projected the trigger and B/Y pills straight on top of one
 *     another. One panel cannot overlap itself.
 *
 * WHY THE TEXT IS SDF AND NOT A CANVAS
 * ------------------------------------
 * A 2D canvas at this size is not short of resolution - the old pills carried 512
 * px across 0.115 m, which is roughly twice the device pixels a Quest 3 actually
 * spends on them at fbscale 0.8. The problem is the other end: a ~2x MINIFICATION
 * with mipmaps disabled (canvas-ui.ts turns them off on purpose, because a
 * world-locked panel is read at glancing angles and mipmapped text there is mush)
 * aliases every glyph edge, and reprojection makes it shimmer. Signed-distance-field
 * glyphs are resolution-independent, so the question stops being "which
 * compromise". The panel's background chrome is still a canvas - it carries no
 * text, so it can be mipmapped freely, which is what the new `filter` argument to
 * makeCanvasSurface is for.
 *
 * THREE THINGS DELIBERATELY KEPT FROM THE OLD MODULE
 * --------------------------------------------------
 *   - Parented to the GRIP space, not the target-ray space. Grip tracks the
 *     physical device (three's own docs: "use this space for visualizing 3D
 *     objects ... in the user's hand"); the ray space is tilted ~45 deg below the
 *     handle and is where the pointer line belongs, not the hardware.
 *   - Screen-ALIGNED, not look-at-the-eye. A panel that merely faces the head
 *     position still gets sheared and visibly rolled by the projection once it
 *     sits off-axis - which is exactly where this lives, down at hand height.
 *     Matching the head's orientation keeps the text flat-on and level in both
 *     eyes no matter where the hand is.
 *   - Self-retiring. A row greys out the first time you use the control it
 *     describes, the panel leaves once all three are used or the timer runs out,
 *     and B/Y brings it back. The scene does not stay permanently annotated.
 *
 * ACCESSIBILITY: the glow alone would be colour-only feedback, which ~8% of male
 * users cannot rely on. Every row therefore NAMES its physical control in text,
 * and the capacitive-touch highlight (resting a thumb on the stick lights its row)
 * is a second, non-colour channel carrying the same mapping the leader lines used
 * to.
 */
import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  WebGLRenderer,
} from "three";
import { Text } from "troika-three-text";
import { C, makeCanvasSurface, roundRect, type CanvasSurface } from "./canvas-ui";
import type { ControllerModels } from "./controller-models";
import type { ComfortSettings, Handedness, VrControl } from "./vr-input";

/**
 * Vendored, never the CDN. troika defaults to fetching Roboto from a public host
 * and, like XRControllerModelFactory's jsdelivr default, fails by quietly
 * rendering nothing - the precise failure class this project keeps losing days
 * to. Bold only: thick strokes survive a low pixels-per-degree budget better than
 * regular, and one weight halves what ships.
 */
const FONT = "./fonts/LiberationSans-Bold.ttf";

/**
 * Em size in metres. Liberation Sans caps are ~0.72 em, so this is a ~9.4 mm cap
 * height - about 1.2 degrees of arc at the 0.45 m a controller is typically held
 * at, comfortably over the 1.0 degree floor for VR text. (The pills it replaces
 * were 0.95 degrees at the same distance, i.e. marginally under it.)
 * vr_check.mjs asserts this from troika's own laid-out metrics rather than from
 * this constant, so a font swap cannot quietly shrink it.
 */
const FONT_SIZE = 0.0125;

/** Row pitch and inner padding, metres. */
const ROW_PITCH = 0.0195;
const PAD_X = 0.011;
const PAD_Y = 0.010;
/** Dot radius and the gap between it and the text. */
const DOT_R = 0.0035;
const DOT_GAP = 0.009;

/** Default height above the grip. Overridable with ?hintpos= - only a headset
 *  can settle whether this clears the hand without covering the car. */
const DEFAULT_Y = 0.105;
const OFFSET_Z = -0.02;

/** Seconds the untouched legend stays up before retiring itself. */
const SHOW_SECONDS = 22;
/** Fade rate; asymmetric so it appears promptly and leaves gently. */
const FADE_IN = 7;
const FADE_OUT = 3;

/** Standing brightness for a button nobody is touching, versus one they are. */
const GLOW_IDLE = 0.35;
const GLOW_TOUCHED = 1;

/** Chrome canvas. No glyphs on it, so it can be mipmapped without going mushy. */
const BG_W = 320;

type RowSpec = {
  control: VrControl;
  /** The glTF button node this row lights, per hand. */
  node: Record<Handedness, string>;
  /** What the row calls the control. Named in TEXT so the glow is never the
   *  only channel carrying the mapping. */
  key: Record<Handedness, string>;
};

const ROWS: RowSpec[] = [
  {
    control: "trigger",
    node: { right: "trigger", left: "trigger" },
    key: { right: "Trigger", left: "Trigger" },
  },
  {
    control: "stick",
    node: { right: "thumbstick", left: "thumbstick" },
    key: { right: "Stick", left: "Stick" },
  },
  {
    control: "secondary",
    node: { right: "b_button", left: "y_button" },
    key: { right: "B", left: "Y" },
  },
];

type Row = {
  control: VrControl;
  node: string;
  text: Text;
  dot: Mesh;
  label: string;
  /** Retired because the user has now used this control. */
  used: boolean;
  touched: boolean;
};

type HandRig = {
  hand: Handedness;
  group: Group;
  bg: CanvasSurface;
  rows: Row[];
  /** Panel size in metres, recomputed from troika's laid-out text. */
  w: number;
  h: number;
  /** Fade state, per hand: the two panels say different things, so one hand
   *  finishing its three controls must not take the other's away. */
  alpha: number;
  target: number;
};

export class ControllerHints {
  private rigs: Record<Handedness, HandRig>;
  private grips: ReturnType<WebGLRenderer["xr"]["getControllerGrip"]>[] = [];
  /** Which rig is currently parented to each grip index, if any. */
  private attached: (Handedness | null)[] = [null, null];

  private remaining = 0;
  private camQuat = new Quaternion();
  private parentInv = new Quaternion();
  private offsetY: number;
  private anisotropy: number;

  constructor(
    renderer: WebGLRenderer,
    playerRig: Group,
    private settings: ComfortSettings,
    private models?: ControllerModels,
    offsetY = DEFAULT_Y,
  ) {
    this.offsetY = offsetY;
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.rigs = { left: this.buildRig("left"), right: this.buildRig("right") };
    this.refreshLabels();

    // Grip spaces must hang off the player rig, like the ray spaces do, or the
    // legend would be left standing where the user started once they walk away.
    for (let i = 0; i < 2; i++) {
      const grip = renderer.xr.getControllerGrip(i);
      playerRig.add(grip);
      this.grips.push(grip);

      grip.addEventListener("connected", (event) => {
        const src = event.data;
        // Hand tracking has a grip space too, but no buttons to name.
        if (!src || src.hand) return;
        if (src.handedness !== "left" && src.handedness !== "right") return;
        this.attach(i, src.handedness);
      });
      grip.addEventListener("disconnected", () => this.detach(i));
    }
  }

  // --- construction -------------------------------------------------------

  private buildRig(hand: Handedness): HandRig {
    const group = new Group();
    group.visible = false;

    // Sized properly in layout(), once troika has told us how wide the longest
    // row actually is. Guessing it from a per-character advance is exactly the
    // kind of font-metric assumption that breaks on a font swap.
    const bg = makeCanvasSurface(BG_W, 128, 0.2, 946, {
      mipmaps: true,
      anisotropy: this.anisotropy,
    });
    (bg.mesh.material as MeshBasicMaterial).opacity = 0;
    group.add(bg.mesh);

    const rows = ROWS.map((spec) => {
      const text = new Text();
      text.font = FONT;
      text.fontSize = FONT_SIZE;
      text.anchorX = "left";
      text.anchorY = "middle";
      text.color = C.text;
      text.fillOpacity = 0;
      // Assigning a base material is troika's documented way to control depth
      // and blending; it derives its SDF shader from whatever it is given. The
      // scan is a dense point cloud and would otherwise chew holes in the text.
      text.material = new MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      text.renderOrder = 948;
      group.add(text);

      const dot = new Mesh(
        bgDotGeometry(),
        new MeshBasicMaterial({
          color: C.accent,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          opacity: 0,
        }),
      );
      dot.renderOrder = 947;
      group.add(dot);

      return {
        control: spec.control,
        node: spec.node[hand],
        text,
        dot,
        label: "",
        used: false,
        touched: false,
      } satisfies Row;
    });

    group.position.set(0, this.offsetY, OFFSET_Z);
    return { hand, group, bg, rows, w: 0.2, h: 0.075, alpha: 0, target: 0 };
  }

  // --- labels -------------------------------------------------------------

  /**
   * Which stick does what depends on the handedness setting, so the text is
   * derived rather than baked in - a left-handed user who flips the setting has
   * to see the labels flip with it or they are worse than no labels at all.
   */
  private labelFor(hand: Handedness, control: VrControl): string {
    switch (control) {
      case "stick":
        // The turn stick does two things on two axes, and this is the only place
        // a user finds out about the second one - the panel is minimised by
        // default after the first session.
        if (hand === this.settings.dominantHand) {
          return this.settings.verticalMove ? "Turn / rise" : "Turn";
        }
        // Same stick, entirely different gesture - a label reading "Walk" on a
        // stick that teleports is worse than no label.
        return this.settings.movementStyle === "teleport"
          ? "Push to teleport"
          : "Walk / strafe";
      case "trigger":
        return "Select / hazards";
      case "secondary":
        return "Controls panel";
    }
  }

  private refreshLabels() {
    let dirty = false;
    for (const rig of [this.rigs.left, this.rigs.right]) {
      rig.rows.forEach((row, i) => {
        const label = `${ROWS[i].key[rig.hand]}  ${this.labelFor(rig.hand, row.control)}`;
        if (label === row.label) return;
        row.label = label;
        row.text.text = label;
        dirty = true;
      });
    }
    if (dirty) {
      for (const rig of [this.rigs.left, this.rigs.right]) this.layout(rig);
    }
  }

  /**
   * Size the panel to the text, rather than the text to a guessed panel.
   *
   * troika lays out asynchronously, so every row is synced and the widest block
   * measured before the background is drawn. Doing it the other way round means
   * either a hardcoded per-character advance (wrong the moment the font changes)
   * or a panel with slack in it.
   */
  private layout(rig: HandRig) {
    let pending = rig.rows.length;
    for (const row of rig.rows) {
      row.text.sync(() => {
        if (--pending > 0) return;

        let widest = 0;
        for (const r of rig.rows) {
          const b = r.text.textRenderInfo?.blockBounds;
          if (b) widest = Math.max(widest, b[2] - b[0]);
        }

        const textX = -0.5 * (widest + DOT_R * 2 + DOT_GAP) + DOT_R * 2 + DOT_GAP;
        rig.w = widest + DOT_R * 2 + DOT_GAP + PAD_X * 2;
        rig.h = rig.rows.length * ROW_PITCH + PAD_Y * 2;

        rig.rows.forEach((r, i) => {
          const y = ((rig.rows.length - 1) / 2 - i) * ROW_PITCH;
          r.text.position.set(textX, y, 0.0004);
          r.dot.position.set(textX - DOT_GAP - DOT_R, y, 0.0004);
        });

        this.drawBackground(rig);
      });
    }
  }

  /**
   * The chrome: a rounded panel with an accent edge, and nothing else.
   *
   * Redrawn at the panel's own aspect rather than stretched from a square, so
   * the corner radius stays circular instead of going oval as the text length
   * changes the width.
   */
  private drawBackground(rig: HandRig) {
    const h = Math.max(1, Math.round((BG_W * rig.h) / rig.w));
    if (rig.bg.canvas.height !== h) rig.bg.canvas.height = h;

    const ctx = rig.bg.ctx;
    ctx.clearRect(0, 0, BG_W, h);
    const r = Math.min(BG_W, h) * 0.22;
    roundRect(ctx, 3, 3, BG_W - 6, h - 6, r);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 4;
    ctx.stroke();
    rig.bg.tex.needsUpdate = true;

    rig.bg.mesh.geometry.dispose();
    rig.bg.mesh.geometry = planeFor(rig.w, rig.h);
  }

  // --- attachment ---------------------------------------------------------

  private attach(index: number, hand: Handedness) {
    if (this.attached[index] === hand) return;
    this.detach(index);
    this.grips[index].add(this.rigs[hand].group);
    this.attached[index] = hand;
  }

  private detach(index: number) {
    const hand = this.attached[index];
    if (!hand) return;
    this.grips[index].remove(this.rigs[hand].group);
    this.attached[index] = null;
  }

  // --- state --------------------------------------------------------------

  setSettings(s: ComfortSettings) {
    const wasEnabled = this.settings.controllerHints;
    this.settings = s;
    this.refreshLabels();
    if (!s.controllerHints) this.hide();
    else if (!wasEnabled) this.show();
  }

  /** Bring the legend back and restart the retirement timer. */
  show() {
    if (!this.settings.controllerHints) return;
    this.remaining = SHOW_SECONDS;
    for (const rig of [this.rigs.left, this.rigs.right]) {
      rig.group.visible = true;
      rig.target = 1;
      for (const row of rig.rows) row.used = false;
    }
  }

  hide() {
    this.remaining = 0;
    for (const rig of [this.rigs.left, this.rigs.right]) {
      rig.group.visible = false;
      rig.target = 0;
      rig.alpha = 0;
      this.applyAlpha(rig);
      for (const row of rig.rows) this.models?.setGlow(rig.hand, row.node, 0);
    }
  }

  /**
   * Grey out one row because the user just did the thing it describes, and
   * retire the panel once every row has been used. Called on the rising edge
   * only, so it does not race the B/Y press that re-shows it.
   */
  markUsed(hand: Handedness, control: VrControl) {
    const rig = this.rigs[hand];
    for (const row of rig.rows) {
      if (row.control === control) row.used = true;
    }
    // Retires PER HAND. The two panels say different things - the sticks do
    // different jobs - so a user who has worked through the right hand should
    // not lose the left hand's instructions before reading them. It also means
    // one connected controller can still retire on its own, rather than being
    // held up waiting for a hand that will never report.
    if (rig.rows.every((row) => row.used)) rig.target = 0;
  }

  /**
   * `touched` is the capacitive state of each control, which on Touch hardware
   * covers all three of the ones named here. It is what replaces the leader
   * lines: rest a thumb on the stick and the stick's own row lights up, so the
   * mapping needs no colour key and no line crossing the view.
   */
  update(
    dt: number,
    camera: PerspectiveCamera,
    touched?: (hand: Handedness) => ReadonlySet<VrControl>,
  ) {
    if (this.remaining > 0) {
      this.remaining -= dt;
      if (this.remaining <= 0) {
        for (const rig of [this.rigs.left, this.rigs.right]) rig.target = 0;
      }
    }

    camera.getWorldQuaternion(this.camQuat);

    for (const rig of [this.rigs.left, this.rigs.right]) {
      if (!rig.group.visible) continue;

      const k = rig.target > rig.alpha ? FADE_IN : FADE_OUT;
      rig.alpha += (rig.target - rig.alpha) * Math.min(1, k * dt);
      if (rig.alpha < 0.01 && rig.target === 0) rig.alpha = 0;

      const live = touched?.(rig.hand);
      for (const row of rig.rows) row.touched = live?.has(row.control) ?? false;

      if (rig.alpha === 0 && rig.target === 0) {
        rig.group.visible = false;
        for (const row of rig.rows) this.models?.setGlow(rig.hand, row.node, 0);
        continue;
      }

      // getWorldQuaternion refreshes the parent chain, so this picks up the grip
      // pose written by the current XR frame rather than the last one.
      rig.group.getWorldQuaternion(this.parentInv).invert();
      // World orientation := head orientation, expressed in grip-local space, so
      // wrist roll cannot tip the text over.
      rig.group.quaternion.copy(this.parentInv).multiply(this.camQuat);

      this.applyAlpha(rig);

      for (const row of rig.rows) {
        const level = row.used ? 0 : row.touched ? GLOW_TOUCHED : GLOW_IDLE;
        this.models?.setGlow(rig.hand, row.node, level * rig.alpha);
      }
    }
  }

  /**
   * What the headless check can measure of the legend without a headset.
   *
   * The numbers come from troika's OWN laid-out metrics, not from the constants
   * above: the point is to catch a font that silently failed to load (troika
   * falls back rather than throwing) or a metric change that quietly shrinks the
   * text below the angular size a person can read at arm's length. Asserting
   * FONT_SIZE against itself would prove nothing.
   */
  metrics() {
    const rig = this.rigs.right;
    return {
      font: FONT,
      fontSize: FONT_SIZE,
      panel: { w: rig.w, h: rig.h },
      offsetY: this.offsetY,
      rows: rig.rows.map((r) => {
        const vb = r.text.textRenderInfo?.visibleBounds;
        const bb = r.text.textRenderInfo?.blockBounds;
        return {
          label: r.label,
          laidOut: !!bb,
          width: bb ? bb[2] - bb[0] : 0,
          inkHeight: vb ? vb[3] - vb[1] : 0,
        };
      }),
    };
  }

  private applyAlpha(rig: HandRig) {
    const a = rig.alpha;
    (rig.bg.mesh.material as MeshBasicMaterial).opacity = a * 0.92;
    rig.bg.mesh.visible = a > 0;
    for (const row of rig.rows) {
      // A used row stays legible but stops competing for attention; a touched
      // one takes the accent so the pairing with the lit button is unmissable.
      row.text.color = row.used ? C.dim : row.touched ? C.accent : C.text;
      row.text.fillOpacity = a * (row.used ? 0.45 : 1);
      row.text.visible = a > 0;
      const dm = row.dot.material as MeshBasicMaterial;
      dm.opacity = a * (row.used ? 0.25 : row.touched ? 1 : 0.7);
      row.dot.visible = a > 0;
      row.dot.scale.setScalar(row.touched ? 1.35 : 1);
    }
  }
}

// --- small shared geometry --------------------------------------------------

/** One circle for all six dots, rather than six identical geometries. */
let DOT_GEO: CircleGeometry | null = null;
function bgDotGeometry(): CircleGeometry {
  if (!DOT_GEO) DOT_GEO = new CircleGeometry(DOT_R, 16);
  return DOT_GEO;
}

function planeFor(w: number, h: number): PlaneGeometry {
  return new PlaneGeometry(w, h);
}
