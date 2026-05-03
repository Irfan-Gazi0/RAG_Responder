# Project Progress — Ford Mustang Mach-E 2026 First Responder RAG Portal

---

## 2026-04-16 — Initial Commit

**Status:** Foundation complete  
**Author:** Irfan Gazi

- Created project repository
- Built `inspector_portal.html` — 360° video player (Panolens + Three.js) with chatbot sidebar (Marked.js)
- Built `ingestion.ipynb` — PDF ingestion pipeline:
  - `unstructured` partition_pdf with GPT-4o Vision for image/table summarization
  - Chunking via `chunk_by_title`
  - OpenAI `text-embedding-3-small` embeddings (1536 dims)
  - Upserted to Pinecone index `ford-mache-erg`
  - Namespaces: `erg_full` (37 vectors), `rescue_sheet` (4 vectors)
- Built `transcribe_videos.py` — Whisper-based transcription for 360° MP4s
- Transcribed both 360° training videos with Whisper `turbo` model:
  - `VID_20250912_122900_00_010_012.mp4` → 1,862 segments, ~52 min
  - `VID_20250912_134205_00_013_014.mp4` → 1,613 segments, ~34 min
- Built `ingestion_transcript.ipynb` — initial transcript ingestion pipeline:
  - Sliding window chunker (window=10, step=8)
  - Upserted to `video_transcript` namespace: **537 vectors** (233 + 202 + 102 from combined)
- Deployed n8n workflow (`S3uHJF57JAuA7bL0`) with Router Agent (GPT-4o) querying all three Pinecone namespaces + Postgres chat memory
- **Total Pinecone vectors at milestone:** 578 (37 + 4 + 537)

---

## 2026-04-20 — Enriched Metadata + Evaluation Framework

**Status:** Metadata upgrade complete, evaluation set generated  
**Author:** Irfan Gazi (Claude Code assisted)

### Metadata Enrichment (video_transcript_v2 namespace)

**Problem:** The original `video_transcript` namespace stored only 12 metadata fields per vector — enough for retrieval but too sparse for rich n8n citations (no video_id, no title, no tags, no channel, no duration, no whisper provenance).

**Solution:** Rebuilt ingestion pipeline with a 23-field metadata schema matching a YouTube-style envelope.

**Files created/modified:**

| File | Change |
|---|---|
| `video_metadata.json` | **New** — static per-video config keyed by MP4 stem |
| `transcribe_videos.py` | **Updated** — output now wraps segments in a richer JSON envelope |
| `ingestion_transcript.ipynb` | **Rewritten** — new namespace, full schema, loads video_metadata.json |

**New metadata fields per Pinecone vector:**

| Category | Fields |
|---|---|
| Identity | `video_id`, `source_file`, `video_label`, `title`, `channel`, `video_url`, `thumbnail_url` |
| Temporal | `upload_date_iso`, `duration_hms`, `duration_seconds` |
| Taxonomy | `tags` (list), `categories` (list), `chapter` |
| Provenance | `whisper_model`, `transcribed_at`, `view_count` |
| Chunk | `chunk_index`, `chunk_start_hms`, `chunk_end_hms`, `chunk_start_seconds`, `chunk_end_seconds`, `segment_ids` |
| Content | `text` (1000-char preview), `doc_type`, `vehicle`, `namespace` |

**Field name changes (breaking from v1):**
- `start_hms` → `chunk_start_hms`
- `end_hms` → `chunk_end_hms`
- `start_time` → `chunk_start_seconds`
- `end_time` → `chunk_end_seconds`

**Ingestion run results:**

| Video | Chunks | Namespace |
|---|---|---|
| Video 1 — Exterior Walk-Around | 233 vectors | `video_transcript_v2` |
| Video 2 — Interior / Underside | 202 vectors | `video_transcript_v2` |
| **Total** | **435 vectors** | |

**Note:** `combined_segments.json` (original 814-segment training session transcript) is no longer present in `Talk/` and was not included in v2. The `video_transcript` namespace (537 vectors) remains untouched for backwards compatibility.

### n8n Agent System Message

Authored a comprehensive replacement system message for the video transcript Pinecone tool in n8n, replacing the generic 2-sentence description with:
- Per-video topic breakdown (what each video covers, approximate timestamps for topic transitions)
- Explicit list of topics covered vs. not covered
- Instructions on when to use this tool vs. ERG/rescue sheet tools
- Citation format guidance (video label + timestamp range)

### Evaluation Framework

- **`eval_questions.json`** — 50 ground-truth QA pairs derived from both transcripts
  - Covers all major topics: PPE, HV isolation, interlock device, battery architecture, thermal runaway, fire suppression, extrication, scene protocol, charging infrastructure, training resources, battery chemistry
  - Each question includes: `expected_answer`, `source.video`, `source.approximate_timestamp`, `topic`
  - Instructions embedded in JSON for use with automated or manual evaluation

---

## Current Pinecone State (as of 2026-04-20)

| Namespace | Vectors | Source | Notes |
|---|---|---|---|
| `erg_full` | 37 | ERG PDF | Active |
| `rescue_sheet` | 4 | Rescue Sheet PDF | Active |
| `video_transcript` | 537 | 3 segment files (incl. combined) | Legacy — kept for compatibility |
| `video_transcript_v2` | 435 | 2 segment files (VID_ only) | Active — enriched metadata |
| **Total** | **1,013** | | |

---

## 2026-05-03 — CloudFront HLS Video Integration + Portal Cleanup

**Status:** Deployed  
**Author:** Irfan Gazi (Claude Code assisted)

### Video Hosting — Local → CloudFront HLS

Local 360° MP4 files are not accessible on the deployed site. All three videos were uploaded to AWS CloudFront as HLS (`.m3u8`) adaptive streams.

| # | Label | CloudFront URL |
|---|---|---|
| 1 | Approach | `https://d109tss11k4jxu.cloudfront.net/video1_4k/VID_20250912_110210_00_007_009.m3u8` |
| 2 | Exterior | `https://d109tss11k4jxu.cloudfront.net/video2_4k/VID_20250912_122900_00_010_012.m3u8` |
| 3 | Interior | `https://d109tss11k4jxu.cloudfront.net/stream3/VID_20250912_134205_00_013_014.m3u8` |

**Note:** Video 1 (`007_009`) is a new scene not previously indexed.

### `inspector_portal.html` changes

- Added HLS.js (`hls.js@1.5.13`) CDN for browser HLS support (Safari uses native HLS)
- VIDEOS array updated to 3 CloudFront `.m3u8` URLs
- Added Video 3 toggle button
- HLS instances stored in `hlsInstances[]` (prevents GC mid-stream)
- Lazy HLS init via `ensureHls(idx)` — streams only load on first activation, not all at startup
- Removed `waitForVideo` poller (leaked intervals; unnecessary since `videoElement` is set synchronously when a pre-created `<video>` is passed to Panolens)

### `streamlit_app.py` changes

- Removed floating chat bubble and Streamlit sidebar chat — chat lives inside the embedded portal
- Removed unused `requests` and `uuid` imports

---

## Next Steps / Open Items

- [ ] Wire `video_transcript_v2` namespace into n8n workflow (replace or add alongside `video_transcript`)
- [ ] Run evaluation: send all 50 questions from `eval_questions.json` through the chatbot, score answers
- [ ] Decide whether to retire `video_transcript` namespace post-evaluation
- [ ] Consider adding chapter markers to `video_metadata.json` for finer-grained citations
- [ ] Portal UI: surface `chunk_start_seconds` from responses to auto-seek the 360° video player to the cited moment
