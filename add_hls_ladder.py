#!/usr/bin/env python3.10
"""
add_hls_ladder.py — give each 360° video an adaptive-bitrate (ABR) HLS ladder.

Why: the portal's only rendition was a single 4K30 H.264 stream. Chrome-on-Linux has
no HW H.264 decode, so the videosphere went black. Publishing a master playlist with
high/mid/low variants lets HLS.js auto-pick a rendition the client can decode.

Two modes (per stem, see STEMS below):

  reuse-4K  The existing 4K is ALREADY in S3 as a flat media playlist
            videos/<stem>/index.m3u8 + index*.ts. We must NOT re-upload the 4K
            segments. We save the existing media playlist as high.m3u8, add freshly
            encoded mid+low, and overwrite index.m3u8 with a 3-variant master. The
            4K index*.ts objects are never touched.

  full      Brand-new video with nothing in S3. Encode high(4K)+mid+low from the
            source mp4 and upload everything, master last.

Run with python3.10 (boto3 + python-dotenv live there; system python3 lacks them).
The `aws` CLI is absent and the IAM user lacks s3:GetObject, so we put_object local
bytes only (never copy_object). Every object gets ContentType + the project's
mandatory Cache-Control header.

    python3.10 add_hls_ladder.py                 # all stems, encode + upload + invalidate
    python3.10 add_hls_ladder.py --stem VID_...  # one stem only
    python3.10 add_hls_ladder.py --force         # re-encode even if outputs exist
    python3.10 add_hls_ladder.py --skip-encode   # upload existing local outputs only
    python3.10 add_hls_ladder.py --no-upload     # encode only, no S3 / no invalidation
    python3.10 add_hls_ladder.py --no-invalidate # upload but skip CloudFront invalidation
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv()

VIDEOS_DIR = Path(__file__).parent / "360"
BUCKET = os.getenv("AWS_S3_BUCKET")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
CLOUDFRONT_DIST_ID = "E2FCJOSZVLDA5W"
CACHE_CONTROL = "no-cache, must-revalidate"

# Variant ladder. All renditions of a stem keep the SAME 16:9 frame shape as the
# existing 4K (3840x2160 — the source 2:1 equirect was squashed by the original
# upload_to_s3.py). Mixing aspect ratios would shift the A-Frame videosphere
# projection on every ABR switch, so scale= is a forced resize (no aspect keep).
# CODECS: H.264 Main (constraint byte 0x40) at the level for that resolution@30fps,
# plus AAC-LC stereo (mp4a.40.2).
LADDER = {
    "high": dict(w=3840, h=2160, crf=22, codecs="avc1.4D4033,mp4a.40.2"),  # L5.1
    "mid":  dict(w=2560, h=1440, crf=23, codecs="avc1.4D4032,mp4a.40.2"),  # L5.0
    "low":  dict(w=1600, h=900,  crf=24, codecs="avc1.4D4028,mp4a.40.2"),  # L4.0
}

# The existing 4K (reuse-4K mode) is H.264 Constrained Baseline L3.0 + AAC-LC,
# 3840x2160 — measured via ffprobe on the live index0.ts.
HIGH_4K_CODECS = "avc1.42E01E,mp4a.40.2"
HIGH_4K_RES = (3840, 2160)

STEMS = {
    "VID_20250912_110210_00_007_009": "full",      # new — First Part
    "VID_20250912_122900_00_010_012": "reuse-4K",  # existing 4K in S3 — Second Part
    "VID_20250912_134205_00_013_014": "reuse-4K",  # existing 4K in S3 — Third Part
}


def run(cmd):
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True).stdout.strip()
    return float(out)


def encode_variant(src_mp4, out_dir, tier, force):
    """Encode one rendition into out_dir/index.m3u8 + seg*.ts. Idempotent."""
    spec = LADDER[tier]
    playlist = out_dir / "index.m3u8"
    if playlist.exists() and not force:
        print(f"  ✓ {tier}: exists, skipping (use --force to re-encode)")
        return playlist
    out_dir.mkdir(parents=True, exist_ok=True)
    # forced resize (no aspect keep) to match the existing 4K's squashed mapping;
    # 2s GOP, no scene-cut keyframes -> clean ABR switch points; 8s segments to
    # line up with the existing ~8.34s 4K cadence as closely as possible.
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-nostdin", "-y",
        "-i", str(src_mp4),
        "-vf", f"scale={spec['w']}:{spec['h']}",
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main",
        "-pix_fmt", "yuv420p", "-crf", str(spec["crf"]),
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-c:a", "aac", "-b:a", "128k", "-ac", "2",
        "-hls_time", "8", "-hls_list_size", "0", "-start_number", "0",
        "-hls_segment_filename", str(out_dir / "seg%d.ts"),
        "-f", "hls", str(playlist),
    ])
    print(f"  ✓ {tier}: encoded -> {playlist}")
    return playlist


def peak_bandwidth(playlist, seg_dir):
    """Peak BANDWIDTH (bits/s) = max(segment_bytes * 8 / segment_duration)."""
    lines = playlist.read_text().splitlines()
    peak = 0
    dur = None
    for ln in lines:
        if ln.startswith("#EXTINF:"):
            dur = float(ln[len("#EXTINF:"):].split(",")[0])
        elif ln and not ln.startswith("#"):
            seg = seg_dir / ln.strip()
            if dur and seg.exists():
                peak = max(peak, int(seg.stat().st_size * 8 / dur))
            dur = None
    return peak or 1_000_000


def s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=REGION,
    )


def content_type(name):
    if name.endswith(".m3u8"):
        return "application/x-mpegURL"
    if name.endswith(".ts"):
        return "video/MP2T"
    return "application/octet-stream"


def put(s3, local_path, key):
    s3.put_object(
        Bucket=BUCKET, Key=key, Body=local_path.read_bytes(),
        ContentType=content_type(key), CacheControl=CACHE_CONTROL,
    )
    print(f"  ↑ s3://{BUCKET}/{key}")


def put_bytes(s3, data, key):
    s3.put_object(
        Bucket=BUCKET, Key=key, Body=data,
        ContentType=content_type(key), CacheControl=CACHE_CONTROL,
    )
    print(f"  ↑ s3://{BUCKET}/{key}")


def upload_variant_dir(s3, var_dir, stem, tier):
    """Upload every file in var_dir -> videos/<stem>/<tier>/<name>."""
    for f in sorted(var_dir.iterdir()):
        if f.is_file():
            put(s3, f, f"videos/{stem}/{tier}/{f.name}")


def build_master(entries):
    """entries: list of (bandwidth, (w,h), codecs, uri)."""
    out = ["#EXTM3U", "#EXT-X-VERSION:3"]
    for bw, (w, h), codecs, uri in entries:
        out.append(
            f'#EXT-X-STREAM-INF:BANDWIDTH={bw},'
            f'RESOLUTION={w}x{h},CODECS="{codecs}"'
        )
        out.append(uri)
    return ("\n".join(out) + "\n").encode()


def process_stem(stem, mode, args, s3):
    print(f"\n=== {stem}  [{mode}] ===")
    src_mp4 = VIDEOS_DIR / f"{stem}.mp4"
    stem_dir = VIDEOS_DIR / stem
    entries = []  # (bandwidth, (w,h), codecs, master-relative-uri)

    if mode == "reuse-4K":
        live_playlist = stem_dir / "index.m3u8"
        if not live_playlist.exists():
            sys.exit(f"  ✗ missing local 4K media playlist {live_playlist}")
        # high = the existing 4K media playlist, reused IN PLACE. We upload it as
        # high.m3u8; its relative indexN.ts resolve to the existing S3 objects.
        bw = peak_bandwidth(live_playlist, stem_dir)
        entries.append((bw, HIGH_4K_RES, HIGH_4K_CODECS, "high.m3u8"))
        tiers = ["mid", "low"]
    else:  # full
        if not src_mp4.exists():
            sys.exit(f"  ✗ missing source {src_mp4}")
        tiers = ["high", "mid", "low"]

    # Encode the tiers we own.
    for tier in tiers:
        out_dir = stem_dir / tier
        if not args.skip_encode:
            encode_variant(src_mp4, out_dir, tier, args.force)
        pl = out_dir / "index.m3u8"
        if not pl.exists():
            sys.exit(f"  ✗ expected {pl} (run without --skip-encode)")
        bw = peak_bandwidth(pl, out_dir)
        spec = LADDER[tier]
        entries.append((bw, (spec["w"], spec["h"]), spec["codecs"],
                        f"{tier}/index.m3u8"))

    # Order master high->low (descending bandwidth) for readability; HLS.js sorts.
    order = {"high.m3u8": 0, "high/index.m3u8": 0,
             "mid/index.m3u8": 1, "low/index.m3u8": 2}
    entries.sort(key=lambda e: order.get(e[3], 9))
    master = build_master(entries)
    print("  master playlist:\n    " + master.decode().replace("\n", "\n    "))

    if args.no_upload:
        print("  (--no-upload: skipping S3)")
        return

    # Upload order: variants first, master LAST (never a broken window). In
    # reuse-4K we additionally upload the saved 4K media playlist as high.m3u8
    # but NEVER the index*.ts (they already live in S3 untouched).
    if mode == "reuse-4K":
        put(s3, stem_dir / "index.m3u8", f"videos/{stem}/high.m3u8")
        for tier in ["mid", "low"]:
            upload_variant_dir(s3, stem_dir / tier, stem, tier)
    else:
        for tier in ["high", "mid", "low"]:
            upload_variant_dir(s3, stem_dir / tier, stem, tier)

    put_bytes(s3, master, f"videos/{stem}/index.m3u8")  # master LAST
    print(f"  ✓ {stem} published")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stem", help="process only this stem")
    ap.add_argument("--force", action="store_true", help="re-encode even if outputs exist")
    ap.add_argument("--skip-encode", action="store_true", help="upload existing outputs only")
    ap.add_argument("--no-upload", action="store_true", help="encode only")
    ap.add_argument("--no-invalidate", action="store_true", help="skip CloudFront invalidation")
    args = ap.parse_args()

    if not BUCKET:
        sys.exit("AWS_S3_BUCKET not set in .env")

    stems = {args.stem: STEMS[args.stem]} if args.stem else STEMS
    s3 = None if args.no_upload else s3_client()

    for stem, mode in stems.items():
        process_stem(stem, mode, args, s3)

    if args.no_upload or args.no_invalidate:
        print("\n(skipping CloudFront invalidation)")
        return

    cf = boto3.client(
        "cloudfront",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    import time
    inv = cf.create_invalidation(
        DistributionId=CLOUDFRONT_DIST_ID,
        InvalidationBatch={
            "Paths": {"Quantity": 2, "Items": ["/videos/*", "/inspector_portal.html"]},
            "CallerReference": f"add-hls-ladder-{int(time.time())}",
        },
    )
    print(f"\n✓ CloudFront invalidation {inv['Invalidation']['Id']} created "
          f"(/videos/*, /inspector_portal.html)")


if __name__ == "__main__":
    main()
