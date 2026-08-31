#!/usr/bin/env bash
#
# Vendor the WebXR input-profile assets that render the controllers in VR.
#
#   bash scripts/fetch_controller_assets.sh
#
# Why vendor at all
# -----------------
# three's XRControllerModelFactory defaults to fetching profiles from
# https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets, and its ONLY failure
# path is `.catch(console.warn)` - a network hiccup gives you a silent no-model,
# which is exactly the class of failure this project keeps losing days to. The
# controller is also the thing the on-controller button callouts are measured
# against, so "sometimes there is no model" means "sometimes the guidance rings
# fall back to eyeballed offsets" with nothing on screen saying so.
#
# Serving it from our own origin under /splat-vr/ makes it same-origin with the
# page (no CORS), immutable-cacheable, and offline-safe. src/controller-models.ts
# still falls back to the CDN and then to a procedural proxy, in that order.
#
# What is vendored
# ----------------
# Only meta-quest-touch-plus - the Quest 3 / 3S controller, ~443 KB for both
# hands. The other profiles are 0.6-1.6 MB each and nobody testing this has that
# hardware; a headset that reports something else falls through to the CDN.
# To add one: append its id to PROFILES below and re-run. profilesList.json is
# regenerated from PROFILES, so an id listed here is the only thing the runtime
# will try to load locally.
set -euo pipefail

VERSION="1.0.20"
BASE="https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@${VERSION}/dist/profiles"
PROFILES=(meta-quest-touch-plus)

cd "$(dirname "$0")/.."
OUT="public/controllers"
mkdir -p "$OUT"

for id in "${PROFILES[@]}"; do
  mkdir -p "$OUT/$id"
  for f in profile.json left.glb right.glb; do
    echo "  fetching $id/$f"
    curl -fsSL "$BASE/$id/$f" -o "$OUT/$id/$f"
  done
done

# A TRIMMED profilesList.json, not the upstream one. motion-controllers walks
# xrInputSource.profiles against this list and loads the first match, so listing
# a profile we did not vendor would produce a 404 instead of a clean fall-through
# to the CDN.
python3.10 - "$OUT" "${PROFILES[@]}" <<'PY'
import json, sys
out, ids = sys.argv[1], sys.argv[2:]
with open(f"{out}/profilesList.json", "w") as fh:
    json.dump({i: {"path": f"{i}/profile.json"} for i in ids}, fh, indent=2)
    fh.write("\n")
PY

echo
echo "Vendored @webxr-input-profiles/assets@${VERSION}:"
du -sh "$OUT"
find "$OUT" -type f | sort | sed 's/^/  /'
