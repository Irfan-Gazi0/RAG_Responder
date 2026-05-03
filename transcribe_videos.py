"""
transcribe_videos.py
====================
Transcribes all .mp4 files in 360/ using local OpenAI Whisper.
Outputs one *_segments.json per video to Talk/.

Prerequisites (run once):
    brew install ffmpeg
    pip install openai-whisper

Usage:
    python3 transcribe_videos.py                  # default: medium model
    python3 transcribe_videos.py --model large-v3 # more accurate, slower
    python3 transcribe_videos.py --force          # re-transcribe already done files
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
VIDEOS_DIR = Path(__file__).parent / "360"
OUTPUT_DIR = Path(__file__).parent / "Talk"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--model", default="medium",
                    choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3",
                             "large-v3-turbo", "turbo"],
                    help="Whisper model size (default: medium)")
parser.add_argument("--force", action="store_true",
                    help="Re-transcribe files that already have output JSON")
args = parser.parse_args()


def seconds_to_hms(seconds: float) -> str:
    """Convert float seconds to zero-padded HH:MM:SS string."""
    total = int(seconds)
    h, remainder = divmod(total, 3600)
    m, s = divmod(remainder, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def transcribe(video_path: Path, model) -> list[dict]:
    """Run Whisper on a video file and return formatted segments."""
    print(f"  Transcribing (this may take a while for large files)...")
    result = model.transcribe(str(video_path), verbose=False)

    segments = []
    for i, seg in enumerate(result["segments"], start=1):
        segments.append({
            "id":        i,
            "start":     round(float(seg["start"]), 2),
            "end":       round(float(seg["end"]), 2),
            "start_hms": seconds_to_hms(seg["start"]),
            "end_hms":   seconds_to_hms(seg["end"]),
            "text":      seg["text"].strip(),
        })

    return segments


def main():
    # ── Discover videos ───────────────────────────────────────────────────────
    videos = sorted(VIDEOS_DIR.glob("*.mp4"))
    if not videos:
        print(f"No .mp4 files found in {VIDEOS_DIR}")
        sys.exit(0)

    print(f"Found {len(videos)} video(s) in {VIDEOS_DIR.name}/")
    for v in videos:
        print(f"  {v.name}  ({v.stat().st_size / 1e9:.1f} GB)")

    # ── Load Whisper model ────────────────────────────────────────────────────
    try:
        import whisper
    except ImportError:
        print("\nERROR: whisper not installed. Run:  pip install openai-whisper")
        sys.exit(1)

    print(f"\nLoading Whisper model '{args.model}'...")
    model = whisper.load_model(args.model)
    print("Model loaded.\n")

    # ── Process each video ────────────────────────────────────────────────────
    for video_path in videos:
        out_path = OUTPUT_DIR / (video_path.stem + "_segments.json")

        print(f"{'─' * 60}")
        print(f"Video : {video_path.name}")
        print(f"Output: {out_path.name}")

        if out_path.exists() and not args.force:
            existing = json.loads(out_path.read_text())
            segs = existing if isinstance(existing, list) else existing.get("segments", [])
            print(f"  Already transcribed ({len(segs)} segments) — skipping. Use --force to redo.")
            continue

        segments = transcribe(video_path, model)

        duration_hms = seconds_to_hms(segments[-1]["end"]) if segments else "00:00:00"
        output = {
            "source_file":   video_path.name,
            "whisper_model": args.model,
            "transcribed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "duration_hms":  duration_hms,
            "segments":      segments,
        }
        out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
        print(f"  ✅ Saved {len(segments)} segments  "
              f"(duration ~{duration_hms})  →  {out_path}")

    print(f"\n{'─' * 60}")
    print(f"Done. Output files in {OUTPUT_DIR}/")
    print("Next step: run ingestion_transcript.ipynb to index new transcripts into Pinecone.")


if __name__ == "__main__":
    main()
