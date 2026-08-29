/**
 * Controller-attached instruction callouts - the YouTube-VR pattern.
 *
 * The world-locked CONTROLS panel (help-panel.ts) answers "what are the
 * bindings", but it does so as a list you have to read and then map onto a
 * device you cannot see. This answers the more immediate question - "what does
 * THIS button do" - by hanging a labelled pill in the air next to each control,
 * with a leader line down to a ring drawn around the button itself. The labels
 * ride the controller, so the answer is wherever your hand is.
 *
 * Three design points worth keeping:
 *
 *   - Parented to the GRIP space, not the target-ray space. Grip tracks the
 *     physical device (three's own docs: "use this space for visualizing 3D
 *     objects ... in the user's hand"); the ray space is tilted ~45 deg below
 *     the handle and is where the pointer line belongs, not the hardware.
 *   - The pills billboard toward the head but keep world up, so rolling your
 *     wrist re-aims the text at you instead of turning it upside down.
 *   - They are self-retiring. Each pill fades the first time you use the
 *     control it describes, and whatever is left fades on a timer, so the
 *     scene does not stay permanently annotated. B/Y (which opens the full
 *     panel) brings them all back.
 *
 * ANCHOR GEOMETRY: the offsets below are the Touch Plus / Touch v3 button
 * positions in grip space, in metres, for the RIGHT hand; the left hand mirrors
 * X. Grip space is +Y out of the top face (thumbstick side), -Z along the
 * handle's forward axis, +X to the right - confirmed against the gripOffsetMatrix
 * in the WebXR device profile for oculus-touch-v3, which places the target ray
 * 45 deg below grip -Z. They are eyeballed to the hardware, not measured off a
 * model, so if a ring sits visibly off its button on device, tune LAYOUT.
 */
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LinearFilter,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { C as PALETTE } from "./help-panel";
import type { ComfortSettings, Handedness, VrControl } from "./vr-input";

const CARD_W = 512;
const CARD_H = 128;
/** Pill width in metres; height follows the canvas aspect (~2.9 cm tall). */
const CARD_METRES = 0.115;

/** Seconds the untouched hints stay up before retiring themselves. */
const SHOW_SECONDS = 22;
/** Fade rate; asymmetric so they appear promptly and leave gently. */
const FADE_IN = 7;
const FADE_OUT = 3;

type HintSpec = {
  control: VrControl;
  /** Button centre, grip-local metres (right hand; X mirrored for left). */
  anchor: [number, number, number];
  /** X-rotation that lays the ring flat on the face this button lives on. */
  ringPitch: number;
  /** Pill centre, grip-local metres (right hand; X mirrored for left). */
  card: [number, number, number];
};

const LAYOUT: HintSpec[] = [
  // Index trigger: on the front underside, so its ring faces forward-and-down
  // and the pill hangs off the nose of the controller.
  {
    control: "trigger",
    anchor: [0, -0.012, -0.052],
    ringPitch: (Math.PI * 3) / 4,
    card: [0.115, 0.012, -0.118],
  },
  // Thumbstick and the face buttons share the top face, normal +Y.
  {
    control: "stick",
    anchor: [0, 0.026, -0.03],
    ringPitch: -Math.PI / 2,
    card: [0.152, 0.082, -0.04],
  },
  {
    control: "secondary",
    anchor: [0.009, 0.023, 0.018],
    ringPitch: -Math.PI / 2,
    card: [0.115, 0.058, 0.072],
  },
];

type HintItem = {
  control: VrControl;
  card: Mesh;
  ring: Mesh;
  line: Line;
  ctx: CanvasRenderingContext2D;
  tex: CanvasTexture;
  label: string;
  alpha: number;
  target: number;
};

type HandRig = {
  hand: Handedness;
  group: Group;
  items: HintItem[];
};

export class ControllerHints {
  private rigs: Record<Handedness, HandRig>;
  private grips: ReturnType<WebGLRenderer["xr"]["getControllerGrip"]>[] = [];
  /** Which rig is currently parented to each grip index, if any. */
  private attached: (Handedness | null)[] = [null, null];

