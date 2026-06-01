"""
Deploy the IWSDK portal v2 (portal/dist/) to S3 + invalidate CloudFront.

The IWSDK build is a multi-file bundle (index.html + hashed JS chunks + WASM)
rather than a single HTML file, so we upload the whole tree under the `v2/`
prefix preserving relative paths. Per CLAUDE.md hard rules:
  - put_object only (never copy_object — IAM lacks s3:GetObject)
  - HTML gets CacheControl="no-cache, must-revalidate" + ContentType="text/html"
  - Hashed assets (.js/.wasm/.json under assets/) get long max-age (immutable)

Usage:
  python3.10 deploy_portal_v2.py            # full deploy: upload + invalidate
  python3.10 deploy_portal_v2.py --upload   # upload only
  python3.10 deploy_portal_v2.py --invalidate-only
"""

import argparse
import mimetypes
import os
import sys
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(str(Path(__file__).parent / ".env"))

BUCKET = os.getenv("AWS_S3_BUCKET", "first-responder-training")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2")
CLOUDFRONT_DIST_ID = "E2FCJOSZVLDA5W"
PREFIX = "v2/"
DIST_DIR = Path(__file__).parent / "portal" / "dist"

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
}


def cache_control_for(rel_path: str) -> str:
    # index.html must always re-validate so deploys take effect immediately.
    # Hashed assets in assets/ are immutable (file name changes on rebuild).
    if rel_path == "index.html" or rel_path.endswith("/index.html"):
        return "no-cache, must-revalidate"
    if rel_path.startswith("assets/"):
        return "public, max-age=31536000, immutable"
    # UIKitML JSON gets short cache (regenerated on UIKitML edits)
    if rel_path.startswith("ui/"):
        return "public, max-age=300"
    return "no-cache, must-revalidate"


def content_type_for(rel_path: str) -> str:
    suffix = Path(rel_path).suffix.lower()
    if suffix in EXT_CONTENT_TYPE:
        return EXT_CONTENT_TYPE[suffix]
    guessed, _ = mimetypes.guess_type(rel_path)
    return guessed or "application/octet-stream"


def upload_dist(s3):
    if not DIST_DIR.is_dir():
        print(f"❌ {DIST_DIR} does not exist — run `cd portal && npm run build` first.")
        sys.exit(1)

    files = [p for p in DIST_DIR.rglob("*") if p.is_file()]
    if not files:
        print(f"❌ No files found in {DIST_DIR}")
        sys.exit(1)

    print(f"📦 Uploading {len(files)} files to s3://{BUCKET}/{PREFIX} …")
    for fp in files:
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
        size_kb = fp.stat().st_size / 1024
        print(f"  ✅ {key}  [{ctype}, {ccontrol}, {size_kb:.1f} KB]")


def invalidate_cloudfront():
    cf = boto3.client(
        "cloudfront",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    paths = [f"/{PREFIX}*"]
    import time

    caller_ref = f"v2-deploy-{int(time.time())}"
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
    parser = argparse.ArgumentParser(description="Deploy IWSDK portal v2 to S3 + CloudFront")
    parser.add_argument("--upload", action="store_true", help="Upload dist/ only (skip invalidation)")
    parser.add_argument("--invalidate-only", action="store_true", help="Invalidate CloudFront only (skip upload)")
    args = parser.parse_args()

    s3 = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    )

    if not args.invalidate_only:
        upload_dist(s3)
    if not args.upload:
        invalidate_cloudfront()

    print(f"\n🚀 Done. Portal v2 live at: https://d1ni7nkjr0eveg.cloudfront.net/{PREFIX}index.html")


if __name__ == "__main__":
    main()
