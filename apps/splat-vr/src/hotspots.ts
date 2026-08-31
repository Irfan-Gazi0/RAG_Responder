/**
 * Hazard and cut-point markers pinned to the vehicle.
 *
 * This is what turns the scan from something to look at into something to be
 * taught by: the responder walks up to the front compartment, sees a red beacon
 * where the first responder loop is, points at it and gets the cutting protocol
 * straight out of the manufacturer's guide.
 *
 * Three decisions worth recording:
 *
 * 1. THE MARKERS LIVE IN WORLD SPACE, NOT UNDER carRig. carRig carries the
 *    fit-to-ground scale (2.4x to 5.5x depending on the scan), so a marker
 *    parented to it would be scaled by the same factor and each vehicle would
 *    get differently-sized beacons. Positions are recomputed from the vehicle
 *    frame whenever the fit changes instead.
 *
 * 2. DEPTH TESTING IS OFF, AND THAT IS A PROBLEM WE SOLVE ANOTHER WAY. Splats
 *    are transparent and do not write depth, so `depthTest: true` would not
 *    hide a marker on the far side of the car anyway - it would just let the
 *    ground occlude it. With depth off, every marker shows through the bodywork
 *    and the car ends up wearing a halo of dots. So each hotspot carries an
 *    outward normal and markers facing away from the viewer fade down to a
 *    faint ghost: the ones on the panel you are actually looking at read solid,
 *    the ones behind the car recede without vanishing.
 *
 * 3. HIT-TESTING IS A SPHERE, NOT THE QUAD. The marker billboards, so raycasting
 *    its geometry would make the target area depend on the viewing angle. A
 *    ray-sphere test against a fixed radius gives the same-sized target from
 *    everywhere, which matters when you are pointing from across a workshop.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Ray,
  SRGBColorSpace,
  Sphere,
  Vector3,
} from "three";
import { C } from "./canvas-ui";
import type { Hotspot, Severity, VehicleId } from "./hotspots-data";
import { hotspotsFor } from "./hotspots-data";

/** Billboard size in metres. Big enough to point at, small enough not to hide the part. */
const MARKER_METRES = 0.17;
/** Ray-hit radius, metres. Slightly generous - aiming at 4 m is not precise. */
const HIT_RADIUS = 0.13;
/** Above the ground (-1) and the splats, below the card (880) and the panel (900). */
const RENDER_ORDER = 850;

/** Opacity for a marker facing you, and for one seen through the vehicle. */
const FACING_ALPHA = 1.0;
const THROUGH_ALPHA = 0.16;
/** How fast a marker fades between those, per second. */
const FADE_RATE = 6;
/** Gentle breathing scale so a marker reads as an active control, not a decal. */
const PULSE_AMPLITUDE = 0.06;
const PULSE_HZ = 0.6;
/** Extra scale while the pointer is resting on a marker. */
const HOVER_SCALE = 1.25;

const ACCENT: Record<Severity, string> = {
  danger: C.danger,
  caution: C.caution,
  info: C.info,
};

/**
 * The beacon texture: a filled core, a ring, and - for an unconfirmed position -
 * a dashed outer ring. The dashes are the visual contract with hotspots-data.ts,
 * which ships every seeded position `verified: false`.
 */
