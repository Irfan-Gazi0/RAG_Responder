/**
 * The info card that opens when a hazard marker is selected.
 *
 * Same canvas-on-a-quad technique as the controls panel (see canvas-ui.ts), with
 * three differences that matter:
 *
 *   - It billboards by copying the HEAD'S ORIENTATION rather than by lookAt().
 *     A card placed off to one side and pointed at the camera position gets
 *     visibly sheared and rolled by the projection; matching the head's
 *     orientation keeps the text flat-on in both eyes. controller-hints.ts
 *     learned this the hard way and this follows it.
 *   - IT OPENS AT A DISTANCE MEASURED FROM YOUR HEAD, NOT FROM THE MARKER.
 *     See READ_DISTANCE - this is the whole reason the card was unreadable in
 *     the headset, and it is worth understanding before anyone "simplifies" it
 *     back. It also removed the desktop-only angular scaling, which existed
 *     solely to paper over the old placement.
 *   - Its hit regions are pushed during the draw, so the painted close button
 *     and the rectangle the ray tests against cannot drift apart.
 *
 * An unverified marker gets a banner saying so. The card text is quoted from the
 * manufacturer's Emergency Response Guide and is trustworthy; the position of
 * the marker it hangs off is an estimate until an operator confirms it, and a
 * card that looks authoritative about a cut point nobody checked is worse than
 * no card.
 */
import {
  Group,
  type Material,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  C,
  hitAt,
  makeCanvasSurface,
  roundRect,
  fitText,
  wrapText,
  type CanvasSurface,
  type Rect,
} from "./canvas-ui";
import type { Hotspot, Severity } from "./hotspots-data";

const W = 880;
const H = 620;
/** Card width in metres. Sized to be readable at the distance it opens at. */
const METRES = 0.62;
/** Card height in metres, following the canvas aspect. Sets the drop angle. */
const QUAD_H = (METRES * H) / W;
/** Above the markers (850), below the controls panel (900). */
const RENDER_ORDER = 880;

/**
 * WHERE THE CARD OPENS, MEASURED FROM THE HEAD - not from the marker.
 *
 * This used to be a standoff from the MARKER: the card was pushed 0.45 m out of
 * the bodywork toward the viewer and, inside XR, pinned to scale 1. That is
 * correct only if you are already standing at the car. Point at a marker from
 * across the workshop - which the ray happily lets you do, the hit test is an
 * unbounded ray/sphere - and the card opened three metres away, where its 26 px
 * body text on an 880 px canvas painted 0.62 m wide subtends about 25 arcmin.
 * On a Quest 3 at frameBufferScaleFactor 0.8 that is roughly SIX PIXELS of
 * glyph height, below any legibility threshold, and with no mipmaps (see
 * canvas-ui.ts) what few pixels there were aliased into noise.
 *
 * The card now opens along your line of sight to the marker at a distance you
 * can actually read, so its angular size no longer depends on where you were
 * standing when you pressed. Text lands at ~52 arcmin, comfortably above Meta's
 * ~20 arcmin floor, and the card keeps its true physical size - a world-locked
 * surface that resizes as you walk toward it reads as a bug, which is why this
 * is a placement fix and not a scale fix.
 *
 * It also removes the failure at the near end: the old standoff collapsed to
 * zero below 0.55 m, putting the quad exactly on the marker, straddling your
 * face and clipping the 0.1 m near plane. `d` can no longer go below
 * MIN_READ_DISTANCE.
 */
const READ_DISTANCE = 1.2;
/** Never closer than this, however close you are standing to the part. */
const MIN_READ_DISTANCE = 0.55;
/** ...and keep it off the bodywork when you are right up against the car. */
const MARKER_CLEARANCE = 0.25;

