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

## 2026-05-04 — CloudFront Migration + Streamlit CORS Fix

**Status:** Deployed  
**Author:** Irfan Gazi (Claude Code assisted)

### Problem

Streamlit Cloud (`nec4-jumpstart.streamlit.app`) showed a black screen in the VR Videos tab. Root cause: `components.html()` injects HTML into a sandboxed `about:srcdoc` iframe whose origin is `nec4-jumpstart.streamlit.app`. HLS.js fetches `.m3u8` and `.ts` files via XHR, which triggers CORS. The old CloudFront distribution (`d109tss11k4jxu.cloudfront.net`) had no `Access-Control-Allow-Origin` response header, so all video requests were blocked.

### Solution

Moved video hosting and portal HTML to a single CloudFront distribution (`d1ni7nkjr0eveg.cloudfront.net`) backed by the `first-responder-training` S3 bucket (us-east-2). Since the HTML and all video segments now share the same origin, CORS is eliminated entirely — no response headers policy or S3 CORS policy needed.

`streamlit_app.py` changed from `components.html(open(...))` to `components.iframe("https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html")`.

### Changes

| File | Change |
|---|---|
| `inspector_portal.html` | VIDEOS array updated to new CloudFront paths; reduced from 3 to 2 videos |
| `streamlit_app.py` | Switched from `components.html()` to `components.iframe()` → CloudFront URL |

### Video inventory (new bucket)

| # | Label | S3 path | CloudFront URL |
|---|---|---|---|
| 1 | Exterior Walk-Around | `videos/VID_20250912_122900_00_010_012/index.m3u8` | `d1ni7nkjr0eveg.cloudfront.net/...` |
| 2 | Interior / Underside | `videos/VID_20250912_134205_00_013_014/index.m3u8` | `d1ni7nkjr0eveg.cloudfront.net/...` |

**Note:** The "Approach" video (`007_009`) was not available in the new bucket and was removed from the portal.

---

## 2026-05-04 — Chatbox Added to Gaussian Splatting Tab

**Status:** Deployed  
**Author:** Irfan Gazi (Claude Code assisted)

### Change

Added the RAG chatbot to the **Gaussian Model Viewing** tab in `streamlit_app.py`. The tab now uses a 2-column layout (2:1 ratio):
- **Left:** 3D Gaussian Splat viewer iframe (unchanged)
- **Right:** Native Streamlit chat panel (`st.chat_message` + `st.chat_input`) backed by the same n8n webhook as the VR Videos portal

Each Gaussian tab session gets its own `session_id` (UUID stored in `st.session_state`) so Postgres chat memory in n8n tracks it independently from VR video sessions.

| File | Change |
|---|---|
| `streamlit_app.py` | Split tab2 into 2-column layout; added full chat state + n8n webhook POST |

---

## 2026-05-04 — HLS Fix + Whisper Voice Input + chat_panel.html

**Status:** Deployed  
**Author:** Irfan Gazi (Claude Code assisted)

### HLS fix (`inspector_portal.html`)

`attachMedia()` must be called before `loadSource()` in HLS.js or the manifest never fires. Fixed `ensureHls()` to call `hls.attachMedia(v)` first, then `hls.loadSource(src)`. Added `MANIFEST_PARSED` guard so `play()` is only called once the stream is ready — eliminated the black-screen-on-first-load bug.

### Whisper voice input button (`inspector_portal.html`)

Added a 🎤 microphone button to the chat input row. Clicking starts/stops `MediaRecorder` (browser audio capture); on stop the audio blob is POSTed to the OpenAI Whisper API (`whisper-1`) and the transcript is inserted into the chat textarea. Button states: idle → recording (red pulse animation) → processing (spinner) → idle.

**Note:** `OPENAI_API_KEY` in the portal JS is a placeholder (`"YOUR_OPENAI_API_KEY"`). Set the real key before uploading to CloudFront if voice input is needed.

### chat_panel.html + Gaussian tab refactor (`streamlit_app.py`)

The native Streamlit chat widget in the Gaussian Splatting tab was replaced with an `<iframe>` pointing to `chat_panel.html` hosted on CloudFront. This gives the Gaussian tab an identical chat experience to the VR portal (same Marked.js rendering, same n8n webhook, same session_id persistence). The iframe is `components.iframe(CHAT_URL, height=750)`.

| File | Change |
|---|---|
| `chat_panel.html` | New — standalone chatbot panel, identical feature set to portal's chat sidebar |
| `streamlit_app.py` | tab2 chat column changed from `st.chat_message` loop to `components.iframe(CHAT_URL)` |

---

## 2026-05-04 — Meta Quest 3 VR Support (A-Frame Migration)

**Status:** Deployed  
**Author:** Irfan Gazi (Claude Code assisted)

### Problem

`inspector_portal.html` used Panolens.js v0.12.1 (built on Three.js v0.125.2) for the 360° viewer. Panolens has no WebXR integration — on Meta Quest 3, the browser could only navigate the video with the joystick like a regular 2D browser. No "Enter VR" button, no head-tracking.

### Solution

Replaced Panolens + Three.js with **A-Frame v1.6**, which bundles its own Three.js with full WebXR support:
- `<a-scene embedded>` keeps the scene inside the existing panel layout on desktop
- `<a-videosphere src="#aframe-vid-0">` renders the equirectangular video on a sphere (identical geometry to Panolens)
- A-Frame's built-in VR mode UI renders an "Enter VR" button automatically on WebXR-capable devices (Quest 3, etc.)
- On Quest 3, tapping "Enter VR" drops the user into full immersive-vr mode with natural head-tracking

HLS.js integration is unchanged — it attaches to the `<video>` elements in `<a-assets>` the same way as before. All video controls (play/pause, mute, seek, video switching) operate on the raw `<video>` DOM elements and required no changes.

