"""
Deploy the standalone WebXR splat viewer (splat-vr/dist/) to S3 + invalidate CloudFront.

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

Run from the repo root, not splat-vr/.
"""

import argparse
import mimetypes
import os
import sys
import time
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(str(Path(__file__).parent / ".env"))

BUCKET = os.getenv("AWS_S3_BUCKET", "first-responder-training")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2")
CLOUDFRONT_DIST_ID = "E2FCJOSZVLDA5W"
PREFIX = "splat-vr/"
DIST_DIR = Path(__file__).parent / "splat-vr" / "dist"

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
    ".woff": "font-woff",
    ".woff2": "font-woff2",
    # Gaussian-splat payloads. mimetypes.guess_type does not know these on Linux
    # and would fall through to a bare octet-stream with no explicit intent.
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
    return "no-cache, must-revalidate"


def content_type_for(rel_path: str) -> str:
    suffix = Path(rel_path).suffix.lower()
    if suffix in EXT_CONTENT_TYPE:
        return EXT_CONTENT_TYPE[suffix]
    guessed, _ = mimetypes.guess_type(rel_path)
    return guessed or "application/octet-stream"


def upload_dist(s3, skip_models: bool):
    if not DIST_DIR.is_dir():
        print(f"❌ {DIST_DIR} does not exist — run `cd splat-vr && npm run build` first.")
        sys.exit(1)

    files = [p for p in DIST_DIR.rglob("*") if p.is_file()]
    if skip_models:
        files = [p for p in files if not p.relative_to(DIST_DIR).as_posix().startswith("models/")]
    if not files:
        print(f"❌ No files found in {DIST_DIR}")
        sys.exit(1)

    # The .ply download cache is 139 MB and must never reach S3. It lives in
    # splat-vr/.splat-src/ precisely so Vite's publicDir copy cannot pick it up,
    # but assert here too — this shipped once already.
    strays = [p for p in files if p.suffix.lower() == ".ply"]
    if strays:
        print(f"❌ Refusing to upload {len(strays)} .ply source file(s) found in dist/:")
        for p in strays[:5]:
            print(f"     {p.relative_to(DIST_DIR)}")
        print("   These are conversion inputs — they belong in splat-vr/.splat-src/.")
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

    s3 = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    )

    if not args.invalidate_only:
        upload_dist(s3, args.skip_models)
    if not args.upload:
        invalidate_cloudfront()

    url = f"https://d1ni7nkjr0eveg.cloudfront.net/{PREFIX}index.html"
    print(f"\n🚀 Done. Splat VR viewer live at: {url}")
    print("   Test VR on the headset at that URL directly — NOT through the")
    print("   Streamlit tab, whose iframe withholds xr-spatial-tracking.")


if __name__ == "__main__":
    main()