  private remaining = 0;
  private camQuat = new Quaternion();
  private parentInv = new Quaternion();

  constructor(
    renderer: WebGLRenderer,
    playerRig: Group,
    private settings: ComfortSettings,
  ) {
    this.rigs = { left: this.buildRig("left"), right: this.buildRig("right") };
    this.refreshLabels();

    // Grip spaces must hang off the player rig, like the ray spaces do, or the
    // hints would be left standing where the user started once they walk away.
    for (let i = 0; i < 2; i++) {
      const grip = renderer.xr.getControllerGrip(i);
      playerRig.add(grip);
      this.grips.push(grip);

      grip.addEventListener("connected", (event) => {
        const src = event.data;
        // Hand tracking has a grip space too, but no buttons to point at.
        if (!src || src.hand) return;
        if (src.handedness !== "left" && src.handedness !== "right") return;
        this.attach(i, src.handedness);
      });
      grip.addEventListener("disconnected", () => this.detach(i));
    }
  }

  // --- construction -------------------------------------------------------

  private buildRig(hand: Handedness): HandRig {
    const side = hand === "left" ? -1 : 1;
    const group = new Group();
    group.visible = false;

    const items = LAYOUT.map((spec) => {
      const anchor = new Vector3(spec.anchor[0] * side, spec.anchor[1], spec.anchor[2]);
      const card = new Vector3(spec.card[0] * side, spec.card[1], spec.card[2]);

      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter; // no mipmaps - these are read head-on

      const cardMesh = new Mesh(
        new PlaneGeometry(CARD_METRES, (CARD_METRES * CARD_H) / CARD_W),
        new MeshBasicMaterial({
          map: tex,
          transparent: true,
          // The scan is a dense point cloud; without this the labels would be
          // chewed up by whatever splats happen to be behind your hand.
          depthTest: false,
          opacity: 0,
        }),
      );
      cardMesh.position.copy(card);

      const ringMesh = new Mesh(
        new RingGeometry(0.0075, 0.0105, 24),
        new MeshBasicMaterial({
          color: PALETTE.accent,
          transparent: true,
          depthTest: false,
          opacity: 0,
          // The trigger ring faces away from the wearer by construction, so a
          // front-sided material would cull it exactly when it is wanted.
          side: DoubleSide,
        }),
      );
      ringMesh.position.copy(anchor);
      ringMesh.rotation.x = spec.ringPitch;

      const line = new Line(
        new BufferGeometry().setAttribute(
          "position",
          new Float32BufferAttribute(
            [anchor.x, anchor.y, anchor.z, card.x, card.y, card.z],
            3,
          ),
        ),
        new LineBasicMaterial({
          color: PALETTE.accent,
          transparent: true,
          depthTest: false,
          opacity: 0,
        }),
      );

      // The pill draws last and is opaque, so the leader line visually stops at
      // its edge with no need to shorten the segment.
      line.renderOrder = 948;
      ringMesh.renderOrder = 949;
      cardMesh.renderOrder = 950;
      group.add(line, ringMesh, cardMesh);

      return {
        control: spec.control,
        card: cardMesh,
        ring: ringMesh,
        line,
        ctx: canvas.getContext("2d")!,
        tex,
        label: "",
        alpha: 0,
        target: 0,
      } satisfies HintItem;
    });

    return { hand, group, items };
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
        // The turn stick now does two things on two axes, and the callout is
        // the only place a user finds out about the second one - the panel is
        // minimised by default after the first session.
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
    for (const rig of [this.rigs.left, this.rigs.right]) {
      for (const item of rig.items) {
        const label = this.labelFor(rig.hand, item.control);
        if (label === item.label) continue;
        item.label = label;
        this.drawCard(item);
      }
    }
  }