A-Frame initialization is async; `activatePanorama(0)` is now called inside `scene.addEventListener("loaded", ...)` to avoid a race condition.

### Streamlit note

`components.iframe()` does not support the `allow=` attribute, so `xr-spatial-tracking` cannot be granted to the embedded iframe. VR requires opening the CloudFront URL directly in the Quest browser. An `st.info()` banner was added to tab1 with the direct link.

### Changes

| File | Change |
|---|---|
| `inspector_portal.html` | Panolens + Three.js → A-Frame v1.6; `<div>` → `<a-scene embedded>`; JS block rewritten |
| `streamlit_app.py` | Added `st.info()` banner with direct CloudFront URL for Quest VR users |

**Direct VR URL:** `https://d1ni7nkjr0eveg.cloudfront.net/inspector_portal.html`

---

## 2026-05-18 — Code Cleanup, Native Voice Input, Streamlit Polish, Linux/Chrome Video Triage

**Status:** Deployed (quick fix); full video fix pending  
**Author:** Irfan Gazi (Claude Code assisted)

### Code cleanup (`/simplify` pass)

Reviewed `streamlit_app.py`, `inspector_portal.html`, `chat_panel.html`. Fixes applied:
- `ensureHls()` — `MANIFEST_PARSED` listeners now use `.once()` (were stacking on rapid video toggles)
- Removed the `_controlsBound` latch — video controls bind once at startup unconditionally
- Progress-bar 250 ms poll now skips DOM writes when `currentTime` is unchanged (paused/idle no-op writes eliminated)
- Autoplay-rejected fallback now syncs the mute button (added `updateMuteButton()`); awaited retry
- `stopRecording()` no longer leaves the mic button permanently disabled when no recorder is active
- De-duplicated the 3× textarea auto-grow logic into one `autoGrow()` helper per file
- `streamlit_app.py` — hoisted all 3 iframe URLs to top constants; dropped numbered narration comments

### Voice input — Whisper → browser-native Web Speech API

Replaced the `MediaRecorder` → OpenAI Whisper flow (which was broken and shipped a
client-side API key) with the native `webkitSpeechRecognition`/`SpeechRecognition` API in
both `inspector_portal.html` and `chat_panel.html`. Live transcription, appends to typed
text, graceful fallback when unsupported. **The client-side `OPENAI_API_KEY` constant is
fully removed** — resolves the secret-in-browser-source exposure flagged in the cleanup.

### Tab renames + Streamlit polish (`streamlit_app.py`)

- "VR Videos" → **"Training Workshop + AI Assistant"**
- "Gaussian Model Viewing" → **"3D Views of EVs"**
- "Unity VR Module" → **"VR Headset Training Module"**
- Cohesive dark theme matching the embedded portal (slate `#0f172a`, red `#ef4444`),
  hid default Streamlit chrome, styled tabs/alerts/iframes, added a gradient hero header

### Deploy pipeline note

`aws` CLI is not installed in the working env; `boto3` is available under `python3.10`.
S3 uploads + CloudFront invalidations are now done via inline `python3.10` + boto3
reading `.env`. Active CloudFront distribution ID: **`E2FCJOSZVLDA5W`**
(`d1ni7nkjr0eveg.cloudfront.net`). IAM user `Irfan` has `cloudfront:CreateInvalidation`
+ `ListDistributions` but **not** `GetInvalidation` — verify cache via served content.

### 360° video black-screen on Linux/Chrome (triage + quick fix)

**Symptom:** videosphere plays audio but no picture, controls lag — Linux + Chrome only
(worked on Mac). **Root cause:** the only HLS rendition is a single 4K30 H.264 stream
(`upload_to_s3.py` forces `-s 3840x2160`, no ABR ladder). Chrome-on-Linux lacks HW H.264
decode → software decode + per-frame WebGL texture upload saturates GPU/main thread.

**Quick fix shipped** (`inspector_portal.html`, deployed + invalidated):
- `renderer="antialias:false; maxCanvasWidth:1920; maxCanvasHeight:1080"`
- `new Hls({ capLevelToPlayerSize, capLevelOnFPSDrop, maxBufferLength:20, maxMaxBufferLength:30 })`

Fixes the control lag; may not fully restore 4K picture (decode cost unchanged). Full fix
(mid/low ABR ladder reusing existing 4K in place — no 4K re-upload) is documented as a
**NEXT STEP** section at the top of `CLAUDE.md`, detailed plan in
`~/.claude/plans/dreamy-kindling-lobster.md`.

| File | Change |
|---|---|
| `inspector_portal.html` | cleanup fixes; Web Speech voice; renderer + HLS.js perf caps |
| `chat_panel.html` | cleanup fixes; Web Speech voice; removed `OPENAI_API_KEY` |
| `streamlit_app.py` | tab renames; dark-theme polish; URL constants |
| `CLAUDE.md` | added "NEXT STEP (pending)" video-fix section |

---

## Next Steps / Open Items

- [ ] **Full 360° video fix:** add mid (~2560×1280) + low (~1600×800) HLS renditions + master playlist, reusing existing 4K segments in place (see CLAUDE.md NEXT STEP / plan file)
- [ ] Wire `video_transcript_v2` namespace into n8n workflow (replace or add alongside `video_transcript`)
- [ ] Run evaluation: send all 50 questions from `eval_questions.json` through the chatbot, score answers
- [ ] Decide whether to retire `video_transcript` namespace post-evaluation
- [ ] Consider adding chapter markers to `video_metadata.json` for finer-grained citations
- [ ] Portal UI: surface `chunk_start_seconds` from responses to auto-seek the 360° video player to the cited moment