function makeMarkerTexture(color: string, verified: boolean): CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const c = S / 2;

  // soft halo, so the marker separates from busy photoreal bodywork
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, `${color}66`);
  glow.addColorStop(0.55, `${color}22`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c, c, 13, 0, Math.PI * 2);
  ctx.fill();

  if (!verified) {
    ctx.strokeStyle = C.unverified;
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.arc(c, c, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  return tex;
}

type Marker = {
  hotspot: Hotspot;
  mesh: Mesh;
  /** Where the marker sits in world space, refreshed by `place()`. */
  world: Vector3;
  /** Outward normal in world space. */
  normal: Vector3;
  /** Current and target opacity, eased so the fade is not a pop. */
  alpha: number;
  sphere: Sphere;
};

export class Hotspots {
  readonly group = new Group();

  private markers: Marker[] = [];
  private textures = new Map<string, CanvasTexture>();
  private vehicle: VehicleId | null = null;
  private hovered: Marker | null = null;
  private enabled = true;

  /** Fit parameters, cached so a dev-pane nudge can re-place without a reload. */
  private yawQuat = new Quaternion();
  private originX = 0;
  private originZ = 0;

  private _ray = new Ray();
  private _v = new Vector3();
  private _v2 = new Vector3();
  private _dir = new Vector3();
  private _q = new Quaternion();
  private time = 0;

  constructor() {
    this.group.visible = true;
  }

  get count() {
    return this.markers.length;
  }

  /** Ids in registry order. Used by the dev pane and the headless check. */
  get ids(): string[] {
    return this.markers.map((m) => m.hotspot.id);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
  }

  get isEnabled() {
    return this.enabled;
  }

  /**
   * Load the hazard set for a vehicle. Cheap to call on every model swap: the
   * two scans of one vehicle share a set, so swapping between them rebuilds
   * nothing.
   */
  setVehicle(vehicle: VehicleId) {
    if (this.vehicle === vehicle) return;
    this.vehicle = vehicle;
    this.clear();
    for (const hotspot of hotspotsFor(vehicle)) {
      const color = ACCENT[hotspot.severity];
      const cacheKey = `${color}|${hotspot.verified}`;
      let tex = this.textures.get(cacheKey);
      if (!tex) {
        tex = makeMarkerTexture(color, hotspot.verified);
        this.textures.set(cacheKey, tex);
      }
      const mesh = new Mesh(
        new PlaneGeometry(MARKER_METRES, MARKER_METRES),
        new MeshBasicMaterial({
          map: tex,
          transparent: true,
          // Additive keeps the beacon legible against both the white bodywork
          // and the dark underbody, where a normal-blended sprite would sink
          // into one or the other.
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          opacity: FACING_ALPHA,
        }),
      );
      mesh.renderOrder = RENDER_ORDER;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.markers.push({
        hotspot,
        mesh,
        world: new Vector3(),
        normal: new Vector3(),
        alpha: FACING_ALPHA,
        sphere: new Sphere(new Vector3(), HIT_RADIUS),
      });
    }
  }

  /**
   * Map the canonical vehicle frame onto the fitted scan.
   *
   * `yawDeg` is which way this scan's nose points and `[dx, dz]` corrects the
   * fitted bounding-box centre to the vehicle centre - see models.ts. Called
   * from fitToGround, so re-calibrating a scan moves its markers with it.
   */
  place(yawDeg: number, centerOffset: [number, number]) {
    this.yawQuat.setFromAxisAngle(new Vector3(0, 1, 0), (yawDeg * Math.PI) / 180);
    this.originX = centerOffset[0];
    this.originZ = centerOffset[1];
    for (const m of this.markers) {
      m.world
        .fromArray(m.hotspot.pos)
        .applyQuaternion(this.yawQuat)
        .add(this._v.set(this.originX, 0, this.originZ));
      m.normal.fromArray(m.hotspot.normal).applyQuaternion(this.yawQuat).normalize();
      m.mesh.position.copy(m.world);
      m.sphere.center.copy(m.world);
    }
  }

  /**
   * Billboard, pulse, and fade the ones pointing away.
   *
   * Billboarding copies the head's world orientation rather than aiming at the
   * head's position: at these small sizes and wide angles a lookAt() sprite
   * visibly skews, and the group hangs off the scene root so the head's world
   * quaternion is directly usable.
   */
  update(dt: number, camera: PerspectiveCamera) {
    if (!this.enabled || !this.markers.length) return;
    this.time += dt;
    camera.getWorldQuaternion(this._q);
    const camPos = camera.getWorldPosition(this._v.set(0, 0, 0));
    const pulse = 1 + PULSE_AMPLITUDE * Math.sin(this.time * PULSE_HZ * Math.PI * 2);

    for (const m of this.markers) {
      m.mesh.quaternion.copy(this._q);

      // Facing test in world space: is the viewer on the outward side?
      // Scratch, not clone(): this runs per marker per frame and a dozen markers
      // at 90 Hz was over a thousand throwaway Vector3 a second.
      const toViewer = this._v2.copy(camPos).sub(m.world);
      const dist = toViewer.length();
      if (dist > 1e-5) toViewer.divideScalar(dist);
      const facing = toViewer.dot(m.normal);
      // Ease across the horizon rather than switching at exactly 0, or a marker
      // on the rocker flickers as you walk past its plane.
      const t = Math.min(1, Math.max(0, (facing + 0.25) / 0.5));
      const target = THROUGH_ALPHA + (FACING_ALPHA - THROUGH_ALPHA) * t;

      m.alpha += (target - m.alpha) * Math.min(1, FADE_RATE * dt);
      (m.mesh.material as MeshBasicMaterial).opacity = m.alpha;

      // Hold apparent size roughly constant with distance so a marker across the
      // room is still a target, without letting a near one swallow the view.
      const scale = pulse * (m === this.hovered ? HOVER_SCALE : 1) *
        Math.min(2.5, Math.max(0.85, dist / 2.5));
      m.mesh.scale.setScalar(scale);
    }
  }

  /**
   * Nearest marker along a controller's ray, or null.
   *
   * Sphere test rather than mesh raycast: the meshes billboard, so their
   * projected area - and therefore how easy they are to hit - would otherwise
   * change with the viewing angle.
   */
  hitTest(controller: Object3D): Hotspot | null {
    const m = this.markerAt(controller);
    return m ? m.hotspot : null;
  }

  private markerAt(controller: Object3D): Marker | null {
    if (!this.enabled || !this.markers.length) return null;
    // Scratch throughout - setHover calls this for both controllers every frame.
    const origin = controller.getWorldPosition(this._v2);
    const dir = this._dir
      .set(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(this._q))
      .normalize();
    this._ray.set(origin, dir);

    let best: Marker | null = null;
    let bestDist = Infinity;
    for (const m of this.markers) {
      if (!this._ray.intersectsSphere(m.sphere)) continue;
      const d = origin.distanceToSquared(m.world);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  /**
   * Highlight whatever the pointers are resting on.
   *
   * This is not decoration: with hand tracking there is no haptic actuator, so
   * the visual swell is the ONLY confirmation a hand user gets that they are
   * aimed at a target before they pinch.
   */
  setHover(controllers: Object3D[]): Hotspot | null {
    if (!this.enabled) {
      this.hovered = null;
      return null;
    }
    for (const c of controllers) {
      if (!c.visible) continue;
      const m = this.markerAt(c);
      if (m) {
        this.hovered = m;
        return m.hotspot;
      }
    }
    this.hovered = null;
    return null;
  }

  /** World position of a hotspot, for placing its card. */
  worldOf(id: string): Vector3 | null {
    const m = this.markers.find((x) => x.hotspot.id === id);
    return m ? m.world.clone() : null;
  }

  byId(id: string): Hotspot | null {
    return this.markers.find((x) => x.hotspot.id === id)?.hotspot ?? null;
  }

  /**
   * Move one marker, for the ?dev=1 placement pane. Writes the canonical-frame
   * position on the hotspot record so the pane can emit paste-ready JSON.
   */
  setPosition(id: string, pos: [number, number, number]) {
    const m = this.markers.find((x) => x.hotspot.id === id);
    if (!m) return;
    m.hotspot.pos = pos;
    m.world
      .fromArray(pos)
      .applyQuaternion(this.yawQuat)
      .add(this._v.set(this.originX, 0, this.originZ));
    m.mesh.position.copy(m.world);
    m.sphere.center.copy(m.world);
  }

  private clear() {
    for (const m of this.markers) {
      this.group.remove(m.mesh);
      m.mesh.geometry.dispose();
      (m.mesh.material as MeshBasicMaterial).dispose();
    }
    this.markers = [];
    this.hovered = null;
  }

}