/**
 * How far BELOW your line of sight to the marker the card is dropped.
 *
 * Placing it on the sight line is the obvious thing and it is wrong: at reading
 * distance the card subtends about 29 x 21 degrees, so a card centred on the
 * marker hides the exact part the card is describing. Dropping it by a little
 * more than its own half-height leaves the marker sitting just above the card's
 * top edge, both in view at once, which is the whole point of pinning hazard
 * copy to a scan rather than printing it.
 *
 * The angle is DERIVED from the card's own half-height at the distance it
 * actually opened at, plus this much clear air, rather than being a tuned
 * constant - resize the card or change READ_DISTANCE and the marker still
 * clears its top edge. It grows as you approach, which is correct: a card at
 * 0.55 m fills far more of your view than one at 1.2 m and has further to move.
 *
 * Applied as a ROTATION of the sight-line direction rather than a translation,
 * so the card's distance from the head stays exactly the reading distance that
 * was just computed.
 *
 * A leader line back to the marker was tried and removed. The card is placed on
 * the sight line, so the line is near-degenerate in screen space and what
 * little of it projects lands behind the card that draws over it; a WebGL
 * LineBasicMaterial is a one-pixel hairline whatever `linewidth` says, which on
 * a headset is a shimmering non-thing. The clear gap above the card carries the
 * association instead, and costs no geometry.
 */
const CLEARANCE_DEGREES = 3.7;

/** Body-text layout. See `draw()` - the block is wrapped and shrunk to fit. */
const BODY_TOP = 142;
const BODY_LEFT = 30;
const BODY_MAX_WIDTH = W - 60;
const BODY_MAX_PX = 26;
const BODY_MIN_PX = 19;
const LINE_RATIO = 1.38;
/** Top of the unverified banner, and of the source/footer block below it. */
const BANNER_TOP = H - 118;
const FOOTER_TOP = H - 76;
/** Clear air between the end of the body and whatever comes next. */
const BODY_GAP = 10;

export type CardAction = "close";
type Hit = Rect & { action: CardAction };

/** What the last draw actually laid out. Asserted by scripts/vr_check.mjs. */
export type CardLayout = {
  fontPx: number;
  lines: number;
  /** Widest painted body line, in canvas pixels. */
  maxLineWidth: number;
  /** Where the body block ends, and the first thing it must not reach. */
  bodyBottom: number;
  limit: number;
};

const ACCENT: Record<Severity, string> = {
  danger: C.danger,
  caution: C.caution,
  info: C.info,
};
const FILL: Record<Severity, string> = {
  danger: C.dangerFill,
  caution: C.cautionFill,
  info: C.infoFill,
};
const BADGE: Record<Severity, string> = {
  danger: "DANGER",
  caution: "CAUTION",
  info: "INFO",
};

