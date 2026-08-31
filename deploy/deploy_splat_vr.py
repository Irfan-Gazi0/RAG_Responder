"""
Deploy the standalone WebXR splat viewer (apps/splat-vr/dist/) to S3 + invalidate CloudFront.

Same shape as deploy_portal_v2.py, different prefix. Per CLAUDE.md hard rules:
  - `aws` CLI is NOT installed — python3.10 + boto3 + dotenv only
  - put_object only (never copy_object — IAM user `Irfan` lacks s3:GetObject)
  - load_dotenv with an absolute path (find_dotenv fails under a stdin heredoc)
  - HTML gets no-cache; hashed assets get immutable

Serving the .spz models from our own CloudFront puts them same-origin with the
page, which sidesteps the missing Access-Control-Allow-Origin that breaks the
360° HLS from anywhere but production.

Usage:
  python3.10 deploy_splat_vr.py                  # upload + invalidate
  python3.10 deploy_splat_vr.py --upload         # upload only
  python3.10 deploy_splat_vr.py --invalidate-only
  python3.10 deploy_splat_vr.py --skip-models    # code only, leave .spz in place

Every path ends by re-fetching the live index.html and asserting it references
the same hashed bundle as the local dist/. A deploy that cannot be seen from the
edge is not a deploy — the live viewer sat five days behind source (bugs.md P0-2)
precisely because this script printed a success line it had not earned.

Runs from any cwd: .env and dist/ resolve from the repo root via __file__.
"""

import argparse
import mimetypes
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import boto3
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(str(REPO_ROOT / ".env"))

BUCKET = os.getenv("AWS_S3_BUCKET", "first-responder-training")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2")
CLOUDFRONT_DIST_ID = "E2FCJOSZVLDA5W"
PREFIX = "splat-vr/"
DIST_DIR = REPO_ROOT / "apps" / "splat-vr" / "dist"

EXT_CONTENT_TYPE = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".css": "text/css",
    ".map": "application/json",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    # Gaussian-splat payloads. mimetypes.guess_type does not know these on Linux
    # and would fall through to a bare octet-stream with no explicit intent.
    # Controller models (webxr-input-profiles). mimetypes does not know .glb on
    # Linux either, and a bare octet-stream works only because GLTFLoader sniffs
    # the magic bytes - say what it is.
    ".glb": "model/gltf-binary",
    ".spz": "application/octet-stream",
    ".ply": "application/octet-stream",
    ".splat": "application/octet-stream",
}


def cache_control_for(rel_path: str) -> str:
    # index.html must always re-validate so deploys take effect immediately.
    if rel_path == "index.html" or rel_path.endswith("/index.html"):
        return "no-cache, must-revalidate"
    # Hashed bundles: the filename changes on every rebuild.
    if rel_path.startswith("assets/"):
        return "public, max-age=31536000, immutable"
    # Models are content-stable and expensive (2-4 MB each) — cache them hard.
    # Re-converting a scan keeps the same filename, so that needs an explicit
    # invalidation (the --invalidate-only flag covers it).
    if rel_path.startswith("models/"):
        return "public, max-age=31536000, immutable"
    # Controller assets are version-pinned by scripts/fetch_controller_assets.sh
    # and change only when that script is re-run, so re-fetching 450 KB of glTF
    # on every page load would be pure waste. Same caveat as models/: filenames
    # are stable, so a re-vendor needs an explicit --invalidate-only.
    if rel_path.startswith("controllers/"):
        return "public, max-age=31536000, immutable"
    return "no-cache, must-revalidate"


def content_type_for(rel_path: str) -> str:
    suffix = Path(rel_path).suffix.lower()
    if suffix in EXT_CONTENT_TYPE:
        return EXT_CONTENT_TYPE[suffix]
    guessed, _ = mimetypes.guess_type(rel_path)
    return guessed or "application/octet-stream"


def upload_dist(s3, skip_models: bool):
    if not DIST_DIR.is_dir():
        print(f"❌ {DIST_DIR} does not exist — run `cd apps/splat-vr && npm run build` first.")
        sys.exit(1)

    files = [p for p in DIST_DIR.rglob("*") if p.is_file()]
    if skip_models:
        files = [p for p in files if not p.relative_to(DIST_DIR).as_posix().startswith("models/")]
    if not files:
        print(f"❌ No files found in {DIST_DIR}")
        sys.exit(1)

    # The .ply download cache is 139 MB and must never reach S3. It lives in
    # apps/splat-vr/.splat-src/ precisely so Vite's publicDir copy cannot pick it up,
    # but assert here too — this shipped once already.
    strays = [p for p in files if p.suffix.lower() == ".ply"]
    if strays:
        print(f"❌ Refusing to upload {len(strays)} .ply source file(s) found in dist/:")
        for p in strays[:5]:
            print(f"     {p.relative_to(DIST_DIR)}")
        print("   These are conversion inputs — they belong in apps/splat-vr/.splat-src/.")
        sys.exit(1)

    total = sum(p.stat().st_size for p in files)
    print(f"📦 Uploading {len(files)} files ({total / 1e6:.1f} MB) to s3://{BUCKET}/{PREFIX} …")
    for fp in sorted(files):
        rel = fp.relative_to(DIST_DIR).as_posix()
        key = PREFIX + rel
        ctype = content_type_for(rel)
        ccontrol = cache_control_for(rel)
        with open(fp, "rb") as fh:
            s3.put_object(
                Bucket=BUCKET,
                Key=key,
                Body=fh.read(),
                ContentType=ctype,
                CacheControl=ccontrol,
            )
        print(f"  ✅ {key}  [{ctype}, {ccontrol}, {fp.stat().st_size / 1024:.1f} KB]")


