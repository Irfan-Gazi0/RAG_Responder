#!/usr/bin/env python3.10
"""
Derive the per-model calibration constants in src/models.ts.

Run with python3.10 (it has numpy; bare python3 does not - same rule as the
deploy scripts).

    python3.10 scripts/analyze_splats.py

Why this exists
---------------
A Gaussian-splat scan has no canonical pose or scale: the car sits at an
arbitrary yaw, the scene is Y-down, and each crop includes a different amount of
surrounding ground. An orbit viewer can ignore all of that by hand-tuning a
camera matrix (which is what the DOE-Training viewer does), but a VR walkaround
cannot - the car has to be upright, on the floor, at 1:1 metres.

Rather than eyeball sliders, this decodes the .spz splat positions directly and
measures each scan:

  up axis  - bin splats vertically and fit the trend of cross-section area.
             Area shrinks toward the roof, so a positive slope means the scan is
             Y-down. All four scans are, which is why main.ts applies FLIP_X.

  yaw      - PCA over the XZ footprint of the mid-height slab gives the car's
             long axis. equinox-hood-open sat 132 degrees off, producing a
             near-square 1.03:1 bounding box. After correction all four scans
             measure 2.24-2.49 length:width, which is car-shaped (~2.5) - that
             agreement is the main evidence the yaw values are right.
             FLIP_X negates Z, so the correction is -yaw, not +yaw.

  scale    - fitToGround() derives scale from the full bounding box, which
             includes captured ground. scaleMultiplier = bbox_footprint /
             true_body_length corrects it back to the real vehicle.

  yOffset  - fitToGround() rests bbox.min.y on the floor, so a single stray
             splat below ground leaves the car hovering. This compares the bbox
             floor against a robust 1st-percentile ground and emits the
             correction (equinox-hood-closed is 0.48 m out).

LIMITATION: only `rotation` is safe to paste. `scaleMultiplier` and `yOffset`
are both derived from the bounding box, which includes however much surrounding
ground each crop captured, so they are starting estimates and nothing more. The
values actually in models.ts were corrected empirically afterwards by rendering
each scan headlessly at a known camera, segmenting the white bodywork from the
tan ground, and solving for the on-screen length.

Measured 2026-08-29, pasting this script's scale over the tuned values:

    equinox-hood-open    1.123 vs 1.565 tuned   -28%
    equinox-hood-closed  1.126 vs 1.387 tuned   -19%
    blazer-hood-open     1.210 vs 1.087 tuned   +11%
    blazer-hood-closed   1.075 vs 1.007 tuned    +7%

yOffset diverges the same way (equinox-hood-closed: -0.484 here, -0.596 tuned;
blazer-hood-closed: -0.128 here, -0.120 tuned). The output below is
therefore split into a paste-this block and a do-not-paste block; re-derive scale
with `node scripts/render_check.mjs https://localhost:8082/`, which measures the
on-screen vehicle length directly.

The transform here mirrors main.ts exactly (q = calibration * FLIP_X, then scale
from max(size.x, size.z)); if that math changes, change it here too.
"""
import gzip
import json
import math
import pathlib
import struct
import sys

import numpy as np

MODELS_DIR = pathlib.Path(__file__).resolve().parents[1] / "public" / "models"

# Manufacturer overall length, metres. Must match lengthMeters in models.ts.
LENGTH_M = {
    "equinox-hood-open": 4.79,
    "equinox-hood-closed": 4.79,
    "blazer-hood-open": 4.92,
    "blazer-hood-closed": 4.92,
}

FLIP_X = np.diag([1.0, -1.0, -1.0])  # 180 degrees about X


def load_positions(path: pathlib.Path) -> np.ndarray:
    """Decode splat centres from an SPZ file (24-bit fixed point, gzipped)."""
    raw = gzip.decompress(path.read_bytes())
    magic, version, num = struct.unpack_from("<III", raw, 0)
    if magic != 1347635022:
        raise SystemExit(f"{path.name}: not an SPZ file")
    if not 1 <= version <= 3:
        raise SystemExit(f"{path.name}: SPZ v{version}, Spark only reads v1-v3")
    frac_bits = struct.unpack_from("<B", raw, 13)[0]

    b = (
        np.frombuffer(raw, dtype=np.uint8, count=num * 3 * 3, offset=16)
        .reshape(num * 3, 3)
        .astype(np.int32)
    )
    v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
    v = np.where(v >= (1 << 23), v - (1 << 24), v)  # sign-extend 24-bit
    return (v.astype(np.float64) / (1 << frac_bits)).reshape(num, 3)