/** A line the guide is shouting keeps shouting here. */
function isLoud(line: string): boolean {
  return /^(DO NOT|DO NOT CUT|Do NOT)/.test(line) || /^[A-Z ,'-]{12,}$/.test(line);
}

export class HotspotCard {
  readonly group = new Group();

  private surface: CanvasSurface;
  private hits: Hit[] = [];
  private raycaster = new Raycaster();
  private current: Hotspot | null = null;
  private camQuat = new Quaternion();
  private parentInv = new Quaternion();
  /** World position of the marker this card belongs to. */
  private markerWorld = new Vector3();
  private camRight = new Vector3();
  private layoutInfo: CardLayout = {
    fontPx: BODY_MAX_PX,
    lines: 0,
    maxLineWidth: 0,
    bodyBottom: BODY_TOP,
    limit: BANNER_TOP - BODY_GAP,
  };

  constructor() {
    this.surface = makeCanvasSurface(W, H, METRES, RENDER_ORDER);
    // A billboarded quad's bounding sphere is computed before the scale is
    // applied, which is enough for a per-eye frustum test to cull it at the
    // edge of vision. hotspots.ts opts its markers out for the same reason.
    this.surface.mesh.frustumCulled = false;
    this.group.add(this.surface.mesh);
    this.group.visible = false;
  }

  get visible() {
    return this.group.visible;
  }

  get hotspot(): Hotspot | null {
    return this.current;
  }

  /** Exposed for the headless check, same reasoning as HelpPanel.surface. */
  get mesh() {
    return this.surface.mesh;
  }

  /** Exposed for the headless check - see CardLayout. */
  get layout(): CardLayout {
    return this.layoutInfo;
  }

  /** Where the marker this card describes sits, in world space. */
  get anchor(): Vector3 {
    return this.markerWorld.clone();
  }

  /**
   * Open the card for a hotspot whose marker is at `markerWorld`.
   *
   * The card is placed along the head -> marker direction at reading distance
   * FROM THE HEAD, not at a standoff from the marker. See READ_DISTANCE for why
   * that distinction is the whole fix.
   */
  show(hotspot: Hotspot, markerWorld: Vector3, camera: PerspectiveCamera) {
    this.current = hotspot;
    this.markerWorld.copy(markerWorld);
    this.draw(hotspot);

    const camPos = camera.getWorldPosition(new Vector3());
    const toMarker = markerWorld.clone().sub(camPos);
    const dist = toMarker.length();
    // Degenerate only if the head is inside the marker; aim straight ahead.
    if (dist < 1e-4) toMarker.set(0, 0, -1);
    else toMarker.divideScalar(dist);

    const d = Math.min(
      READ_DISTANCE,
      Math.max(MIN_READ_DISTANCE, dist - MARKER_CLEARANCE),
    );

    // Swing the direction down about the head's own right axis, so the marker
    // stays visible above the card. Rotating rather than translating keeps
    // |head -> card| exactly d - see CLEARANCE_DEGREES.
    this.camRight.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(this.camQuat));
    const drop = Math.atan2(QUAD_H / 2, d) + MathUtils.degToRad(CLEARANCE_DEGREES);
    toMarker.applyAxisAngle(this.camRight, -drop);

    const world = camPos.clone().addScaledVector(toMarker, d);

    const parent = this.group.parent;
    this.group.position.copy(parent ? parent.worldToLocal(world) : world);
    this.group.visible = true;
    // Orient it now rather than waiting for the next frame, or it appears for
    // one frame flat-on to the world.
    this.face(camera);
  }

  hide() {
    this.group.visible = false;
    this.current = null;
  }

  /**
   * Keep the card square to the viewer as they walk around it.
   *
   * Size is not touched here. The card keeps its real physical size everywhere,
   * XR and desktop alike: it now opens at reading distance from the head in
   * both, so the constant-angular-size scaling the desktop path used to need -
   * back when the card was pinned to a marker metres away - has nothing left to
   * compensate for. One behaviour in both paths also means what you review on
   * the desktop is what you get in the headset, which is not a luxury in this
   * project.
   */
  face(camera: PerspectiveCamera) {
    if (!this.group.visible) return;
    camera.getWorldQuaternion(this.camQuat);
    const parent = this.group.parent;
    if (parent) {
      parent.getWorldQuaternion(this.parentInv).invert();
      this.group.quaternion.copy(this.parentInv).multiply(this.camQuat);
    } else {
      this.group.quaternion.copy(this.camQuat);
    }
  }

  /** Ray from a controller (or a hand's aim ray) to a card button. */
  hitTest(controller: Object3D): CardAction | null {
    if (!this.group.visible) return null;
    const origin = controller.getWorldPosition(new Vector3());
    const dir = new Vector3(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(new Quaternion()))
      .normalize();
    this.raycaster.set(origin, dir);
    const inter = this.raycaster.intersectObject(this.surface.mesh, false)[0];
    if (!inter?.uv) return null;
    const uv: Vector2 = inter.uv;
    // Canvas Y runs down, UV runs up.
    const hit = hitAt(this.hits, uv.x * W, (1 - uv.y) * H);
    return hit ? hit.action : null;
  }

  /** True if the ray lands anywhere on the card, button or not. */
  intersects(controller: Object3D): boolean {
    if (!this.group.visible) return false;
    const origin = controller.getWorldPosition(new Vector3());
    const dir = new Vector3(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(new Quaternion()))
      .normalize();
    this.raycaster.set(origin, dir);
    return this.raycaster.intersectObject(this.surface.mesh, false).length > 0;
  }

  private draw(h: Hotspot) {
    const { ctx } = this.surface;
    this.hits = [];
    ctx.clearRect(0, 0, W, H);

    const accent = ACCENT[h.severity];

    ctx.fillStyle = C.panel;
    roundRect(ctx, 0, 0, W, H, 24);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // header, tinted by severity so the class of hazard reads before the words
    ctx.fillStyle = FILL[h.severity];
    roundRect(ctx, 0, 0, W, 96, 24);
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.fillStyle = accent;
    ctx.font = "700 24px sans-serif";
    ctx.fillText(BADGE[h.severity], 30, 34);

    ctx.fillStyle = C.text;
    fitText(ctx, h.title, W - 150, 34, 22);
    ctx.fillText(h.title, 30, 70);

    // close button
    const close: Rect = { x: W - 78, y: 24, w: 48, h: 48 };
    ctx.fillStyle = C.btn;
    roundRect(ctx, close.x, close.y, close.w, close.h, 10);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(close.x + 15, close.y + 15);
    ctx.lineTo(close.x + close.w - 15, close.y + close.h - 15);
    ctx.moveTo(close.x + close.w - 15, close.y + 15);
    ctx.lineTo(close.x + 15, close.y + close.h - 15);
    ctx.stroke();
    this.hits.push({ ...close, action: "close" });

    this.drawBody(h, accent);

    // Unverified banner. Deliberately near the bottom, above the citation, so it
    // reads as a caveat on the whole card rather than on one line of it.
    if (!h.verified) {
      ctx.fillStyle = "#241d3d";
      roundRect(ctx, 24, BANNER_TOP, W - 48, 44, 10);
      ctx.fill();
      ctx.strokeStyle = C.unverified;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.unverified;
      const caveat =
        "UNCONFIRMED PLACEMENT - the wording above is from the guide, this position is an estimate";
      fitText(ctx, caveat, W - 80, 21, 15);
      ctx.fillText(caveat, 40, BANNER_TOP + 22);
    }

    ctx.fillStyle = C.dim;
    ctx.font = "21px sans-serif";
    ctx.fillText(`Source: ${h.source}`, 30, H - 56);
    ctx.fillText("Trigger or pinch the X to close.", 30, H - 26);

    this.surface.tex.needsUpdate = true;
  }

  /**
   * Wrap the body to the card and shrink it until it fits.
   *
   * `h.body` is authored as pre-broken lines so the source controls where the
   * emphasis falls, and those lines used to be painted verbatim with no width
   * check at all. The longest authored line measures ~810 px against an 880 px
   * canvas - one added word from running off the edge - and the mirrored
   * charge-port note appends two more lines that were never measured against
   * anything. Wrapping keeps the authored breaks where they fit and rescues the
   * ones that do not.
   *
   * Measured at weight 600 whatever the line's real weight, because that is the
   * worst case: a "shouting" line is drawn bold, and wrapping to the regular
   * metrics would let it paint past the edge it was just fitted to.
   */
  private drawBody(h: Hotspot, accent: string) {
    const { ctx } = this.surface;
    const limit = (h.verified ? FOOTER_TOP : BANNER_TOP) - BODY_GAP;

    type DrawLine = { text: string; loud: boolean };
    let size = BODY_MAX_PX;
    let lines: DrawLine[] = [];
    let lineHeight = 0;
    let bodyBottom = BODY_TOP;

    for (;;) {
      ctx.font = `600 ${size}px sans-serif`;
      lines = [];
      for (const src of h.body) {
        const loud = isLoud(src);
        for (const text of wrapText(ctx, src, BODY_MAX_WIDTH)) lines.push({ text, loud });
      }
      lineHeight = Math.round(size * LINE_RATIO);
      // textBaseline is "middle", so the block runs half a line past the last
      // baseline.
      bodyBottom =
        BODY_TOP + Math.max(0, lines.length - 1) * lineHeight + Math.ceil(size / 2);
      if (bodyBottom <= limit || size <= BODY_MIN_PX) break;
      size -= 1;
    }

    let maxLineWidth = 0;
    let y = BODY_TOP;
    for (const line of lines) {
      ctx.font = `${line.loud ? "600 " : ""}${size}px sans-serif`;
      ctx.fillStyle = line.loud ? accent : C.text;
      ctx.fillText(line.text, BODY_LEFT, y);
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line.text).width);
      y += lineHeight;
    }

    this.layoutInfo = {
      fontPx: size,
      lines: lines.length,
      maxLineWidth,
      bodyBottom,
      limit,
    };
  }

  dispose() {
    this.surface.tex.dispose();
    this.surface.mesh.geometry.dispose();
    (this.surface.mesh.material as Material).dispose();
  }
}