LIVE_URL = f"https://d1ni7nkjr0eveg.cloudfront.net/{PREFIX}index.html"

# Vite writes <script type="module" src="./assets/index-<hash>.js">. The hash
# changes on every rebuild, which is exactly what makes it a deploy fingerprint.
ASSET_RE = re.compile(r"assets/[A-Za-z0-9._-]+\.js")


def local_bundles() -> set:
    """The hashed JS bundles the freshly-built local index.html references."""
    index = DIST_DIR / "index.html"
    if not index.is_file():
        print(f"❌ {index} does not exist — run `cd apps/splat-vr && npm run build` first.")
        sys.exit(1)
    names = set(ASSET_RE.findall(index.read_text(encoding="utf-8", errors="replace")))
    if not names:
        print(f"❌ No assets/*.js reference found in {index} — cannot verify the deploy.")
        sys.exit(1)
    return names


def verify_live(expected: set, attempts: int = 6, delay: int = 10) -> None:
    """Re-fetch the live page and assert the edge serves this build.

    index.html is uploaded `no-cache, must-revalidate`, so CloudFront revalidates
    against the origin and this normally passes on the first try; the retries
    cover an invalidation that is still in progress.
    """
    print(f"🔎 Verifying {LIVE_URL} serves {', '.join(sorted(expected))} …")
    served = set()
    for attempt in range(1, attempts + 1):
        try:
            req = Request(
                LIVE_URL,
                headers={"Cache-Control": "no-cache", "Pragma": "no-cache", "User-Agent": "deploy-verify"},
            )
            with urlopen(req, timeout=20) as resp:
                if resp.status != 200:
                    raise URLError(f"HTTP {resp.status}")
                html = resp.read().decode("utf-8", errors="replace")
            served = set(ASSET_RE.findall(html))
            if expected <= served:
                print(f"  ✅ Live bundle matches dist/ ({', '.join(sorted(served))})")
                return
            print(f"  … attempt {attempt}/{attempts}: edge still serving {sorted(served) or 'no bundle'}")
        except (URLError, OSError) as exc:
            print(f"  … attempt {attempt}/{attempts}: {exc}")
        if attempt < attempts:
            time.sleep(delay)

    print("❌ Deploy verification FAILED.")
    print(f"   expected: {sorted(expected)}")
    print(f"   served:   {sorted(served) or '(none)'}")
    print("   The upload or the invalidation did not take. Do NOT treat this as deployed.")
    sys.exit(1)


def invalidate_cloudfront():
    cf = boto3.client(
        "cloudfront",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    paths = [f"/{PREFIX}*"]
    caller_ref = f"splat-vr-deploy-{int(time.time())}"
    print(f"🌐 Invalidating CloudFront {CLOUDFRONT_DIST_ID} paths: {paths}")
    resp = cf.create_invalidation(
        DistributionId=CLOUDFRONT_DIST_ID,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": caller_ref,
        },
    )
    print(f"  ✅ Invalidation: {resp['Invalidation']['Id']} ({resp['Invalidation']['Status']})")


def main():
    parser = argparse.ArgumentParser(description="Deploy the WebXR splat viewer to S3 + CloudFront")
    parser.add_argument("--upload", action="store_true", help="Upload dist/ only (skip invalidation)")
    parser.add_argument("--invalidate-only", action="store_true", help="Invalidate CloudFront only")
    parser.add_argument("--skip-models", action="store_true", help="Skip models/ (code-only redeploy)")
    args = parser.parse_args()

    # --upload means "skip invalidation" and --invalidate-only means "skip
    # upload"; together they meant "do nothing", and still printed success.
    if args.upload and args.invalidate_only:
        parser.error("--upload and --invalidate-only are mutually exclusive (together they do nothing)")
    if args.invalidate_only and args.skip_models:
        parser.error("--skip-models has no effect with --invalidate-only (nothing is uploaded)")

    s3 = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    )

    expected = local_bundles()

    if not args.invalidate_only:
        upload_dist(s3, args.skip_models)
    if not args.upload:
        invalidate_cloudfront()

    # Exits non-zero if the edge is not serving this build — the success line
    # below is only reached once that has been proven.
    verify_live(expected)

    print(f"\n🚀 Done. Splat VR viewer live at: {LIVE_URL}")
    print("   Test VR on the headset at that URL directly — NOT through the")
    print("   Streamlit tab, whose iframe withholds xr-spatial-tracking.")


if __name__ == "__main__":
    main()