def rot_y(deg: float) -> np.ndarray:
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def is_y_down(pts: np.ndarray) -> tuple[bool, float]:
    """Cross-section area shrinks toward the roof; rising area means Y-down."""
    bins = np.linspace(pts[:, 1].min(), pts[:, 1].max(), 12)
    areas = []
    for i in range(len(bins) - 1):
        s = pts[(pts[:, 1] >= bins[i]) & (pts[:, 1] < bins[i + 1])]
        if len(s) < 200:
            areas.append(np.nan)
            continue
        x0, x1 = np.percentile(s[:, 0], [2, 98])
        z0, z1 = np.percentile(s[:, 2], [2, 98])
        areas.append((x1 - x0) * (z1 - z0))
    areas = np.array(areas, dtype=float)
    ok = ~np.isnan(areas)
    slope = float(np.polyfit(np.arange(len(areas))[ok], areas[ok], 1)[0]) if ok.sum() > 3 else 0.0
    return slope > 0, slope


def analyze(path: pathlib.Path) -> dict:
    key = path.stem
    target = LENGTH_M[key]
    pos = load_positions(path)

    lo, hi = np.percentile(pos, [1, 99], axis=0)
    trimmed = pos[np.all((pos >= lo) & (pos <= hi), axis=1)]

    y_down, slope = is_y_down(trimmed)

    # yaw from the mid-height slab, which is body rather than ground or roof
    y0, y1 = np.percentile(trimmed[:, 1], [20, 80])
    body = trimmed[(trimmed[:, 1] >= y0) & (trimmed[:, 1] <= y1)]
    xz = body[:, [0, 2]] - body[:, [0, 2]].mean(axis=0)
    eigvals, eigvecs = np.linalg.eigh(np.cov(xz.T))
    major = eigvecs[:, int(np.argmax(eigvals))]
    yaw = math.degrees(math.atan2(major[1], major[0]))
    rot_deg = -yaw  # FLIP_X negates Z

    # replicate the runtime transform, then the runtime bbox
    M = rot_y(rot_deg) @ FLIP_X
    tp = pos @ M.T
    bmin, bmax = tp.min(axis=0), tp.max(axis=0)
    size = bmax - bmin
    footprint = max(size[0], size[2])
    base_scale = target / footprint

    tb = body @ M.T
    true_len = float(np.percentile(tb[:, 0], 99) - np.percentile(tb[:, 0], 1))
    scale_mult = footprint / true_len
    final_scale = base_scale * scale_mult

    ground = float(np.percentile(tp[:, 1], 1.0))
    y_off = -(ground - bmin[1]) * final_scale

    width = float(np.percentile(tb[:, 2], 99) - np.percentile(tb[:, 2], 1))
    print(f"{key}")
    print(f"  splats        : {len(pos):,}")
    print(f"  y-down        : {y_down}  (area slope {slope:+.3f})")
    print(f"  yaw           : {yaw:+.1f} deg  -> rotation Y = {rot_deg:+.1f}")
    print(f"  aligned L x W : {true_len:.3f} x {width:.3f}  (ratio {true_len / max(width, 1e-6):.2f}, car ~2.5)")
    print(f"  scale         : {base_scale:.3f} x {scale_mult:.3f} = {final_scale:.3f}")
    print(f"  -> length     : {true_len * final_scale:.2f} m (target {target} m)")
    print(f"  yOffset       : {y_off:+.3f} m")
    print()

    return {
        "rotation": [0, round(rot_deg, 1), 0],
        "scaleMultiplier": round(scale_mult, 3),
        "yOffset": round(y_off, 3),
    }


def main() -> int:
    files = sorted(MODELS_DIR.glob("*.spz"))
    if not files:
        print(f"No .spz in {MODELS_DIR} - run scripts/convert_splats.sh first.", file=sys.stderr)
        return 1
    results = {p.stem: analyze(p) for p in files}

    # Split deliberately. A single "Paste into models.ts:" block over all three
    # fields is an instruction to regress the calibration by -28%..+11% - see the
    # table in the module docstring.
    print("PASTE THIS into src/models.ts - derived analytically, reliable:")
    print(json.dumps({k: {"rotation": v["rotation"]} for k, v in results.items()}, indent=2))
    print()
    print("STARTING ESTIMATE ONLY - do NOT paste over the tuned values in models.ts:")
    print(json.dumps(
        {k: {"scaleMultiplier": v["scaleMultiplier"], "yOffset": v["yOffset"]}
         for k, v in results.items()},
        indent=2,
    ))
    print()
    print("  Both come from a bounding box that includes each crop's captured tarmac.")
    print("  Re-derive scale empirically instead:")
    print("      cd apps/splat-vr && npm run dev")
    print("      node scripts/render_check.mjs https://localhost:8082/")
    print("  and keep the tuned models.ts values unless that check fails.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
