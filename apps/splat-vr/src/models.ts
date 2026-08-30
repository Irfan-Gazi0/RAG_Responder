/**
 * Vehicle scan registry + per-model calibration.
 *
 * Gaussian-splat scans come out of the photogrammetry pipeline in an arbitrary
 * pose and an arbitrary scale, so a raw scan is tilted, floating, and the wrong
 * size. That is fine for an orbit viewer (the DOE-Training viewer just hand-tunes
 * a camera matrix per scan) but not for VR: to walk around a car it has to be
 * upright, standing on the floor plane, at roughly 1:1 metres.
 *
 * The values below were derived offline by decoding the .spz splat positions and
 * measuring each scan, not by eyeballing sliders:
 *
 *   - All four scans have their scene Y-down, confirmed by binning splats
 *     vertically and checking which direction the cross-section area shrinks in
 *     (it shrinks toward the roof). main.ts applies FLIP_X for this.
 *   - `rotation` Y is the negated PCA major axis of the mid-height slab's XZ
 *     footprint. The cars sit at arbitrary angles - equinox-hood-open was 132
 *     degrees off, giving a near-square 1.03:1 bounding box. After correction
 *     every scan measures 2.24-2.49 length:width, which is car-shaped (~2.5).
 *   - `scaleMultiplier` corrects for the surrounding ground captured in each
 *     crop, which inflates the raw bounding box beyond the vehicle itself.
 *   - `yOffset` lifts scans whose bounding box floor sits below the real ground
 *     plane because of stray splats (equinox-hood-closed is 0.48 m out).
 *
 * The analytic pass alone was NOT enough for scale. It measures the scan's
 * bounding box, which includes a different amount of captured ground per scan
 * (widths came out 2.6-5.4 m for a 1.9 m vehicle), so the first values rendered
 * the Equinoxes ~30% undersized and the Blazers ~10% oversized. The multipliers
 * below were then corrected empirically: render each scan headlessly at a known
 * camera, segment the white bodywork from the tan ground, measure the on-screen
 * length in metres and solve for the correction. All four now land within 3.5%
 * of their real length (the Equinox hood-open residual is the raised hood
 * widening the silhouette). Rotation is exactly as derived; yOffset was nudged
 * on two scans (equinox-hood-closed -0.484 -> -0.596, blazer-hood-closed
 * -0.128 -> -0.120) for the same reason - the bbox floor it comes from is a
 * property of the crop, not of the car.
 *
 * So scripts/analyze_splats.py is a source for `rotation` and a starting point
 * for the other two. It prints them under separate headings for that reason;
 * re-derive scale with scripts/render_check.mjs rather than pasting it.
 *
 * Verified rendering correctly on desktop; NOT yet confirmed in a headset.
 */
import type { VehicleId } from "./hotspots-data";

export type ModelConfig = {
  key: string;
  label: string;
  /** Manufacturer overall length in metres - the auto-fit scales the scan to this. */
  lengthMeters: number;
  /** Manufacturer overall width and height, metres. Reference for hotspot placement. */
  widthMeters: number;
  heightMeters: number;
  /** Whose hazard set this scan shows. Both scans of a vehicle share one set. */
  vehicle: VehicleId;
  /**
   * Degrees about Y mapping the canonical vehicle frame (+X = nose) onto this
   * fitted scan. Determined by rendering each scan from the default desktop
   * camera - which looks along -Z, so screen-right is world +X - and reading off
   * which way the nose points: both Equinox scans face -X (180 deg), both
   * Blazers face +X (0 deg). See hotspots-data.ts for the frame definition.
   */
  vehicleYaw: number;
  /**
   * Metres [dx, dz] from the fitted BOUNDING BOX centre to the actual vehicle
   * centre. fitToGround centres the bbox, and the bbox includes however much
   * surrounding tarmac each crop captured, so the two are not the same point.
   * Measured by segmenting the white bodywork out of a headless render: all four
   * land within 5 cm in X, so these start at zero and exist to be tuned in the
   * ?dev=1 hotspot pane once someone checks them across the car's width.
   */
  centerOffset: [number, number];
  /** Euler XYZ in degrees, applied before the auto-fit. Found via ?dev=1. */
  rotation: [number, number, number];
  /** Fudge factor on the derived scale, for scans whose bbox includes stray splats. */
  scaleMultiplier: number;
  /** Metres to nudge vertically after grounding. */
  yOffset: number;
  /**
   * Base colour of the floor this scan was captured on, so the synthetic ground
   * in ground.ts blends into the captured ground patch instead of ending at a
   * visible seam. Measured as the median of the warm (red-dominant) pixels in a
   * real render, which separates the captured concrete from the blue-dominant
   * background and grid and from the white bodywork. An earlier pass that keyed
   * only on brightness let background bleed in and read every scan ~25% too dark.
   */
  groundColor: string;
};

export const MODELS: ModelConfig[] = [
  {
    key: "equinox-hood-open",
    label: "Chevrolet Equinox EV (Hood Open)",
    lengthMeters: 4.79,
    widthMeters: 1.89,
    heightMeters: 1.64,
    vehicle: "equinox-ev-2024",
    vehicleYaw: 180,
    centerOffset: [0, 0],
    rotation: [0, -132.4, 0],
    scaleMultiplier: 1.565,
    yOffset: -0.052,
    groundColor: "#57493d",
  },
  {
    key: "equinox-hood-closed",
    label: "Chevrolet Equinox EV (Hood Closed)",
    lengthMeters: 4.79,
    widthMeters: 1.89,
    heightMeters: 1.64,
    vehicle: "equinox-ev-2024",
    vehicleYaw: 180,
    centerOffset: [0, 0],
    rotation: [0, -111.0, 0],
    scaleMultiplier: 1.387,
    yOffset: -0.596,
    groundColor: "#5c4f3d",
  },
  {
    key: "blazer-hood-open",
    label: "Chevrolet Blazer EV (Hood Open)",
    lengthMeters: 4.92,
    widthMeters: 1.95,
    heightMeters: 1.68,
    vehicle: "blazer-ev-2024",
    vehicleYaw: 0,
    centerOffset: [0, 0],
    rotation: [0, -89.8, 0],
    scaleMultiplier: 1.087,
    yOffset: -0.019,
    groundColor: "#6d5d49",
  },
  {
    key: "blazer-hood-closed",
    label: "Chevrolet Blazer EV (Hood Closed)",
    lengthMeters: 4.92,
    widthMeters: 1.95,
    heightMeters: 1.68,
    vehicle: "blazer-ev-2024",
    vehicleYaw: 0,
    centerOffset: [0, 0],
    rotation: [0, 179.1, 0],
    scaleMultiplier: 1.007,
    yOffset: -0.12,
    groundColor: "#504941",
  },
];

export const DEFAULT_MODEL_KEY = "equinox-hood-open";

export function findModel(key: string | null): ModelConfig {
  return MODELS.find((m) => m.key === key) ?? MODELS[0];
}
