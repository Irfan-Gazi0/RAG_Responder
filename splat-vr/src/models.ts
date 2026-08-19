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
 * widening the silhouette). Rotation and yOffset remain as derived.
 *
 * Verified rendering correctly on desktop; NOT yet confirmed in a headset.
 */
export type ModelConfig = {
  key: string;
  label: string;
  /** Manufacturer overall length in metres - the auto-fit scales the scan to this. */
  lengthMeters: number;
  /** Euler XYZ in degrees, applied before the auto-fit. Found via ?dev=1. */
  rotation: [number, number, number];
  /** Fudge factor on the derived scale, for scans whose bbox includes stray splats. */
  scaleMultiplier: number;
  /** Metres to nudge vertically after grounding. */
  yOffset: number;
};

export const MODELS: ModelConfig[] = [
  {
    key: "equinox-hood-open",
    label: "Chevrolet Equinox EV (Hood Open)",
    lengthMeters: 4.79,
    rotation: [0, -132.4, 0],
    scaleMultiplier: 1.565,
    yOffset: -0.052,
  },
  {
    key: "equinox-hood-closed",
    label: "Chevrolet Equinox EV (Hood Closed)",
    lengthMeters: 4.79,
    rotation: [0, -111.0, 0],
    scaleMultiplier: 1.387,
    yOffset: -0.596,
  },
  {
    key: "blazer-hood-open",
    label: "Chevrolet Blazer EV (Hood Open)",
    lengthMeters: 4.92,
    rotation: [0, -89.8, 0],
    scaleMultiplier: 1.087,
    yOffset: -0.019,
  },
  {
    key: "blazer-hood-closed",
    label: "Chevrolet Blazer EV (Hood Closed)",
    lengthMeters: 4.92,
    rotation: [0, 179.1, 0],
    scaleMultiplier: 1.007,
    yOffset: -0.12,
  },
];

export const DEFAULT_MODEL_KEY = "equinox-hood-open";

export function findModel(key: string | null): ModelConfig {
  return MODELS.find((m) => m.key === key) ?? MODELS[0];
}