  private drawCard(item: HintItem) {
    const ctx = item.ctx;
    ctx.clearRect(0, 0, CARD_W, CARD_H);

    const r = 30;
    ctx.beginPath();
    ctx.moveTo(4 + r, 4);
    ctx.arcTo(CARD_W - 4, 4, CARD_W - 4, CARD_H - 4, r);
    ctx.arcTo(CARD_W - 4, CARD_H - 4, 4, CARD_H - 4, r);
    ctx.arcTo(4, CARD_H - 4, 4, 4, r);
    ctx.arcTo(4, 4, CARD_W - 4, 4, r);
    ctx.closePath();
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Accent dot, echoing the ring down at the button end of the leader line.
    ctx.beginPath();
    ctx.arc(46, CARD_H / 2, 11, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.accent;
    ctx.fill();

    // Shrink to fit rather than clip: these strings are localisable-ish and a
    // truncated instruction is worse than a slightly smaller one.
    let size = 46;
    ctx.font = `600 ${size}px sans-serif`;
    while (ctx.measureText(item.label).width > CARD_W - 110 && size > 26) {
      size -= 2;
      ctx.font = `600 ${size}px sans-serif`;
    }
    ctx.fillStyle = PALETTE.text;
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, 76, CARD_H / 2 + 2);

    item.tex.needsUpdate = true;
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

  /** Bring every hint back and restart the retirement timer. */
  show() {
    if (!this.settings.controllerHints) return;
    this.remaining = SHOW_SECONDS;
    for (const rig of [this.rigs.left, this.rigs.right]) {
      rig.group.visible = true;
      for (const item of rig.items) item.target = 1;
    }
  }

  hide() {
    this.remaining = 0;
    for (const rig of [this.rigs.left, this.rigs.right]) {
      rig.group.visible = false;
      for (const item of rig.items) {
        item.target = 0;
        item.alpha = 0;
        this.applyAlpha(item);
      }
    }
  }

  /**
   * Retire one hint because the user just did the thing it describes. Called on
   * the rising edge only, so it does not race the B/Y press that re-shows them.
   */
  markUsed(hand: Handedness, control: VrControl) {
    for (const item of this.rigs[hand].items) {
      if (item.control === control) item.target = 0;
    }
  }

  update(dt: number, camera: PerspectiveCamera) {
    if (this.remaining > 0) {
      this.remaining -= dt;
      if (this.remaining <= 0) {
        for (const rig of [this.rigs.left, this.rigs.right]) {
          for (const item of rig.items) item.target = 0;
        }
      }
    }

    // Screen-aligned, not look-at-the-eye. A pill that merely faces the head
    // position still gets sheared and visibly rolled by the projection once it
    // sits off-axis - which is exactly where these live, down at hand height.
    // Matching the head's orientation keeps the text flat-on and level in both
    // eyes no matter where the hand is.
    camera.getWorldQuaternion(this.camQuat);

    for (const rig of [this.rigs.left, this.rigs.right]) {
      if (!rig.group.visible) continue;
      let anyVisible = false;
      // getWorldQuaternion refreshes the parent chain, so this picks up the
      // grip pose written by the current XR frame rather than the last one.
      rig.group.getWorldQuaternion(this.parentInv).invert();

      for (const item of rig.items) {
        const k = item.target > item.alpha ? FADE_IN : FADE_OUT;
        item.alpha += (item.target - item.alpha) * Math.min(1, k * dt);
        if (item.alpha < 0.01) item.alpha = 0;
        // Fading IN counts as visible even at alpha 0: the first frame after
        // show() can carry dt 0, and retiring the group on that frame would
        // hide the hints forever.
        if (item.alpha > 0 || item.target > 0) {
          anyVisible = true;
          // World orientation := head orientation, expressed in grip-local
          // space, so wrist roll cannot tip the text over.
          item.card.quaternion.copy(this.parentInv).multiply(this.camQuat);
        }
        this.applyAlpha(item);
      }

      if (!anyVisible) rig.group.visible = false;
    }
  }

  private applyAlpha(item: HintItem) {
    const a = item.alpha;
    (item.card.material as MeshBasicMaterial).opacity = a;
    (item.ring.material as MeshBasicMaterial).opacity = a * 0.9;
    (item.line.material as LineBasicMaterial).opacity = a * 0.55;
    item.card.visible = a > 0;
    item.ring.visible = a > 0;
    item.line.visible = a > 0;
  }
}
