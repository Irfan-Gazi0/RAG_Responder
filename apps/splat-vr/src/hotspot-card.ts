/**
 * The info card that opens when a hazard marker is selected.
 *
 * Same canvas-on-a-quad technique as the controls panel (see canvas-ui.ts), with
 * two differences that matter:
 *
 *   - It billboards by copying the HEAD'S ORIENTATION rather than by lookAt().
 *     A card placed off to one side and pointed at the camera position gets
 *     visibly sheared and rolled by the projection; matching the head's
 *     orientation keeps the text flat-on in both eyes. controller-hints.ts
 *     learned this the hard way and this follows it.
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
  type CanvasSurface,
  type Rect,
} from "./canvas-ui";
import type { Hotspot, Severity } from "./hotspots-data";

const W = 880;
const H = 620;
/** Card width in metres. Sized to be readable at the ~0.9 m it opens at. */
const METRES = 0.62;
/** Above the markers (850), below the controls panel (900). */
const RENDER_ORDER = 880;

/** How far toward the viewer from its marker the card sits, metres. */
const STANDOFF = 0.45;
/** Never place the card closer to the head than this - it would be unreadable. */
const MIN_VIEW_DISTANCE = 0.55;
/**
 * The distance METRES was chosen to be read at. In a headset you walk up to a
 * marker and the card ends up about this far away, so its physical size is
 * right and must not be messed with - a world-locked card that resizes as you
 * approach reads as a bug.
 *
 * On the desktop there is no walking up to anything: the camera sits 6 m off
 * the car, where a 0.62 m card is about forty pixels tall and completely
 * illegible. Since the desktop path exists precisely so hazard copy and marker
 * placement can be reviewed WITHOUT a headset, the card is scaled there to hold
 * a constant angular size instead.
 */
const DESIGN_DISTANCE = 0.9;
/** Bounds on that desktop scaling, so a very near or far camera stays sane. */
const SCREEN_SCALE_MIN = 1;
const SCREEN_SCALE_MAX = 9;

export type CardAction = "close";
type Hit = Rect & { action: CardAction };

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

export class HotspotCard {
  readonly group = new Group();

  private surface: CanvasSurface;
  private hits: Hit[] = [];
  private raycaster = new Raycaster();
  private current: Hotspot | null = null;
  private camQuat = new Quaternion();
  private parentInv = new Quaternion();

  constructor() {
    this.surface = makeCanvasSurface(W, H, METRES, RENDER_ORDER);
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

  /**
   * Open the card for a hotspot whose marker is at `markerWorld`.
   *
   * The card is pulled toward the viewer from the marker so it is not buried in
   * the bodywork, and pushed back out if that would put it inside reading
   * distance - walking right up to a marker should not shove the card into
   * your face.
   */
  show(
    hotspot: Hotspot,
    markerWorld: Vector3,
    camera: PerspectiveCamera,
    presenting: boolean,
  ) {
    this.current = hotspot;
    this.draw(hotspot);

    const camPos = camera.getWorldPosition(new Vector3());
    const toViewer = camPos.clone().sub(markerWorld);
    const dist = toViewer.length();
    if (dist < 1e-4) toViewer.set(0, 0, 1);
    else toViewer.divideScalar(dist);

    const standoff = Math.min(STANDOFF, Math.max(0, dist - MIN_VIEW_DISTANCE));
    const world = markerWorld.clone().addScaledVector(toViewer, standoff);

    const parent = this.group.parent;
    this.group.position.copy(parent ? parent.worldToLocal(world) : world);
    this.group.visible = true;
    // Orient and size it now rather than waiting for the next frame, or it
    // appears for one frame flat-on to the world and at the wrong scale.
    this.face(camera, presenting);
  }

  hide() {
    this.group.visible = false;
    this.current = null;
  }

  /**
   * Keep the card square to the viewer as they walk around it, and readable.
   *
   * @param presenting  True inside an XR session, where the card keeps its real
   *                    physical size. False on the desktop, where it is scaled
   *                    to a constant angular size - see DESIGN_DISTANCE.
   */
  face(camera: PerspectiveCamera, presenting: boolean) {
    if (!this.group.visible) return;
    camera.getWorldQuaternion(this.camQuat);
    const parent = this.group.parent;
    if (parent) {
      parent.getWorldQuaternion(this.parentInv).invert();
      this.group.quaternion.copy(this.parentInv).multiply(this.camQuat);
    } else {
      this.group.quaternion.copy(this.camQuat);
    }

    if (presenting) {
      this.group.scale.setScalar(1);
      return;
    }
    const dist = camera.getWorldPosition(new Vector3()).distanceTo(
      this.group.getWorldPosition(new Vector3()),
    );
    const k = Math.min(
      SCREEN_SCALE_MAX,
      Math.max(SCREEN_SCALE_MIN, dist / DESIGN_DISTANCE),
    );
    this.group.scale.setScalar(k);
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

    // body: pre-broken lines, so the source controls where the emphasis falls
    let y = 142;
    ctx.font = "26px sans-serif";
    for (const line of h.body) {
      // A line that is shouting in the guide keeps shouting here.
      const loud = /^(DO NOT|DO NOT CUT|Do NOT)/.test(line) || /^[A-Z ,'-]{12,}$/.test(line);
      ctx.fillStyle = loud ? accent : C.text;
      ctx.font = `${loud ? "600 " : ""}26px sans-serif`;
      ctx.fillText(line, 30, y);
      y += 36;
    }

    // Unverified banner. Deliberately near the bottom, above the citation, so it
    // reads as a caveat on the whole card rather than on one line of it.
    if (!h.verified) {
      const by = H - 118;
      ctx.fillStyle = "#241d3d";
      roundRect(ctx, 24, by, W - 48, 44, 10);
      ctx.fill();
      ctx.strokeStyle = C.unverified;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.unverified;
      const caveat =
        "UNCONFIRMED PLACEMENT - the wording above is from the guide, this position is an estimate";
      fitText(ctx, caveat, W - 80, 21, 15);
      ctx.fillText(caveat, 40, by + 22);
    }

    ctx.fillStyle = C.dim;
    ctx.font = "21px sans-serif";
    ctx.fillText(`Source: ${h.source}`, 30, H - 56);
    ctx.fillText("Trigger or pinch the X to close.", 30, H - 26);

    this.surface.tex.needsUpdate = true;
  }

  dispose() {
    this.surface.tex.dispose();
    this.surface.mesh.geometry.dispose();
  }
}
