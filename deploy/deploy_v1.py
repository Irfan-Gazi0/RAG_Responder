"""
Deploy the v1 single-file HTML pages to S3 + invalidate CloudFront.

After the v2 S3-root cutover (2026-09-07) these two files have different jobs:

  apps/v1/chat_panel.html       -> /chat_panel.html         (LIVE, maintained)
      The standalone chat panel embedded by the Streamlit "3D Views of EVs" tab.
      Since v2 owns the root, nothing else serves this chat block any more — this
      file is now the sole owner of the v1-era chat client, not a duplicate of
      inspector_portal.html's.

  apps/v1/inspector_portal.html -> /v1/inspector_portal.html (FROZEN fallback)
      The retired A-Frame portal. Kept deployable so `?portal=v1` on the Streamlit
      app has somewhere real to point, and so the cutover has a rollback.

Per CLAUDE.md hard rules: put_object only (IAM lacks s3:GetObject, so
copy_object fails), always CacheControl="no-cache, must-revalidate" +
ContentType="text/html", and always invalidate — the header fixes browsers, not
the edge.

Usage:
  python3.10 deploy/deploy_v1.py                  # chat_panel + /v1/ archive
  python3.10 deploy/deploy_v1.py --chat-only      # just chat_panel.html
  python3.10 deploy/deploy_v1.py --restore-root   # ROLLBACK: v1 back at the root

`--restore-root` is the escape hatch for the v2 cutover. It re-puts the A-Frame
portal at /inspector_portal.html, which is what Streamlit's default tab loads.
Pair it with reverting CACHE_BUST/PORTAL_URL in streamlit_app.py.

Every path ends by re-fetching each uploaded page and asserting the live bytes
hash to the local file, exiting non-zero otherwise — an unverified deploy is how
splat-vr once sat five days behind source.
"""

import argparse
import hashlib
import os
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
CDN = "https://d1ni7nkjr0eveg.cloudfront.net"
V1_DIR = REPO_ROOT / "apps" / "v1"

CHAT_PANEL = ("chat_panel.html", "chat_panel.html")
V1_ARCHIVE = ("inspector_portal.html", "v1/inspector_portal.html")
V1_AT_ROOT = ("inspector_portal.html", "inspector_portal.html")


def upload(s3, local_name: str, key: str) -> None:
    path = V1_DIR / local_name
    if not path.is_file():
        print(f"❌ {path} does not exist.")
        sys.exit(1)
    body = path.read_bytes()
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=body,
        ContentType="text/html",
        CacheControl="no-cache, must-revalidate",
    )
    print(f"  ✅ {key}  [text/html, no-cache, {len(body) / 1024:.1f} KB]")


def invalidate(paths: list) -> None:
    cf = boto3.client(
        "cloudfront",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    print(f"🌐 Invalidating CloudFront {CLOUDFRONT_DIST_ID} paths: {paths}")
    resp = cf.create_invalidation(
        DistributionId=CLOUDFRONT_DIST_ID,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": f"v1-deploy-{int(time.time())}",
        },
    )
    print(f"  ✅ Invalidation: {resp['Invalidation']['Id']} ({resp['Invalidation']['Status']})")


def verify(pairs: list, attempts: int = 6, delay: int = 10) -> None:
    """Re-fetch each page and assert the edge serves the local bytes."""
    for local_name, key in pairs:
        want = hashlib.sha256((V1_DIR / local_name).read_bytes()).hexdigest()
        url = f"{CDN}/{key}"
        print(f"🔎 Verifying {url} …")
        got = None
        for attempt in range(1, attempts + 1):
            try:
                req = Request(
                    url,
                    headers={
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                        "User-Agent": "deploy-verify",
                    },
                )
                with urlopen(req, timeout=20) as resp:
                    if resp.status != 200:
                        raise URLError(f"HTTP {resp.status}")
                    got = hashlib.sha256(resp.read()).hexdigest()
                if got == want:
                    print(f"  ✅ Live bytes match {local_name} ({want[:12]}…)")
                    break
                print(f"  … attempt {attempt}/{attempts}: edge serving {got[:12]}…, want {want[:12]}…")
            except (URLError, OSError) as exc:
                print(f"  … attempt {attempt}/{attempts}: {exc}")
            if attempt < attempts:
                time.sleep(delay)
        else:
            print(f"❌ Deploy verification FAILED for {url}")
            print(f"   expected sha256 {want}")
            print(f"   served   sha256 {got}")
            print("   Do NOT treat this as deployed.")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Deploy the v1 single-file HTML pages")
    parser.add_argument(
        "--chat-only", action="store_true", help="Upload chat_panel.html only (skip the /v1/ archive)"
    )
    parser.add_argument(
        "--restore-root",
        action="store_true",
        help="ROLLBACK: put the A-Frame portal back at /inspector_portal.html",
    )
    args = parser.parse_args()

    if args.chat_only and args.restore_root:
        parser.error("--chat-only and --restore-root are mutually exclusive")

    if args.restore_root:
        pairs = [V1_AT_ROOT]
        paths = ["/inspector_portal.html"]
        print("⚠  ROLLBACK: restoring the A-Frame v1 portal at the bucket root.")
    elif args.chat_only:
        pairs = [CHAT_PANEL]
        paths = ["/chat_panel.html"]
    else:
        pairs = [CHAT_PANEL, V1_ARCHIVE]
        paths = ["/chat_panel.html", "/v1/inspector_portal.html"]

    s3 = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    )

    print(f"📦 Uploading {len(pairs)} file(s) to s3://{BUCKET}/ …")
    for local_name, key in pairs:
        upload(s3, local_name, key)

    invalidate(paths)
    verify(pairs)

    print("\n🚀 Done:")
    for _, key in pairs:
        print(f"   {CDN}/{key}")


if __name__ == "__main__":
    main()
