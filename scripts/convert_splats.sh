#!/usr/bin/env bash
#
# Convert the cropped Gaussian-splat vehicle scans from .ply to .spz for the
# WebXR viewer in splat-vr/.
#
# Why .spz: the source .ply files are 23-47 MB each. A Quest pulling that over
# wifi on every load is painful, and hosting them ourselves on CloudFront (same
# origin as the page) avoids the third-party-outage failure mode that took the
# old splat-site viewer down.
#
# *** --spz-version 3 IS LOAD-BEARING ***
# splat-transform defaults to writing SPZ v4. Spark's reader hard-rejects it:
#   if (this.version < 1 || this.version > 3) throw new Error("Unsupported SPZ version")
# A v4 file loads fine in other tools and fails only at runtime in the headset.
#
# Only the *cropped* scans are used. The uncropped (560K splats) and mipmap
# (3.0M splats) variants blow past Spark's stated WebXR budget of 500-750K.
#
# Usage:  bash scripts/convert_splats.sh
# Output: splat-vr/public/models/*.spz   (gitignored - regenerable build artifacts)
#         Vite copies publicDir into dist/ verbatim, which is what puts them
#         on CloudFront; the .ply inputs stay in splat-vr/.splat-src/ so that
#         copy cannot ship 139 MB of source scans.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/splat-vr/public/models"
# Keep the .ply download cache OUTSIDE public/ - Vite copies publicDir into
# dist/ verbatim, so a cache in there ships 139 MB of source scans to S3.
SRC_DIR="$REPO_ROOT/splat-vr/.splat-src"

HF_BASE="https://huggingface.co/datasets/AlistairWstbrk/splats/resolve/main/3DGS%20.ply%20New%20Vehicle%20Scans"

# key|source filename (unescaped; curl --get --data-urlencode handles the spaces)
MODELS=(
  "equinox-hood-open|Equinox Hood Open (New)(Cropped).ply"
  "equinox-hood-closed|Equinox Hood Closed (New)(Cropped).ply"
  "blazer-hood-open|Chevy Blazer Hood Open (New)(Cropped).ply"
  "blazer-hood-closed|Chevy Blazer Hood Closed (New)(Cropped).ply"
)

mkdir -p "$SRC_DIR"

urlencode() {
  python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"
}

for entry in "${MODELS[@]}"; do
  key="${entry%%|*}"
  fname="${entry#*|}"
  src="$SRC_DIR/$key.ply"
  out="$OUT_DIR/$key.spz"

  if [[ -f "$src" ]]; then
    echo "==> $key: source already downloaded ($(du -h "$src" | cut -f1))"
  else
    echo "==> $key: downloading..."
    curl -sSfL --retry 3 -o "$src" "$HF_BASE/$(urlencode "$fname")"
    echo "    got $(du -h "$src" | cut -f1)"
  fi

  if [[ -f "$out" && "$out" -nt "$src" ]]; then
    echo "    $key.spz is up to date, skipping conversion"
  else
    echo "    converting -> $key.spz (SPZ v3)"
    npx --yes @playcanvas/splat-transform@3 "$src" "$out" --spz-version 3
  fi

  # Verify the SPZ header directly rather than trusting the converter: assert the
  # magic, assert version <= 3 (Spark throws on v4), and assert the splat count
  # survived the round-trip. A wrong version here only fails inside the headset.
  python3 - "$src" "$out" <<'PY'
import gzip, struct, sys, re
src, out = sys.argv[1], sys.argv[2]
with open(src, 'rb') as f:
    m = re.search(rb'element vertex (\d+)', f.read(400))
ply_count = int(m.group(1)) if m else -1
raw = gzip.decompress(open(out, 'rb').read())
magic, version, num = struct.unpack_from('<III', raw, 0)
assert magic == 1347635022, f"bad SPZ magic in {out}"
assert 1 <= version <= 3, f"SPZ v{version} in {out} - Spark only reads v1-v3"
assert num == ply_count, f"splat count drift: ply={ply_count} spz={num}"
print(f"    verified: SPZ v{version}, {num:,} splats (matches source)")
PY
  echo "    output: $(du -h "$out" | cut -f1)"
  echo
done

echo "Done. Converted models in $OUT_DIR:"
ls -lh "$OUT_DIR"/*.spz
echo
echo "Sources cached in $SRC_DIR (safe to delete: $(du -sh "$SRC_DIR" | cut -f1))"
