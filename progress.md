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

## 2026-05-24 — In-VR HUD + Right-Trigger Voice Chat (Meta Quest 3)

**Status:** Deployed (commit `a2de6a7` on `feature/streamlit-landing-page`)
**Author:** Irfan Gazi (Claude Code assisted)

### Problem

Two complaints from a Quest 3 session:

1. The `st.info` banner in `streamlit_app.py` told Quest users to "open the
   portal in the Quest browser and tap Enter VR" — but the in-video A-Frame
   "Enter VR" button is already visible at the bottom-right, so the banner
   looked redundant. The real reason it exists (Streamlit's
   `components.iframe()` can't grant `xr-spatial-tracking`, so the in-iframe
   button silently fails) was never explained.

2. Tapping Enter VR dropped the user into an empty videosphere. All playback
   controls, lecture switcher, and chat live in DOM elements outside
   `<a-scene>` and disappear in `immersive-vr`. Quest controllers did nothing
   because no `<a-entity oculus-touch-controls>` entities existed.

### Solution

**Streamlit banner** — replaced `st.info` with a one-line `st.caption`
containing an inline link to the direct CloudFront URL and a parenthetical
explaining the WebXR-permission limitation. Same information, ~1/4 the
vertical real estate, and the WHY is now in the source.

**In-VR HUD** (`inspector_portal.html`) — added inside `<a-scene>`:

- Camera rig with explicit `<a-entity camera look-controls>`, gaze cursor,
  and both Quest controllers (`oculus-touch-controls`); right hand also
  carries `laser-controls` + raycaster targeting `.hud-clickable` entities
  with a blue laser line.
- `<a-entity id="vr-hud">` parented to the camera (so it follows head
  movement), hidden by default, shown on `enter-vr`. Contains:
  - **Playback row:** Play/Pause, Mute, clickable progress bar with live
    time text, lecture switcher (1/2/3).
  - **Chat panel:** dark translucent surface showing the last 4 messages,
    a live-transcript line, and a "🎤 Hold RIGHT TRIGGER to speak" hint.
- All HUD button clicks delegate to the existing DOM control logic via
  `document.getElementById("btn-play").click()` etc. — no duplicate code
  paths. `updateVrHud()` mirrors video state into the HUD on a 250 ms timer
  that only runs while the scene is in VR.
- HUD seek bar converts the raycaster's `intersection.point` →
  `object3D.worldToLocal()` → fractional progress → `activeVideo.currentTime`.

**Right-trigger push-to-talk** — extended `startRecognition()` with a
`{ source: "vr" }` option that routes the live transcript to the HUD instead
of the chat textarea and auto-submits to the n8n webhook on `triggerup`.
`triggerdown` on `#right-hand` starts recognition *unless* the raycaster is
currently intersecting a `.hud-clickable` entity (in which case laser-controls
is already firing a click for that trigger press). `addMessage()` was
extended to also call `mirrorToHud()` so exchanges initiated in VR are
visible in the desktop chat panel after exiting VR (and vice versa).

### Deploy protocol followed

Per the CLAUDE.md cache rules:
- `python3.10` + `boto3` `put_object` with `ContentType="text/html"` +
  `CacheControl="no-cache, must-revalidate"` (the IAM user lacks
  `s3:GetObject`, so `copy_object` is not an option).
- CloudFront invalidation on `/inspector_portal.html` (id
  `I8JKJ1GLU9HRX1EBNT64UPJKMV`).
- `CACHE_BUST` in `streamlit_app.py` bumped `20260519a` → `20260524a`.

### Changes

| File | Change |
|---|---|
| `inspector_portal.html` | Added camera rig, controllers, laser, `#vr-hud` (playback row + chat panel); JS additions for HUD wiring, push-to-talk, HUD mirroring |
| `streamlit_app.py` | `st.info` → `st.caption` with inline link + WHY note; CACHE_BUST bump |

### Not yet verified

The build was sanity-checked locally (tag balance, JS brace/paren balance,
desktop control paths preserved) but the Quest 3 in-headset behaviour
(laser pointer click accuracy, trigger-vs-laser conflict, HUD comfort
distance, push-to-talk latency) needs an in-headset session. If the trigger
turns out to fight the laser-pointer click, swap `triggerdown`/`triggerup`
to `gripdown`/`gripup` on `#right-hand`.

---

## 2026-05-24 — IWSDK v2 Portal (Meta Immersive Web SDK Migration)

**Status:** v2 build green locally; awaiting in-headset shakedown before cutover
**Author:** Irfan Gazi (Claude Code assisted)
**Plan:** `~/.claude/plans/why-are-you-not-transient-bengio.md`

### Why

Two pain points with the A-Frame stack motivated the migration:

1. **No desktop emulator** — the in-VR HUD shipped 2026-05-24 (same day) couldn't be verified without a Quest. IWSDK ships IWER (Immersive Web Emulation Runtime) so XR sessions can be entered and driven from the desktop browser.
2. **No agentic dev story** — A-Frame predates the AI-tooling integration Meta now ships with `@iwsdk/core`. IWSDK starter pre-configures MCP runtime tools (`mcp__iwsdk-runtime__*`) for browser screenshots, XR session control, ECS inspection, frame-by-frame debugging.

Meta released IWSDK in October 2025; current version is `@iwsdk/core@0.4.1` (early access, no 1.0). We're shipping among the first non-trivial production apps on it — flagged as a risk but accepted.

### Rollout model

**Parallel deploy** — `inspector_portal.html` (A-Frame v1) is **untouched and still live**. The v2 build deploys to `s3://first-responder-training/v2/` and is served from `https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html`. Cutover happens only after in-headset shakedown on Quest 3 passes.

### What was built

**New `portal/` directory** — IWSDK + Vite + TypeScript scaffold (`npm create @iwsdk@latest portal -- --mode vr --language ts --no-locomotion --no-grabbing --no-physics --ai-tools claude --no-git`):

| File | Role |
|---|---|
| `portal/src/index.ts` | World entry; registers HudSystem + PushToTalkSystem |
| `portal/src/videosphere.ts` | `THREE.SphereGeometry` + `VideoTexture` (replaces `<a-videosphere>`); HLS.js lifecycle, lecture switching, all DOM control bindings ported from `inspector_portal.html:609-812` |
| `portal/src/hud.ts` | `HudSystem` — wires UIKit click handlers to DOM controls, syncs play/mute/time/lecture state on a 250 ms tick, toggles HUD visibility on `VisibilityState` change |
| `portal/src/push-to-talk.ts` | `PushToTalkSystem` polling `right.getButtonDown(InputComponent.Trigger)`; skips voice when `Hovered` query has entities so HUD clicks still fire |
| `portal/src/chat.ts` | n8n chat ported verbatim from `inspector_portal.html:814-927`, ES module form |
| `portal/src/voice.ts` | Web Speech API ported from `inspector_portal.html:929-1006`, ES module form |
| `portal/src/hud-mirror.ts` | Listener bridge: chat/voice push updates into HUD without knowing about ECS |
| `portal/ui/hud.uikitml` | UIKitML layout (compiled to `public/ui/hud.json` by `@iwsdk/vite-plugin-uikitml`) |
| `portal/index.html` | Host shell: same chrome + chat sidebar + DOM controls as v1, with `<div id="scene-container">` for the IWSDK canvas and a new `#btn-enter-vr` button |

**Repo-level additions:**

- `deploy_portal_v2.py` — uploads `portal/dist/` (multi-file bundle, not single HTML) to `s3://first-responder-training/v2/`. Per-file `CacheControl` rules: `no-cache, must-revalidate` on `index.html`, `public, max-age=31536000, immutable` on hashed `assets/*`. Then invalidates `/v2/*` on CloudFront. Flags: `--upload`, `--invalidate-only`.
- `streamlit_app.py` — bumped `CACHE_BUST` to `20260524b`; added `_USE_V2 = st.query_params.get("portal","v1") == "v2"` so reviewers can switch the embedded iframe to v2 via `?portal=v2` without breaking the live tool.

### Scope split — what migrated vs what stayed

| Stayed unchanged | Migrated to IWSDK |
|---|---|
| `chat_panel.html` (no A-Frame to begin with) | `<a-scene>` block → `World.create({xr,features})` |
| n8n webhook POST, `parseN8nResponse`, `addMessage`, Marked.js | `<a-videosphere>` → Three.js `SphereGeometry` + `VideoTexture` |
| Browser-native `SpeechRecognition` (chat + VR push-to-talk dispatch) | `oculus-touch-controls` → IWSDK `XRInputManager` |
| `ensureHls` / `activatePanorama` HLS.js wiring (HLS.js still attaches to `<video>` tag) | `laser-controls` + `raycaster` → IWSDK pointer events + `Hovered`/`Pressed` |
| `session_id` localStorage (key `fr_session_id` shared with `chat_panel.html`) | `<a-entity id="vr-hud">` → `PanelUI` + UIKitML |
| n8n workflow, Pinecone index, all PDF/transcript ingestion | `triggerdown`/`triggerup` → gamepad `getButtonDown/Up(InputComponent.Trigger)` |
| `inspector_portal.html` v1 (still live!) | `enter-vr`/`exit-vr` → `world.visibilityState` subscription |

### Pain points hit during build

- **`@iwsdk/core` re-exports `three`** via `./runtime/three.js` (which does `export * from "three"`). All Three.js types are available from `@iwsdk/core` per the starter's CLAUDE.md "never import from `three` directly" rule — verified by grepping the type declarations.
- **`entities` is a `Set`, not array** — `this.queries.X.entities.length` doesn't exist; use `.size`.
- **mkcert SSL failure** — `vite-plugin-mkcert` always calls `mkcert -install` which tries `update-ca-certificates` → `openssl`, which dies on this machine with `libssl OPENSSL_3.4.0 not found` (system openssl/libssl version mismatch, unrelated to IWSDK). Swapped to `@vitejs/plugin-basic-ssl` — generates a self-signed cert in-memory, no system trust store touched. Browser shows "Not Secure" but WebXR works fine on localhost regardless of cert trust.
- **Bundle size** — final dist is ~5 MB (vs single ~30 KB HTML for A-Frame). Includes Havok physics WASM (2 MB) even though physics is disabled — `optimizeDeps.exclude: ['@babylonjs/havok']` doesn't prevent it from being chunked at build. Acceptable for v1; could trim later via custom Rollup chunks.

### Verified locally

- `npx tsc --noEmit` — clean
- `npm run build` — 497 modules transformed, dist output at `portal/dist/index.html`
- UIKitML compilation succeeded (`hud.uikitml` → `hud.json`)

### Not yet verified

- `npm run dev` end-to-end on IWER emulator (lecture switching, HUD button clicks via simulated controller ray, push-to-talk via keyboard alias, chat round-trip to n8n)
- Deployed v2 URL load on desktop Chrome
- Quest 3 in-headset shakedown: HUD comfort distance, push-to-talk latency, trigger-vs-laser-click conflict
- Cutover not performed — `inspector_portal.html` still serves v1

### Changes

| File | Change |
|---|---|
| `portal/` | **New** — entire IWSDK project (src/, ui/, public/, vite.config.ts, package.json) |
| `deploy_portal_v2.py` | **New** — multi-file bundle uploader + CloudFront invalidation |
| `streamlit_app.py` | `?portal=v2` query-param branch + CACHE_BUST bump (`20260524a` → `20260524b`) |
| `CLAUDE.md` | Documented IWSDK v2 portal, new deploy flow, MCP runtime tools |
| `inspector_portal.html` | **Untouched** — parallel rollout |

---

## 2026-05-25 — IWSDK v2 Verify Pass + HUD Comfort Bump + Voice STT Fallback + First v2 Deploy

**Status:** Deployed to `s3://first-responder-training/v2/`; live at `https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html`
**Author:** Irfan Gazi (Claude Code assisted)

### IWER emulator verify pass (v2 portal)

Drove `npx iwsdk` CLI against the running dev server (the `mcp__iwsdk-runtime__*` MCP
tools were deferred in the session, so the CLI was used as the equivalent).

First attempt **blocked** by host WebGL: Chrome + Mesa llvmpipe failed to create a
GL context (`BindToCurrentSequence failed`), so `World.create()` threw and no XR
session was offered. Resolved by installing/repairing the nvidia driver stack on
the host. Second attempt: clean.

Verified end-to-end in IWER (Meta Quest 3 device profile):

- `World.create({ xr: { sessionMode: ImmersiveVR, offer: "always" } })` completes;
  `xr status` reports `sessionOffered: true`.
- `xr enter` activates session with `local-floor`, `bounded-floor`, `hand-tracking`.
- `ecs systems` confirms `HudSystem` (index 10, query `hudPanel` → 1 entity) and
  `PushToTalkSystem` (index 11, query `hovered`) are registered and running.
- HUD UIKit panel renders the full layout: Play / Mute / lecture 1-3 (1 highlighted) /
  time `0:00 / 0:00` / chat row / push-to-talk hint / Exit VR.
- Hover-guard on the trigger works: right laser pointed at panel → `hovered = 1`;
  pointed off-panel via `xr look-at (3, 1.5, -1.6)` → `hovered = 0`. The
  push-to-talk system was confirmed to early-return on the hover branch and to
  proceed on the no-hover branch.
- `xr set-select-value 1.0 / 0.0` cycled the right trigger; `xr select` dispatched
  a full press+release. No exceptions during either cycle.

### HUD comfort height (`portal/src/index.ts`)

HUD entity world-space position was `(0, 1.25, -1.6)` — read as chest-height in the
IWER camera view, likely to require neck-down comfort on Quest. Bumped to
`(0, 1.45, -1.6)` to sit at eye level for a 1.6 m headset position.

### Voice STT fallback (`portal/src/voice.ts`)

Chrome on Linux desktop does not expose `webkitSpeechRecognition`/`SpeechRecognition`
(Google removed the speech endpoint from desktop Linux Chromium). Until now this
meant `PushToTalkSystem` no-op'd and the chat mic button was disabled on any Linux
desktop reviewer. Quest 3's Chromium ships it natively, so production was fine, but
local verification was not.

Added a `MediaRecorder` → server-side transcribe fallback. Flow:

1. `isVoiceSupported()` returns true if either `SpeechRecognition` **or**
   `MediaRecorder + getUserMedia` is available.
2. `startRecognition(opts)` picks the SpeechRecognition path when available
   (unchanged behaviour on Quest / macOS / Windows). Falls back to MediaRecorder
   otherwise.
3. MediaRecorder path: `getUserMedia({ audio: true })` → record chunks → on stop,
   POST a `multipart/form-data` blob to `TRANSCRIBE_URL` → parse `{ text }` from
   response → fill input / auto-submit in VR.
4. Mode-aware UX strings: `🎤 listening…` (live STT), `🎤 recording…` /
   `⏳ transcribing…` (record-then-transcribe), error surface preserved.
5. Crucially, **no client-side API key** — the n8n side proxies to OpenAI Whisper.
   This is the same security posture that motivated the 2026-05-18 removal of the
   old MediaRecorder + Whisper path.

**n8n webhook contract (you need to wire this up):**

- **URL:** `https://irfangazi.app.n8n.cloud/webhook/transcribe-audio`
  (hard-coded as `TRANSCRIBE_URL` in `voice.ts` — update both if you change it)
- **Method:** `POST`
- **Body:** `multipart/form-data` with:
  - `audio` (file field) — `audio/webm;codecs=opus` blob (Chrome) or `audio/ogg`/
    `audio/mp4` per browser support; filename `recording.{ext}`
  - `session_id` (text field, optional) — UUID from `localStorage.fr_session_id`
- **Response:** JSON `{ "text": "<transcribed text>" }` (or `transcript` /
  `output` — the client also reads those keys, matching `parseN8nResponse`).
- **n8n workflow:** Webhook (POST, multipart) → OpenAI node (Whisper, audio
  Binary from `$binary.audio.data`, model `whisper-1`) → Respond to Webhook with
  `{ "text": "{{$json.text}}" }`.

If the webhook is not wired up yet, the client logs a friendly error in the
existing error banner and does not crash. Quest 3 push-to-talk continues to work
because it never hits the MediaRecorder branch.

### Deploy

`cd portal && npm run build` → 497 modules transformed, dist output 8 files
(~5 MB total, Havok WASM still bundled per the known IWSDK issue).

`python3.10 deploy_portal_v2.py` uploaded all 8 files to
`s3://first-responder-training/v2/` with per-file `CacheControl` rules:

| File | Cache-Control | Size |
|---|---|---|
| `v2/index.html` | `no-cache, must-revalidate` | 12.1 KB |
| `v2/assets/index-BcwkWV_r.js` | `public, max-age=31536000, immutable` | 2,234 KB |
| `v2/assets/HavokPhysics-hlBZeaGL.wasm` | `public, max-age=31536000, immutable` | 2,045 KB |
| `v2/assets/inter-BNVRAYFH.js` | `public, max-age=31536000, immutable` | 413 KB |
| `v2/assets/worker-DNzgnIPb.js` | `public, max-age=31536000, immutable` | 193 KB |
| `v2/assets/worker-_Lh8Vt-i.js` | `public, max-age=31536000, immutable` | 41 KB |
| `v2/assets/HavokPhysics_es-CV3-LB9r.js` | `public, max-age=31536000, immutable` | 33 KB |
| `v2/ui/hud.json` | `public, max-age=300` | 9.5 KB |

CloudFront invalidation: `I4IFJBAN2YPQAEAGDK3YDHTWAJ` on `/v2/*`.

Live at **`https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html`**. Streamlit
wrapper switches via `?portal=v2`.

### CORS fix note

CORS on the CloudFront/S3 origin was reported fixed (previously videos failed
to load in the IWER emulator with `No 'Access-Control-Allow-Origin' header`).
The deploy script doesn't touch CORS; this was a bucket-side configuration
change handled outside the script.

### Changes

| File | Change |
|---|---|
| `portal/src/index.ts` | HUD `y` 1.25 → 1.45 (eye-level comfort) |
| `portal/src/voice.ts` | Added MediaRecorder → server-transcribe fallback for browsers without SpeechRecognition; documented n8n contract |
| `progress.md` | This entry |

### Still pending

- **Quest 3 in-headset shakedown** of the v2 build — HUD comfort at the new
  height, push-to-talk latency, trigger-vs-laser click conflict on real
  hardware. The IWER pass covers the wiring; the headset pass covers the UX.
- **n8n transcribe webhook** wiring per the contract above. Until done, voice
  input on desktop Linux shows a friendly error; production (Quest) is
  unaffected.
- **v2 → root cutover** — only after Quest shakedown passes.

---

## 2026-06-01 — IWSDK v2 VR Interface Overhaul (Follower HUD, Audio/Haptics, Pinch-to-Talk)

**Status:** Implemented + statically verified; in-emulator pass pending
**Author:** Irfan Gazi (Claude Code assisted)

Reworked the v2 in-VR interface to use IWSDK's built-in capabilities instead of
the thin static-panel slice it shipped with. Driven by Meta's immersive-design
comfort guidance (skills: `iwsdk-planner`, `hz-immersive-designer`).

### Headline fix — body-locked lazy-follow HUD

The v2 HUD was pinned to a fixed world position `(0, 1.45, -1.6)`, so rotating
to look around the 360° scene left it behind the user. v1 solved this by rigidly
parenting the HUD to the camera — but that **rigid head-lock is a documented
comfort anti-pattern** (nausea, occludes the scene). Replaced it with IWSDK's
built-in `Follower` component (`FollowSystem`, no feature flag): the panel trails
the gaze with lag, settles ~1.4 m ahead at eye level (`FollowBehavior.PivotY`,
`maxAngle: 30`, `tolerance: 0.4`, `speed: 3`), re-centering only after a >30° turn.

### Other improvements

- **Comfort tuning:** PanelUI `maxWidth` 1.8 → 1.3 m (~50° arc comfort ceiling).
- **Spatial audio:** two preloaded non-positional `AudioSource` entities — a
  click on button presses and a chime when an AI answer arrives (user may be
  looking away). New `portal/public/audio/{click,chime}.mp3` (ffmpeg-generated).
- **Haptics:** controller rumble on button press / voice start / voice stop via
  the raw WebXR `gamepad.hapticActuators` (no first-class IWSDK API exists).
- **Pinch-to-talk:** push-to-talk switched to the **select** action, which
  covers controller trigger *and* hand-tracking pinch in one path — finally
  using the already-enabled `handTracking` flag. Controller-free voice now works.
- **"Thinking…" state:** new pending listener in `hud-mirror.ts` mirrors the
  in-flight n8n round-trip into the HUD so VR users get feedback.
- **ASCII-clean panel text:** the live dev runtime log surfaced
  `Missing glyph info for "—"/"…"/emoji` — the UIKit Inter MSDF atlas has no
  emoji/em-dash/ellipsis glyphs (they render as tofu boxes). Stripped them from
  all panel-facing strings (`hud.uikitml`, `hud.ts`, `hud-mirror.ts`, and the
  vrMode-only transcript states in `voice.ts`). DOM strings keep their emoji.

### Changes

| File | Change |
|---|---|
| `portal/src/index.ts` | `Follower` on HUD (removed static position); `maxWidth` 1.8 → 1.3 |
| `portal/src/hud.ts` | click/chime `AudioSource` entities; role-aware chat listener (chime on bot); "Thinking..." pending state |
| `portal/src/push-to-talk.ts` | unified select-based push-to-talk (trigger + pinch); haptic pulses |
| `portal/src/hud-mirror.ts` | `setHudPending`/pending listener; ASCII ellipsis |
| `portal/src/chat.ts` | drive `setHudPending` around the webhook call |
| `portal/src/voice.ts` | ASCII vrMode transcript states |
| `portal/ui/hud.uikitml` | ASCII text; hint mentions PINCH |
| `portal/public/audio/click.mp3`, `chime.mp3` | **New** — UI sounds |

### Verified

- `npx tsc --noEmit` clean; `npm run build` succeeds (UIKitML compiled, audio
  bundled to `dist/audio/`); compiled `hud.json` has zero non-ASCII chars.
- Dev server boots at `https://localhost:8081/`, serves HTTP 200, audio
  reachable, no startup/runtime errors.

### Still pending

- **In-emulator (IWER) visual/interaction pass** — confirm the HUD lazy-follow,
  comfort width, voice/pinch, chime, and "Thinking..." state in an XR session
  via the MCP runtime tools. Couldn't run this session (IWER MCP tools not
  loaded); do after a Claude Code restart or verify manually in the browser.
- **Quest 3 in-headset shakedown** still gates the v2 → root cutover.

---

## 2026-06-01 — IWSDK v2 Live IWER Emulator Pass + Quest STT Correction + Transcribe Webhook

**Status:** Emulator pass done; `transcribe-audio` webhook delivered as importable JSON (user to import + activate)
**Author:** Irfan Gazi (Claude Code assisted)

### Live IWER emulator pass (v2 portal)

Drove the `mcp__iwsdk-runtime__*` MCP tools against the running dev server
(`npm run dev`, Quest 3 device profile, controller input mode) — the in-emulator
pass that the earlier 2026-06-01 entry left pending.

- **Boot / render clean:** IWSDK v0.4.1 / Three r181 / EliCS v3.4.2. All 13 systems
  register and run, including the v2 customs `FollowSystem`, `HudSystem`,
  `PushToTalkSystem`. `PanelUISystem` shows 1 configured panel.
- **Follower HUD verified:** the whole HUD is a **single `PanelUI` document**
  (entity 12 — one `RayInteractable` + `Follower`; buttons are UIKit elements
  inside it). Spawns at world `(0, 1.6, -1.4)` = 1.4 m ahead at standing height.
  After a 45° headset yaw it moved to `(-0.99, 1.6, -0.99)` — same 1.4 m radius,
  re-oriented to face the user (quaternion y≈0.383). Lazy-follow + comfort
  distance confirmed.
- **Ray-click lecture switch verified:** aimed the right controller ray at the "2"
  button and selected → active highlight moved 1→2 and `switchVideo(1)` fired,
  lazily kicking off the **2nd** video's HLS (`VID_20250912_122900…`). UIKit button
  routing through the single panel works end-to-end.
- **ASCII panel text:** renders clean (no tofu) — the font-atlas constraint is
  being respected.
- **360° video blank in emulator:** HLS manifests are **CORS-blocked** from the
  `localhost:8081` dev origin (`No 'Access-Control-Allow-Origin'`). Dev-only —
  prod v2 is same-origin on CloudFront. **NOTE:** this contradicts the 2026-05-25
  "CORS fix" note; the emulator still hits CORS for video, so 360° playback can't
  be validated in IWER — it's a Quest/CloudFront-only test.
- **Push-to-talk NOT exercisable in the emulator:** headless Chromium has no mic,
  and (see below) the voice fallback path needs the n8n webhook that didn't exist.
  No observable effect from a simulated trigger. This is a Quest-only test.
- **Latent UX concern logged:** `PushToTalkSystem`'s guard is
  `this.queries.hovered.entities.size > 0` — i.e. **any** hovered entity suppresses
  voice, not specifically the triggering (right) hand. Because the HUD follows the
  gaze and sits centered, a resting ray on it could turn the trigger into a silent
  haptic pulse instead of starting voice. Confirm on-headset; if it bites, scope
  the guard to the right hand's hover target.

### Quest STT correction (supersedes the 2026-05-25 claim)

The 2026-05-25 entry and CLAUDE.md stated *"Quest 3's Chromium ships
SpeechRecognition natively, so production was fine."* **This is wrong.** Per
hands-on use, the **Meta Quest Browser has no native speech-to-text** — there is
no `webkitSpeechRecognition`/`SpeechRecognition` service. Consequence:

- **Desktop Chrome** (e.g. the dev machine): has `SpeechRecognition` → voice works
  today via the live-STT path; never calls the webhook.
- **Quest 3 in VR** (the real target): no `SpeechRecognition` → `voice.ts` falls
  through to its `MediaRecorder` path, which POSTs recorded audio to
  `https://irfangazi.app.n8n.cloud/webhook/transcribe-audio`. So that webhook is
  the **required** path for talking to the chatbot inside the VR interface — NOT a
  desktop-Linux-only nicety. Until it exists, in-VR voice is dead on Quest.

### Transcribe webhook delivered (`n8n_transcribe_webhook.json`)

The portal client side is already complete (`portal/src/voice.ts`
`startMediaRecording` + `transcribeBlob`, driven by `PushToTalkSystem` with
`source: "vr"`). Only the n8n side was missing. Delivered as an **importable
workflow JSON** at the repo root — a small, **separate** workflow that does NOT
touch the existing RAG chat workflow ("1.1 First Responder").

3 nodes: **Webhook** (`POST /transcribe-audio`, respond via Respond node) →
**OpenAI Transcribe a recording** (Whisper, binary field `audio`, OpenAI cred
`dLb32e73iouY9DvH`) → **Respond to Webhook** (`{ "text": {{ $json.text }} }`).

**How to wire it up:**

1. n8n → **Workflows → Import from File** → select `n8n_transcribe_webhook.json`.
2. Open the **Transcribe Audio (Whisper)** node and (re)select your OpenAI
   credential — credential IDs don't always survive import.
3. Verify the binary field: the Webhook node should expose the uploaded file as
   binary property **`audio`** (the multipart field name `voice.ts` sends). If your
   n8n version names it differently (`data` / `file0`), set the OpenAI node's
   "Input Data Field Name" to match what the Webhook node outputs.
4. Toggle the workflow **Active** — the production `/webhook/transcribe-audio` URL
   only works when active (the `/webhook-test/` URL only works while "Listen for
   test event" is on).
5. CORS needs no config — the browser sends `FormData` (multipart) and your
   existing chat webhook already proves n8n cloud answers cross-origin browser
   POSTs from CloudFront + localhost.

**Quick test (after import + activate):**

```
curl -X POST https://irfangazi.app.n8n.cloud/webhook/transcribe-audio \
  -F "audio=@some_clip.webm" -F "session_id=test"
# expect: {"text":"...transcribed words..."}
```

### Changes

| File | Change |
|---|---|
| `n8n_transcribe_webhook.json` | **New** — importable 3-node transcribe workflow (Webhook → Whisper → Respond) |
| `progress.md` | This entry |
| `CLAUDE.md` | Corrected the "Quest is unaffected" / desktop-Linux-only voice notes |
| `portal/src/voice.ts` | Comment broadened to note Quest Browser lacks STT (no code change) |

### Still pending

- **Import + activate** the transcribe workflow in n8n, then the curl check above.
- **Quest 3 in-headset shakedown** — in-VR voice end-to-end (pinch/trigger →
  record → transcribe → answer), HUD comfort, push-to-talk latency, and the
  hover-guard concern above. Watch for a **mic-permission** gotcha: `getUserMedia`
  may need permission granted before entering immersive mode.

---

## 2026-06-01 — Transcribe Webhook Activated + v2 Overhaul DEPLOYED (the stale-bundle fix)

**Status:** Webhook live + verified; v2 overhaul build now actually deployed to CloudFront
**Author:** Irfan Gazi (Claude Code assisted)

### Transcribe webhook activated + verified end-to-end

User imported and activated `n8n_transcribe_webhook.json`. Verified the live
endpoint with a real multipart POST (ffmpeg-generated 2 s Opus/WebM tone):

```
curl -X POST https://irfangazi.app.n8n.cloud/webhook/transcribe-audio \
  -F "audio=@test_clip.webm;type=audio/webm" -F "session_id=claude-test"
→ HTTP 200, application/json
→ {"text":"Beep."}
```

Confirms the whole chain: Webhook accepts multipart and exposes the file as binary
property `audio` (field name matched, no remap needed) → Whisper transcribes →
Respond returns `{"text": ...}`, exactly the shape `voice.ts` `transcribeBlob`
parses. Server side is fully wired to the client contract.

### Caught: the v2 VR overhaul had never been deployed (root cause of "no changes in VR")

User reported the Quest link showed no VR changes. Investigation: the deployed
`/v2/` bundle was `index-BcwkWV_r.js` — the **2026-05-25 build** (matched that
deploy's asset table; markers: no `PINCH` hint, old `Listening...` string). The
**2026-06-01 VR overhaul** (Follower HUD, pinch-to-talk, audio/haptics, ASCII
fix) was built + type-checked locally but **never deployed**. The earlier
2026-06-01 overhaul entry recorded "verified locally" with no deploy step — that
was the gap.

### Deploy

- `npx tsc --noEmit` clean → `npm run build` (new bundle `index-EH2SN-ar.js`,
  UIKitML compiled, audio bundled).
- `python3.10 deploy_portal_v2.py` — uploaded 10 files to
  `s3://first-responder-training/v2/` (now includes `audio/click.mp3`,
  `audio/chime.mp3`); CloudFront invalidation **`I925KT8NGZAV1LNRADY7WAVL52`** on
  `/v2/*`.
- Post-deploy verification (cache-busted curls):
  `/v2/index.html` now references `index-EH2SN-ar.js`; `/v2/ui/hud.json` has the
  `PINCH`/`TRIGGER` hint with **0 non-ASCII bytes**; `audio/{click,chime}.mp3` → 200.

Live at `https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html`. v1
(`inspector_portal.html`) and the Streamlit default remain untouched.

### Note on what does NOT need a deploy

Today's repo edits (`progress.md`, gitignored `CLAUDE.md`, the `voice.ts` comment,
`n8n_transcribe_webhook.json`) are not portal runtime code — the deploy above was
needed only because the 2026-06-01 overhaul bundle itself had never shipped.

### Still pending

- **Quest 3 in-headset shakedown** of the now-deployed build: in-VR voice
  end-to-end (mic permission → pinch/trigger → record → transcribe → answer),
  follower-HUD comfort, and the `PushToTalkSystem` hover-guard (any-hovered-entity
  suppresses voice — aim off-panel to talk).

---

## 2026-06-08 — Streamlit Cut Over to v2 + Desktop Drag-to-Look for the 360° Videosphere

**Status:** Deployed + verified live (Playwright/headless Chrome on the production `/v2/` URL)
**Author:** Irfan Gazi (Claude Code assisted)

### Streamlit now defaults to v2 (IWSDK), VR-module placeholder removed

`streamlit_app.py` had defaulted Tab 1 to v1 (`inspector_portal.html`) and only
loaded v2 behind `?portal=v2`. Flipped it: the embed now defaults to
`…/v2/index.html` (IWSDK), with `?portal=v1` kept as a fallback escape hatch.
The Quest "open in browser" caption reuses `PORTAL_URL`, so it now points at v2
automatically. Also dropped the in-development **"VR Headset Training Module"**
placeholder tab (`tab3`) — the app is now two tabs. `CACHE_BUST` `20260525a` →
`20260608a`. Everything else (hero, dark theme, 3D-EVs splat viewer, standalone
chat panel) untouched.

Streamlit Cloud deploys from **`feature/streamlit-landing-page`**, so the change
was committed on `meta-webvr` (`e467488`) and cherry-picked there (`40a63b6`);
both pushed.

### Reported symptom → real root cause

User loaded `?portal=v2` and reported "no changes," the VR/video looking like
"an older version," and **no mouse-pan on the video**. Findings:

- **The deployed `/v2/` was NOT stale.** Its bundle hash (`index-EH2SN-ar.js`)
  matched the latest local build — i.e. the 2026-06-01 overhaul (Follower HUD,
  pinch-to-talk, audio/haptics) *was* live. ("No changes on `?portal=v2`" is
  expected: that URL served v2 both before and after the default flip.)
- **The real bug:** IWSDK ships **no desktop/browser look controls**, so on a
  flat screen (desktop, and inside the Streamlit iframe) `world.camera` was
  frozen facing -Z — even though the UI promised *"Drag to rotate."* v1's
  A-Frame `look-controls` gave drag-to-look for free; the v2 port never
  reimplemented it. Compounding the "older" feel: the Follower HUD and the rest
  of the overhaul are **VR-only** (`object3D.visible = inXR`), so on desktop the
  scene correctly falls back to the DOM controls and looks comparatively bare.

### Fix — `DesktopLookSystem` (`portal/src/look-controls.ts`, new)

Grounded in the `iwsdk-planner` skill (per the project's "invoke planner first"
rule). Hold-and-drag (mouse **and** touch, via Pointer Events) yaws/pitches
`world.camera`:

- Drives the **camera `Object3D` directly** — the planner blesses driving
  `world.camera` for cinematic/orbit views with the player at origin, and the
  zero-copy Transform binding *reads through* the Object3D (confirmed against
  `FollowSystem`, which lerps `object3D.position` directly), so writes are not
  clobbered by `TransformSystem`.
- **Euler order `YXZ`** (independent yaw/pitch, no creeping roll); pitch clamped
  to ~±88°. Sensitivity 0.0026 rad/px. Sign matches v1: drag right → look right,
  drag down → look down.
- **Gated to `VisibilityState.NonImmersive`** — in XR the headset owns the pose,
  so `update()` early-returns and the grab cursor swaps to default.
- Cursor feedback (`grab`/`grabbing`), `touch-action: none`, `user-select: none`
  on the canvas. Registered after `HudSystem`/`PushToTalkSystem` in `index.ts`.

### Polish — inline 🚒 favicon (`portal/index.html`)

Added a `data:image/svg+xml` 🚒 favicon. Kills the lone remaining console error
(an auto-requested `/favicon.ico` → S3 returns **403** for missing keys) and
gives the browser tab a matching icon. No new asset.

### Verified

- `npx tsc --noEmit` clean; `npm run build` clean (new bundle
  `index-231veDSM.js`).
- **Headless Chrome + Playwright drag smoke test**, run against both the local
  built `dist/` and the **live production `/v2/` URL**. A real mouse drag over
  the canvas flips the cursor `grab → grabbing → grab` (the same handlers that
  drive yaw/pitch), proving `World.create` resolved, the system registered, and
  the NonImmersive gate passed. On the live URL: 360° video plays
  (`readyState 4`, `currentTime` advancing, 1800px wide) and **zero console
  errors** (403 gone). The localhost-only run showed the known dev-origin video
  CORS block — absent on the same-origin CloudFront page, as expected.

### Deploy

`python3.10 deploy_portal_v2.py` (run from repo root) — 10 files to
`s3://first-responder-training/v2/`, bundle `index-231veDSM.js`. Two
invalidations on `/v2/*`: `I7NBKBAL6JJUAKFNB2ET36UWBI` (look-controls) and
`I37I5RS0DCN79G6ISEAG1NEG58` (favicon). Portal source committed for a
reproducible build: `1415cf6` on `meta-webvr`, cherry-picked `94eacf6` on
`feature/streamlit-landing-page`; both pushed.

### Changes

| File | Change |
|---|---|
| `portal/src/look-controls.ts` | **New** — `DesktopLookSystem`: pointer/touch drag-to-look on `world.camera`, NonImmersive-gated |
| `portal/src/index.ts` | Import + register `DesktopLookSystem` |
| `portal/index.html` | Inline 🚒 SVG favicon (kills `/favicon.ico` 403) |
| `streamlit_app.py` | Default embed v1 → v2; `?portal=v2` opt-in → `?portal=v1` fallback; removed `tab3` VR-module placeholder; CACHE_BUST `20260525a` → `20260608a` |
| `progress.md` | This entry |

### Still pending

- **Quest 3 in-headset shakedown** (unchanged gate for cutover): in-VR voice
  end-to-end, follower-HUD comfort, push-to-talk latency, the `PushToTalkSystem`
  any-hovered-entity guard. The desktop drag fix doesn't touch the XR path.
- **`Enter VR` inside the Streamlit iframe** still can't work — Streamlit's
  `components.iframe()` withholds `xr-spatial-tracking`; Quest users must use the
  direct CloudFront URL (the in-app caption says so). Platform limitation, not a
  code bug.

---

## 2026-06-18 — Ingestion/n8n Audit: Real Bug Was 3 Missing Tool Nodes (Not Re-Ingestion) + `Ford Mache-E` → `vehicle_docs`

**Status:** Done — 3 tool nodes added + system prompt polished (n8n PUT 200, structure verified); repo renamed/docs corrected. Live chat verification BLOCKED by an expired OpenAI key on the n8n agent (see below)
**Author:** Irfan Gazi (Claude Code assisted)

### Context — the professor's report

A professor flagged chatbot accuracy problems (duplicate / generic answers,
"refer to the ERG" hedging) and theorized that **only the Mach-E had ever been
ingested**. We audited Pinecone + n8n to confirm or falsify that.

### Audit findings — the "Mach-E only" theory is FALSE

- **Pinecone is fully populated for all 13 vehicles.** Every per-vehicle
  namespace holds data — e.g. `volkswagen_id4_2025`=**100** vectors,
  `nissan_ariya_2026`=**114**, both *more* than `ford_mach_e_2026`=**42**.
- **The retired `erg_full` / `rescue_sheet` namespaces are gone** (dropped after
  the per-vehicle re-ingestion).
- **The repo's `ingestion.ipynb` + `vehicle_docs/processed.log` are simply
  STALE.** The real per-vehicle ingestion was run out-of-band and never
  committed; the notebook's `DOCS` list is still Mach-E-only and targets the
  retired namespaces. So: nothing about the data was actually broken.

### The real bug — 3 missing n8n tool nodes

n8n was mostly correct: 11 per-vehicle Pinecone tools wired,
`video_transcript` → `video_transcript_v2`, agent temperature 0.1. But **3
per-vehicle tool nodes were MISSING** — `nissan_ariya_2026`, `rivian_r1t_2025`,
`volkswagen_id4_2025`. With no tool to reach those namespaces, the agent fell
back to neighboring vehicles or generic ERG language — the duplicate / generic /
"refer to the ERG" symptoms the professor saw.

### The fix (n8n side — applied + verified structurally)

- Added the 3 missing tool nodes (`nissan_ariya_2026`, `rivian_r1t_2025`,
  `volkswagen_id4_2025`), each cloned from the `hyundai_ioniq_5_2025` template
  (`vectorStorePinecone` tv 1.3, `retrieve-as-tool`, index `ford-mache-erg`,
  Pinecone cred `phcrMIwaG0BbRZgY`), plus 3 paired `embeddingsOpenAi` nodes —
  **6 new nodes, 6 new connections** (`Embeddings → tool` ai_embedding,
  `tool → Router Agent` ai_tool). `toolDescription` text verbatim from
  `n8n_router_config.md` (Nissan ERG-only caveat kept). **Router Agent now has
  14 tools wired (was 11).**
- System-prompt polish (appended to `Router Agent` `options.systemMessage`,
  nothing removed, temperature left at 0.1): general-EV fallback (labeled
  `GENERIC — confirm vehicle before relying on this`), partial-ID relaxation,
  anti-hedge.
- Applied via the n8n public API: GET → mutate → `PUT /workflows/S3uHJF57JAuA7bL0`
  (first PUT 400 on `settings` extra props; stripped `timeSavedMode`/
  `callerPolicy`/`availableInMCP`, kept `executionOrder: v1` → **PUT 200**).
  Pre-change workflow backed up to `/tmp/n8n_workflow_backup.json` for rollback.
  Fresh GET confirms `active: true`, all 6 nodes + 6 connections present.
- **No re-ingestion needed** — the data already exists in Pinecone. Running
  `ingestion.ipynb` as-is would be harmful (it would recreate the retired
  `erg_full`/`rescue_sheet` namespaces). Generalizing the notebook to a
  13-vehicle loop is parked.

### BLOCKED — live chat verification (expired OpenAI key, NOT our change)

The 6 end-to-end webhook tests (VW / Nissan / Rivian + Tesla & Mach-E
regression + fire-fallback) **could not run**. Every call returns HTTP 200 with
an empty body in ~1.3 s; the n8n execution detail shows it dies upstream at the
**`OpenAI Chat Model`** node (the agent's LLM brain) before routing to any
tool:

> `NodeOperationError: Authorization failed — Incorrect API key provided: sk-proj-…eBgA`

The OpenAI key on n8n credential `dLb32e73iouY9DvH` ("OpenAi account 3") is
invalid/expired. **The key in the repo `.env` (`OPENAI_API_KEY`) is the SAME
key (`…eBgA`)** — so re-pasting `.env` into the credential will NOT fix it; a
fresh `sk-…` key is required. The n8n public API does not expose
credential-secret updates, so this must be done in the n8n UI
(Credentials → *OpenAi account 3* → paste a current key → Save). The structural
fix is in place and verified, so once the key is refreshed the 6 tests should
resolve to the correct per-vehicle namespaces — re-run them then.

### Repo cleanup — `Ford Mache-E/` → `vehicle_docs/`

The docs folder was historically named `Ford Mache-E/` but holds ERG + Rescue
Sheet PDFs for all 13 vehicles. Renamed via `git mv` (history + `processed.log`
preserved). PDF filenames and Pinecone namespace names unchanged.

### Changes

| File / target | Change |
|---|---|
| n8n workflow `S3uHJF57JAuA7bL0` | Added 3 tool nodes + 3 embeddings nodes + 6 connections (Router Agent 11→14 tools); appended fallback/partial-ID/anti-hedge to the system prompt; PUT 200; backup at `/tmp/n8n_workflow_backup.json` |
| `Ford Mache-E/` → `vehicle_docs/` | `git mv` rename; all PDFs + `processed.log` moved with history preserved |
| `ingestion.ipynb` | `DRIVE_PATH` now `os.path.join(os.getcwd(), "vehicle_docs")` (DOCS list still stale — do NOT Run All as-is) |
| `README.md` | Updated `processed.log` path + project-layout tree to `vehicle_docs/` |
| `CLAUDE.md` | Project-layout tree + re-ingest command path → `vehicle_docs/`; rewrote the stale "n8n still points at retired namespaces" open issue to reflect the true state |
| `progress.md` | This entry |

---

## 2026-06-22 — Router Re-Diagnosis: Real Bug Was Retrieval Depth + Prompt Contradiction + Weak Model (Supersedes the 06-18 "3 Missing Tools" Theory) + Eval Set 60→90 + Skill Cleanup

**Status:** Done — fix applied to live workflow `S3uHJF57JAuA7bL0` via the n8n public API, verified live before/after through the chat webhook
**Author:** Irfan Gazi (Claude Code assisted)

### Context — the professor's report, take two

After the 06-18 changes a professor still reported the same class of failures:
answers identical across different vehicles, hallucinated numbers, intermittent
generic "refer to the ERG" deferrals, hedging, and no graceful fallback when the
vehicle was unidentified. We re-audited from scratch via the n8n API + Pinecone
REST.

### What the re-audit ruled OUT (the assumed causes were wrong)

- **Data is present and correctly namespaced for all 13 vehicles** — not a
  Mach-E-only index.
- **All 14 retrieval tools were already wired** — the 06-18 "3 missing tool
  nodes" diagnosis was superseded; the tools were present.
- **Embeddings already matched ingestion** (`text-embedding-3-small`, 1536-dim) —
  no embedding mismatch.

### The real root causes (all in the live workflow, none in the repo data)

1. **`topK` unset → silently defaulted to 4** on every one of the 14
   `vectorStorePinecone` tools. Vehicle-specific HV-shutdown / no-cut chunks fell
   outside the top-4, so the model back-filled from generic EV knowledge. This was
   the **dominant, model-independent cause**.
2. **A self-contradicting system prompt.** STEP 1 said "if no vehicle, do NOT call
   a tool, ask the user" and ROUTING said "the ONLY exception is asking to specify
   the vehicle" — both directly conflicted with the appended GENERIC-EV FALLBACK /
   partial-ID / anti-hedge sections, making those sections dead letters. Named
   vehicles intermittently fell through to the generic refusal (~1-in-3).
3. **A weak router model** — `gpt-5-mini` at `reasoningEffort: low`.

### The fix (applied via the n8n public API — GET → mutate → PUT)

- **`topK = 10` on all 14 `vectorStorePinecone` nodes** (was unset/4). The single
  highest-impact change.
- **Router model → Claude Opus 4.8** — node "Anthropic Chat Model"
  (`lmChatAnthropic`), credential `UCQvHWq77alNk0u4` "Anthropic account (Opus
  router)", replacing the gpt-5-mini brain.
- **De-contradicted the STEP 1 and ROUTING-RULES clauses** so the GENERIC-EV
  fallback, partial-ID relaxation, and anti-hedge sections actually fire: when no
  supported vehicle is identified, the agent now outputs the clearly-labeled
  GENERIC interim protocol first, then asks for make/model/year.
- **Embeddings untouched** — Anthropic has no embeddings API and the index is
  1536-dim 3-small; **no re-ingestion needed.**
- Verified live via the chat webhook (before/after reproduction). This also
  clears the 06-18 BLOCKED state — the prior expired-OpenAI-key blocker on the
  agent LLM is moot now that the brain is the Anthropic credential.

### Eval set expanded 60 → 90 (live-class questions)

`eval_questions.json` grew from 60 to 90 questions. **IDs 61-90 are questions
actually asked during the live training class** — posed by the instructor to the
room or by a participant (new `asked_by` field) — extracted from the `Talk/`
transcripts, including **Video 0 (the intro lecture)**, which the original set
never covered. Topics include orange/yellow wiring color codes, the two HV-disable
methods, seat-occupant drive-ready detection, and the green READY light.

### Repo / skill cleanup

- Removed the **`aframe-webxr`** skill (SKILL.md + assets/references/scripts) and
  dropped both `aframe-webxr` and `developing-with-streamlit` from
  `skills-lock.json` — the A-Frame v1 VR portal was retired in favor of IWSDK v2.
- Deleted top-level `README.md` (project docs now live in `CLAUDE.md` +
  `progress.md`).

### Changes

| File / target | Change |
|---|---|
| n8n workflow `S3uHJF57JAuA7bL0` | `topK = 10` on all 14 Pinecone tools; router model → Claude Opus 4.8 (`lmChatAnthropic`, cred `UCQvHWq77alNk0u4`); de-contradicted STEP 1 + ROUTING clauses so the GENERIC fallback fires; verified live |
| `n8n_router_config.md` | Added 2026-06-22 update note; rewrote STEP 1 + ROUTING-RULES to allow the labeled GENERIC interim protocol before vehicle ID |
| `eval_questions.json` | 60 → 90 questions; IDs 61-90 are live-class questions (new `asked_by` field) from `Talk/` transcripts incl. Video 0 intro lecture |
| `.claude/skills/aframe-webxr/` + `skills-lock.json` | Removed the A-Frame skill; dropped `aframe-webxr` + `developing-with-streamlit` lock entries |
| `README.md` | Deleted |
| `CLAUDE.md` | "Known open issues" rewritten — the 06-18 "3 missing tools" note marked superseded; real causes (topK/prompt/model) documented |
| `progress.md` | This entry |

---

## 2026-06-24 — Router Model Finalized: Claude Sonnet 4.6 (Audit-Log Closeout)

The live router on workflow `S3uHJF57JAuA7bL0` is now **`claude-sonnet-4-6`** and
left in place as the production model. Confirmed live via the n8n public API:
node "Anthropic Chat Model" (`@n8n/n8n-nodes-langchain.lmChatAnthropic`),
credential `UCQvHWq77alNk0u4` (name "Anthropic account (Opus router)" is
historical; it now serves Sonnet).

**Lineage:** Opus 4.8 (2026-06-22 post-fix baseline) → Opus 4.6 (retest, full
24-prompt parity + source-PDF verification) → **Sonnet 4.6 (production)**. The
2026-06-22 fix established the real defects were retrieval depth (`topK` 4→10)
and a self-contradicting system prompt — **model-independent**. Parity (same
safety-critical numbers, same citations, same deferral-then-ground policy) held
across both Opus models, so swapping in Sonnet 4.6 carries that precedent.

**Honesty note:** Sonnet 4.6 is **operator-confirmed in live use, NOT re-run
through the formal 24-prompt harness.** The closeout is recorded as such in
`EV_responder_QA_comparison.md` ("Final router model" section) so the audit trail
is not misread as a fresh capture. To produce a model-matched capture later,
re-send the 24 grounded prompts with fresh `session_id`s and append a parity
table.

| File / target | Change |
|---|---|
| n8n workflow `S3uHJF57JAuA7bL0` | Production router confirmed `claude-sonnet-4-6` (read-only verification; no workflow edit this session) |
| `EV_responder_QA_comparison.md` | Appended "Final router model: Claude Sonnet 4.6" closeout section |
| `CLAUDE.md` | "Known open issues" router note updated: production model now Sonnet 4.6 (was Opus 4.8) |
| `progress.md` | This entry |

---

## 2026-06-29 — v2 Portal Copy Cleanup + Streamlit VR Caption Reword (Deployed)

**Status:** Deployed — v2 live on CloudFront; Streamlit caption pushed to `feature/streamlit-landing-page`
**Author:** Irfan Gazi (Claude Code assisted)

Frontend copy polish, no behavior change.

### `portal/index.html` (v2)

- Removed the bottom hint line `Hold and drag to rotate view | On Meta Quest: tap "Enter VR"` (redundant — drag-to-look is discoverable, and the Enter VR button is self-explanatory).
- Removed the middle `First Responder GPT — Ask Anything` chat-panel header.
- Viewer header `360° Site Video` → `360° Video`.

### `streamlit_app.py` (VR caption)

Reworded the Tab 1 caption to tell headset users they can enter VR by tapping the **Enter VR** button in the bottom-right corner, from their headset's browser:

> 🥽 On a VR headset? [Open the portal directly](…) in your headset's browser, then tap the **Enter VR** button in the bottom-right corner to step inside.

No `CACHE_BUST` bump — this edits the Streamlit app itself (redeployed wholesale by Streamlit Cloud), not the embedded portal HTML.

### Deploy

- `npx tsc --noEmit` clean → `npm run build` (bundle `index-231veDSM.js`) → `python3.10 deploy_portal_v2.py` (10 files to `s3://…/v2/`, CloudFront invalidation `IZPVZMGQ3JZF5CRDWT28OZW7N` on `/v2/*`). Live at `…/v2/index.html`.
- Streamlit caption committed + pushed to **`feature/streamlit-landing-page`** (the branch Streamlit Cloud auto-deploys from). The `portal/index.html` commit lives on `meta-webvr` (local; not pushed).

### Changes

| File | Change |
|---|---|
| `portal/index.html` | Removed bottom rotate/Enter-VR hint + chat-panel header; `360° Site Video` → `360° Video` |
| `streamlit_app.py` | Reworded VR caption to point at the bottom-right Enter VR button |
| `CLAUDE.md` | Trimmed the router open-issue wall; removed the resolved transcribe-webhook issue; refreshed v2-shakedown + voice.ts notes |
| `progress.md` | This entry |

---

## 2026-06-29 — n8n Router Minimal Hardening (maxIterations + prompt de-dup)

**Status:** Applied live to workflow `S3uHJF57JAuA7bL0`; verified via API + chat-webhook smoke test
**Author:** Irfan Gazi (Claude Code assisted)

Low-risk hardening of the live Router Agent — **not** a fix; the router was already
operator-confirmed live. Triggered by a ChatGPT verdict suggesting (a) a
router→answer-agent split and (b) collapsing the 14 per-vehicle Pinecone tools into
one `search_vehicle_documents(vehicle, …)` tool. Both were checked against the live
workflow and **rejected**: there is no separate answer agent (it's a single
`@n8n/n8n-nodes-langchain.agent` that routes *and* composes), and each of the 14
`vectorStorePinecone` tools has its namespace hardcoded — wrong-vehicle retrieval is
structurally impossible today. A single `$fromAI`-slug tool would move the namespace
to an LLM-generated string whose typos return empty results silently, re-opening the
exact generic-backfill failure mode the 2026-06-22 `topK` fix closed. Revisit only at
50+ vehicles, and only with a deterministic vehicle→namespace map (a `.toolWorkflow`,
not `$fromAI`).

Two changes only — **no retrieval/`topK`, model, embedding, or architecture changes:**

1. **`options.maxIterations = 10`** on the Router Agent (was unset). The Mach-E path
   instructs two tool calls before answering (`call video_transcript FIRST … ALSO
   cross-check ford_mach_e_2026`); 10 is ample headroom and cheap insurance against
   truncated multi-call answers.
2. **Dropped the standalone `VIDEO TRANSCRIPT TOOL:` block** (5 lines) from the system
   message — fully duplicated by the `video_transcript` tool's own description, and the
   cross-tool orchestration it implied is already preserved in ROUTING RULES. System
   message 6,693 → 6,380 chars. Everything else kept verbatim (SUPPORTED VEHICLES list,
   GENERIC fallback, partial-ID relaxation, anti-hedge, citations).

### Mechanics / gotcha

Edited via the n8n public API (`PUT /workflows/{id}`) from a backed-up copy of the
live JSON. **`PUT` rejects extra top-level props and extra `settings` props** — first
attempt 400'd on `settings must NOT have additional properties` (`timeSavedMode`,
`callerPolicy`, `availableInMCP`). Fix: send only `{ name, nodes, connections,
settings }` with `settings` trimmed to the public-API-allowed subset (`executionOrder`
here); n8n re-applies its internal defaults itself (verified the live settings came
back identical). A full backup was kept for rollback (not needed).

### Verification

- Re-GET asserts: `maxIterations == 10`, no `VIDEO TRANSCRIPT TOOL` in the prompt,
  only the Router Agent node changed vs backup, all 14 Pinecone tools still `topK=10`,
  model still `claude-sonnet-4-6` (cred `UCQvHWq77alNk0u4`), workflow still active.
- Live chat-webhook smoke test (fresh `session_id` per probe): Mach-E video question
  still routes to `video_transcript`; Tesla 12V-location stays Tesla-specific (no
  cross-vehicle bleed); unsupported "Lucid Air" returns the labeled GENERIC protocol +
  asks for make/model/year. No regression.

| File / target | Change |
|---|---|
| n8n workflow `S3uHJF57JAuA7bL0` | `options.maxIterations = 10` on Router Agent; removed duplicated `VIDEO TRANSCRIPT TOOL` block from system message |
| `n8n_router_config.md` | Removed the block from the embedded system message; added 2026-06-29 hardening note + PUT-settings gotcha |
| `progress.md` | This entry |

---

## 2026-06-29 — Router Prompt De-Contradiction (Single/Multi-Tool Wording) + Full System-Message Doc Sync

**Status:** Applied live to workflow `S3uHJF57JAuA7bL0`; doc sync committed 2026-07-05
**Author:** Irfan Gazi (Claude Code assisted)

Follow-on to the maxIterations/VIDEO-TRANSCRIPT-TOOL hardening above, same day. Reworded
the SUPPORTED VEHICLES header from "call exactly one vehicle tool per answer" to "call
the matching vehicle tool — normally one per answer; the Mach-E video path in ROUTING
RULES may use two, and the GENERIC/partial-ID fallbacks use none." The old absolute
"exactly one" directly contradicted the ROUTING-RULES Mach-E path (call
`video_transcript` FIRST, ALSO cross-check `ford_mach_e_2026`) — the same
self-contradiction class as the 2026-06-22 topK/prompt fix, this time sitting on a
safety-relevant cross-check path rather than the generic-fallback path.

Also synced `n8n_router_config.md` section 1 to the **full** live system message —
GENERAL-EV FALLBACK, PARTIAL-IDENTIFIER RELAXATION, and ANTI-HEDGE blocks were live
(from the 2026-06-22 fix) but missing from the doc, so a future re-paste from the repo
into n8n would have silently regressed that fix. Applied via `PUT
/workflows/S3uHJF57JAuA7bL0`; live systemMessage now 6,495 chars. `maxIterations`
unchanged at 10; no retrieval/topK/model/embedding changes. Optional enhancements
(few-shot examples, a "found-but-ambiguous" output line) were reviewed and deferred to
keep scope tight.

The doc-sync commit itself landed six days late (2026-07-05, `ea3bfa8`) — the n8n side
was live-current the whole time; only the repo's written record lagged.

| File / target | Change |
|---|---|
| n8n workflow `S3uHJF57JAuA7bL0` | Reworded SUPPORTED VEHICLES header to stop contradicting the Mach-E two-tool path |
| `n8n_router_config.md` | Full sync to live system message (GENERIC fallback, partial-ID relaxation, anti-hedge); added 2026-06-29 note |
| `progress.md` | This entry |

---

## 2026-07-05 — Workflow Tooling: Graphify Prune, Skill-Tree Consolidation, `n8n_sync.py` + `run_eval.py`

**Status:** Committed (`88c6252`)
**Author:** Irfan Gazi (Claude Code assisted)

Housekeeping + two new operational scripts, no product-behavior change.

**Graphify:** added `.graphifyignore` (mirrors the large/secret excludes already in
`.gitignore` — notably `360/`, 66 GB — since a root `.graphifyignore` *shadows*
`.gitignore` for graphify's own scan) and excluded the vendored skill trees
(`.claude/skills/`, `portal/.claude/skills/`) so the graph indexes project code, not
skill documentation. Pruned the resulting stale skill-doc nodes from `graph.json` and
regenerated `GRAPH_REPORT.md`/`graph.html` — `graphify query "deployment workflow"` now
returns project code instead of skill boilerplate.

**Skill trees:** consolidated `.agents/` into `.claude/skills/` — migrated the two
skills unique to `.agents/` (`n8n-mcp-tools-expert`, `n8n-node-configuration`) with
`SOURCE.md` provenance notes, committed the vendored `prompt-engineering-patterns`
skill (already tracked in `skills-lock.json` but not committed), then deleted
`.agents/`.

**`n8n_sync.py`** (new, `python3.10` + stdlib + dotenv): read-only drift check of the
live workflow against the 4 production invariants established by the 2026-06-22/24/29
router work — topK==10 on all 14 `vectorStorePinecone` nodes, router model
`claude-sonnet-4-6`, `maxIterations`==10, live `systemMessage` sha256 matches
`n8n_router_config.md` §1. `--push`/`--push --yes` sync doc→live. Verified green
against the live workflow at commit time. Directly encodes the 2026-06-22 lesson
(diagnose the *live* workflow, not repo data) as a repeatable check instead of a
one-off manual audit.

**`run_eval.py`** (new): automated eval runner — POSTs all of `eval_questions.json` (90
QA pairs) to the chat webhook, writes a dated `eval_results/<date>.md` pass/fail table
(heuristic keyword-overlap triage, REVIEW rows for hand-check). `--sample N`, `--ids
61-90`, `--cache` (skip IDs already answered for the current router-config hash).
Replaces the hand-filled `baseline_results.md`/`postfix_results.md` workflow from the
2026-06-18/22 audits. Smoke-tested on 3 questions.

**`ingestion.ipynb`:** added a stale-`DOCS`-list guard cell — raises unless
`I_UNDERSTAND_DOCS_IS_STALE=True`, since the notebook's `DOCS` list still targets the
retired Mach-E-only `erg_full`/`rescue_sheet` namespaces and a blind Run-All would
recreate them. Saved outputs cleared.

| File / target | Change |
|---|---|
| `.graphifyignore` (new) | Excludes vendored skill trees + `360/` from graphify's scan |
| `graphify-out/*` | Pruned stale skill-doc nodes, regenerated report/html |
| `.agents/` → `.claude/skills/` | Consolidated; `.agents/` deleted |
| `n8n_sync.py` (new) | Read-only (+ `--push`) drift checker for the live router workflow |
| `run_eval.py` (new) | Automated 90-question eval runner → dated results tables |
| `ingestion.ipynb` | Added stale-`DOCS` guard cell; cleared outputs |
| `progress.md` | This entry |

---

## 2026-07-06 — v2 Portal: Deploy the Dead-CSS Cleanup That Never Shipped + Graphify Refresh + Router Doc Fix

**Status:** Deployed; verified live
**Author:** Irfan Gazi (Claude Code assisted)

Session-start check ("is everything live?") turned up a real gap: `ea3bfa8`
(2026-07-05) had removed the now-orphaned `.v2-tag`, `.chat-header`, and `.hint` CSS
rules from `portal/index.html` (dead code left behind by the 2026-06-29 copy cleanup,
which removed the *elements* those rules styled but not the rules themselves) — but
that commit was never built or deployed. `portal/dist/` was still the 2026-06-29
09:52 build; CloudFront was serving it unchanged. Confirmed via `curl` against
`https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html`: the stale `chat-header`/`v2-tag`
selectors were still present live.

Fixed: `npx tsc --noEmit` (clean) → `npm run build` → `python3.10 deploy_portal_v2.py`
(10 files to `s3://first-responder-training/v2/`, CloudFront invalidation
`I5VU7J5XCZKNMVWDJTQSMLG1XS` on `/v2/*`). Re-curled post-invalidation: stale selectors
gone. JS bundle hash unchanged (`index-231veDSM.js`) since only the unhashed
`index.html` changed.

Also ran `python3.10 n8n_sync.py --check` (all 4 invariants PASS — the live router
needed no changes) and `graphify update .` to refresh the knowledge graph, which had
gone 12 days stale (last built 2026-06-24, missing the `88c6252`/`ea3bfa8` commits):
now 206 nodes, 269 edges, 13 communities.

Left for a follow-up commit: `n8n_router_config.md` still has one stale label
("Claude Opus 4.8" instead of "claude-sonnet-4-6" in the 2026-06-22 update header) —
a doc-only correction, not a live-workflow change.

| File / target | Change |
|---|---|
| `portal/dist/` + `s3://…/v2/` | Rebuilt and redeployed — ships the 2026-07-05 dead-CSS removal that had been committed but not deployed |
| `graphify-out/*` | Refreshed (was 12 days stale): 206 nodes, 269 edges, 13 communities |
| — | `n8n_sync.py --check`: all 4 production invariants PASS, no live changes needed |
| `progress.md` | This entry |

---

## 2026-07-20 — v2 HUD Overhaul: Scrollable Chat Bubbles, Seek Controls, Quick-Ask Chips, Thumbstick Scroll

**Status:** Committed (`a7f9b28`) and verified in the IWER emulator — **NOT deployed**
**Author:** Irfan Gazi (Claude Code assisted)

Executed `portal/plan.md` top to bottom — four changes to the in-VR HUD, all in the
v2 IWSDK portal.

**1. Scrollable chat bubble list.** The HUD previously flattened the whole
conversation into one `<span>` capped at 4 messages x 280 chars. Replaced with
`#hud-chat-scroll`, a fixed-height (`26`) `overflow: scroll` container holding
per-role bubbles built at runtime via `new UIKit.Container` / `new UIKit.Text`.
User bubbles are right-aligned blue, bot bubbles left-aligned grey, each with a
role label. History cap 4 -> 40; `getRenderedHistory()` and its 280-char
truncation deleted in favour of `getChatHistory()`. The list rebuilds whole on each
message (cheap at n<=40, far simpler than diffing) and auto-scrolls to the newest
one `setTimeout(..., 50)` later, since UIKit layout is async.

**2. Video seek controls.** New seek row between the playback row and the chat
surface: `< 10s` / `10s >` buttons plus a progress track/fill. `seekBy()` clamps to
`[0, duration]`; the existing 0.25 s poll drives the fill width as a percentage.

**3. Quick-Ask chips.** Three preset questions (shut down HV / battery fire / where
to cut) sendable with one ray click — no typing, no voice, which matters with
gloves on. `sendMessage()` gained an optional `overrideText` param and a thin
`askQuickQuestion()` wrapper; answers flow through the existing
`addMessage` -> `mirrorToHud` path, so bubbles and the answer chime work with no
extra code. Also hardened the DOM send button: `addEventListener("click", sendMessage)`
became an explicit zero-arg closure, since a bare reference would have passed the
DOM `Event` object in as `overrideText`.

**4. Left-thumbstick chat scrolling**, running every frame ahead of the 0.25 s
throttle (the right hand stays free for push-to-talk). Sign verified in-emulator as
written — stick up scrolls toward older messages — so no negation was needed.

**Verification.** `npx tsc --noEmit` clean; uikitml compiled (the `&lt;`/`&gt;`
entities decode correctly to `< 10s` / `10s >`, and `overflow: scroll` survives into
`public/ui/hud.json`); `npm run build` succeeded; `graphify update .` refreshed the
graph to 675 nodes / 925 edges / 43 communities. In the IWER emulator: HUD renders
with no tofu boxes, chip `:hover` fires, a chip ray-click produced a correctly
labelled user bubble with "Thinking..." status, stacked bubbles auto-scrolled to
bottom, and thumbstick scrolling moved the list with a visible scrollbar.

**Found during verification — the n8n chat webhook is returning empty responses.**
`POST` to the chat webhook returns **HTTP 200 with a zero-byte body** in ~2 s (far
too fast for an agent call), so the client's `res.json()` throws and no answer ever
renders. Reproduced independently of the portal with `curl` (`status=200
size=0`); the HUD surfaced it exactly as designed: *"Chat error: Failed to execute
'json' on 'Response': Unexpected end of JSON input"*. Workflow `S3uHJF57JAuA7bL0` is
active and its Webhook node is correctly configured (`responseMode: responseNode`,
Respond node present), so it is failing somewhere upstream of the response. **Not
caused by this session's changes** — `chat.ts`'s request/parse path is untouched
apart from where the question string originates. Left unfixed pending a decision;
see Open Items.

Consequence: the **bot**-role bubble branch is code-review-verified only — it is the
same `makeBubble` call with the role flipped, but no bot bubble was ever observed
rendering. Re-check once the webhook is fixed.

Not deployed, per the plan — the Quest shakedown still gates deploys, and the seek
row + progress bar cannot be exercised in the emulator anyway (CORS blocks the HLS
360 video), so both join the Quest-hardware test list.

| File / target | Change |
|---|---|
| `portal/ui/hud.uikitml` | Seek row, chips row, `#hud-chat-scroll`; dropped `.chat-history` + `.chat-surface`'s `min-height` |
| `portal/src/hud.ts` | Bubble rendering (`renderChatBubbles`/`makeBubble`), `seekBy`, progress fill, chip wiring, thumbstick scroll |
| `portal/src/hud-mirror.ts` | History cap 4 -> 40; `getRenderedHistory()` -> `getChatHistory()` (no truncation) |
| `portal/src/chat.ts` | `sendMessage(overrideText?)` + `askQuickQuestion()`; send-button closure fix |
| `graphify-out/*` | Refreshed: 675 nodes, 925 edges, 43 communities |
| — | **Not deployed.** Chat webhook found returning empty 200s (pre-existing, server-side) |
| `progress.md` | This entry |

---

## 2026-08-03 — In-VR Chat Box: Bubble Overflow Fixed, Glyph Count Bounded, Concurrent Sends Guarded

**Status:** Committed (`336d04e`) and **DEPLOYED** to `/v2/` — the first v2 deploy since 06-08
**Author:** Irfan Gazi (Claude Code assisted)

Reported symptom: "in the VR the chat box gets weird and the app crashes." The n8n side
was **not** the cause — the operator had resumed the Supabase instance backing
`Postgres Chat Memory`, which closed out the 07-20 empty-200 finding below. Verified
healthy across five live POSTs (200, 1391–2638 B, 6.8–24.3 s) before touching any code.

**1. The layout defect — reproduced, root-caused, fixed.** `makeBubble` built a
shrink-to-fit `UIKit.Container` with `maxWidth: "85%"` around an unsized `UIKit.Text`.
Yoga clamps the container's *panel rect* to 85% but still measures the Text at its full
unwrapped intrinsic width, so a long bot answer painted its glyphs **outside** the grey
bubble background and past the scroll viewport's right edge. That is "gets weird."
Fix: definite `width: "85%"` (not `maxWidth`) + `overflow: "hidden"` on the container,
`width: "100%"` on both Text children, `wordBreak: "break-word"` on the body. Verified
structurally rather than by eye — `scene_get_object_transform` gives bubble
`globalScale[0]` 0.7629 vs scroll parent 0.9145 = 83%, left edges flush at −0.457, right
edge 0.305 inside the 0.457 viewport.

**2. No in-flight guard on the send path.** `sendMessage` disabled `sendBtn`, but the
in-VR Quick-Ask chips and voice call it *directly* and bypass the button entirely. Two
rapid ray-clicks fired two concurrent 24-second agent calls and rendered two duplicate
user bubbles; the first completion's `setHudPending(false)` also cleared "Thinking..."
while the second was still running. Now a module-level `inFlight` flag covers chips,
voice, Enter and the button uniformly. Timeout raised 30 s → 60 s (measured answers run
to 24 s; 30 s left no margin on headset WiFi and a mid-answer abort is its own weird
state). `res.json()` replaced with `res.text()` + explicit `JSON.parse`, so a zero-byte
body reads as "Assistant returned an empty response" instead of the raw
*"Failed to execute 'json' on 'Response'"* the HUD showed in July.

**3. Four crash mechanisms removed** — all regressions introduced by the 07-20 overhaul:

- **Unbounded glyph count.** The overhaul deleted `getRenderedHistory()`'s 280-char
  truncation *and* raised the history cap 4 → 40. At ~1800 plain-text chars per answer
  that is ~80k live glyph instances sharing a Quest GPU with a 4K360 video texture; v1
  never had this exposure. Now `MAX_BUBBLES = 6` — **nothing is truncated**, older turns
  stay in `hud-mirror`'s history and in the DOM panel, they are simply not built as
  geometry.
- **O(n²) rebuild storm.** `setChatListener` replayed history by invoking the listener
  once per message, and the listener ran a full teardown/rebuild of every bubble — while
  `wireHud` *already* seeded itself from `getChatHistory()`. With 40 messages that is
  1600 component constructions, 1600 `dispose()` calls in one synchronous burst, 40
  queued `setTimeout`s and 20 simultaneous chimes. `eb2a6aa`'s catch-up wiring is what
  made this path reachable; the code comment claiming "history is empty at wire time" no
  longer held. Replay loop deleted.
- **Full teardown/rebuild per message** in the steady state → incremental
  `appendBubble()` over a self-tracked `bubbles[]` array, so removal can never touch a
  child UIKit owns.
- **NaN-poisoned scroll.** `Math.min(max, …)` in the thumbstick handler propagated NaN
  into `scrollPosition` when `maxScrollPosition` was unmeasured; NaN in a transform takes
  the renderer down. Both operands now `Number.isFinite`-guarded.

**4. Crash self-reporting** (`index.ts`): `error`, `unhandledrejection` and
`webglcontextlost` handlers log a `[fatal]` breadcrumb and flash it on the HUD, so the
next headset failure names itself instead of needing a verbal report.

**The crash itself was never reproduced.** Five real exchanges, concurrent sends and
thumbstick scrolling produced zero JS exceptions beyond the known dev-server video CORS
failure. The remaining mechanisms are Quest-only (GPU/memory pressure, `layers:true`
quad-layer compositing) — neither of which IWER exercises. That is precisely why the
breadcrumbs went in. `USE_WEBXR_LAYERS` (`index.ts:25`) stays `true`; it is the one-line
A/B to flip first if the headset still dies.

**Gotcha worth keeping:** UIKit `maxWidth` does **not** wrap child text. Use a definite
`width`, and verify wrapping with `scene_get_object_transform` scale ratios — a
screenshot at HUD distance is not conclusive.

| File / target | Change |
|---|---|
| `portal/src/hud.ts` | `width`+`overflow:hidden` bubbles; `bubbles[]` tracking; `renderInitial()`/`appendBubble()`; `MAX_BUBBLES=6`; shared scroll timer; NaN guard |
| `portal/src/hud-mirror.ts` | `setChatListener` no longer replays history through the listener |
| `portal/src/chat.ts` | `inFlight` guard; 30 s → 60 s timeout; `text()`+`JSON.parse` with empty/unreadable-body messages |
| `portal/src/index.ts` | `[fatal]` handlers: `error`, `unhandledrejection`, `webglcontextlost` |
| — | **Deployed:** `index-DjOsp3E-.js`, invalidation `I265DGY1NKX15AJOY0PN136BUK`; new bundle confirmed *served*, not just uploaded |

---

## 2026-08-03 — Branch Code Review (15 Findings) + Three Fixes: Chat Send-Lock, HLS Recovery, Stale CACHE_BUST

Ran `/code-review` over the whole `meta-webvr` branch diff (9 commits, `42e24d2..336d04e`),
covering `portal/src/*.ts`, `n8n_sync.py`, `run_eval.py`, `streamlit_app.py` and the
working tree. **15 findings.** Fixed the three that directly gate the Quest shakedown;
the rest are logged under Open Items rather than silently dropped.

**1. `chat.ts` — the send-lock could brick chat until a page reload.** `inFlight = true`
was set *outside* the `try`, with `addMessage()`, `addTyping()` and `setHudPending(true)`
sitting between it and the `try`. All three reach into UIKit on the in-VR HUD — exactly
the paths the 07-20/08-03 hardening commits suspect of throwing on a Quest. Any throw
there skipped the `finally`, stranding `inFlight === true`: every later send then died at
the guard with "Still answering the last question..." and the DOM Send button stayed
disabled, with no indication why. All UIKit-touching setup now lives inside the `try`;
`typingEl` is a `HTMLDivElement | null` declared above it and removed with `?.`. The
`finally` was also reordered — `inFlight = false` and `sendBtn.disabled = false` run
first, then `setHudPending(false)` inside its own try/catch, because a HUD throw *in the
finally* would have recreated the identical lockout one level deeper.

**2. `videosphere.ts` — the fatal-HLS handler defeated its own recovery.** Two defects in
four lines. `hls.recoverMediaError()` was immediately followed by `videoEls[idx].pause()`,
stopping the playback the recovery had just resumed and showing a failure banner anyway.
And fatal `NETWORK_ERROR` — the common case on headset WiFi, the one the error message
literally names ("check connection") — had **no retry at all** and left `hlsInstances[idx]`
set, so a later `activatePanorama(idx)` returned early at the `if (hlsInstances[idx])`
guard and waited forever on a `MANIFEST_PARSED` that could never fire. That lecture stayed
unwatchable for the rest of the session. Now: NETWORK_ERROR → `startLoad()`, MEDIA_ERROR →
`recoverMediaError()` with nothing after it, both bounded at 3 attempts per stream
(`hlsRecoveries[]`, reset on every `FRAG_BUFFERED` so a long session can't accumulate its
way into a false give-up). On giving up: `destroy()` + null the instance + clear
`hlsReady[idx]`, so a retry rebuilds from scratch. Same state reset added to the
native-HLS (Safari) branch.

**3. `streamlit_app.py` — `CACHE_BUST` was stale.** Still `20260608a`, unchanged across
the entire 9-commit branch, even though `portal/index.html` changed in it and Streamlit
now embeds `/v2/index.html?v={CACHE_BUST}` as the default. Deploying without the bump
reproduces the exact "I don't see my changes" failure the parked `/ship` skill exists to
prevent. Now `20260803a`; the comment names v2 as the default embed instead of only the
v1 files.

Verified with `npx tsc --noEmit` (clean) and `npm run build` (succeeds,
`dist/assets/index-DE6ISCbf.js`). **Not deployed** — deploys still gate on the Quest
shakedown, same as 07-20.

**Not fixed this session,** in rough severity order: `n8n_sync.py`'s `trim_settings()`
silently resets live workflow settings on `--push --yes` (keeps only `executionOrder`,
so a UI-configured `timezone`/`errorWorkflow`/`executionTimeout` is wiped by a
prompt-only sync); `n8n_sync.py`'s doc key `video_transcript` can never match the live
namespace `video_transcript_v2`, so tool descriptions may never push while `--check`
still reports OVERALL PASS; `hud-mirror.ts`'s `toAscii()` collapses newlines and strips
`°`/`≥`/`±`, so numbered shutdown procedures arrive on the headset as one run-on
paragraph with units missing — degraded *only* for the user who can't see the DOM;
`voice.ts` leaves a sticky "Transcribing..." on the HUD forever when the transcribe
webhook fails; `chat.ts`'s empty-body guard still lets `[]`/`{}` render as the answer;
video and chat errors clobber each other in the shared `#error-banner`; `activatePanorama`
never pauses the outgoing video (overlapping audio + two concurrent 4K decodes);
`hud.ts` never resets `this.placeholder` on re-wire and never registers its
chat/transcript listeners for cleanup; `hud-mirror.ts` re-parses markdown `chat.ts`
already parsed.

**Repo hazard flagged, not resolved:** the working tree deletes `ingestion.ipynb` and
`ingestion_transcript.ipynb` (2093 + 802 lines) and re-adds them only under an
**untracked** `Ingestions/` directory. Committing that as-is removes the only documented
PDF/transcript re-ingestion path from version control. Left uncommitted deliberately —
needs a decision on the new location plus four CLAUDE.md path updates.

| File / target | Change |
|---|---|
| `portal/src/chat.ts` | Send-lock moved inside `try`; nullable `typingEl`; `finally` reordered + HUD call isolated |
| `portal/src/videosphere.ts` | Real NETWORK/MEDIA recovery, bounded at 3 with `FRAG_BUFFERED` reset, teardown + state reset on give-up; native-HLS branch reset too |
| `streamlit_app.py` | `CACHE_BUST` `20260608a` → `20260803a`; comment now names `v2/index.html` |
| — | **Not deployed.** 12 of 15 findings remain open (see above + Open Items) |
| `progress.md` | This entry |

---

## 2026-08-10 — The Quest "browser closed on me" Crash: It Was `inputEl.focus()` Opening the VR Overlay Keyboard (Found via `adb logcat`, Not Inference)

**The crash is fixed, and for the first time it was actually *observed* rather than
guessed at.** Three sessions of hypothesis-driven fixes (bubble overflow, `MAX_BUBBLES`,
glyph budget, WebXR quad layers, GPU-memory exhaustion) all missed, because every one of
them assumed a JS- or GPU-level failure. It was neither.

### Root cause

`adb logcat -b crash` on the real Quest 3, at the moment the user reproduced it:

```
08-10 10:14:55.524  FATAL EXCEPTION: main
  Process: com.oculus.browser, PID: 9087
  Caused by: java.lang.IllegalStateException:
      You need to use a Theme.AppCompat theme (or descendant) with this activity.
    at gu.setContentView(chromium-OculusBrowser.apk-stable-570200647:8)
    at android.app.Dialog.show(Dialog.java:325)
    at com.oculus.browser.VrShellDelegate.showOverlayKeyboard(...:91)
08-10 10:14:59.978  I Process       : Sending signal. PID: 9087 SIG: 9
08-10 10:15:00.071  I ActivityManager: Process com.oculus.browser (pid 9087) has died: fg +50 FGS
```

Focusing a DOM text input during a WebXR session makes the Meta Quest Browser open its VR
overlay keyboard; that keyboard throws while inflating its own dialog; the throw is
uncaught on the browser's Android **main Looper**, so Android's default handler SIGKILLs
the process. **The entire browser dies — not the tab. No reload, no recovery.** This is a
Meta Quest Browser bug (build `570200647`), not portal code. We can only avoid tripping it.

Our trigger: `chat.ts` ran `inputEl.focus()` **unconditionally in `sendMessage()`'s
`finally` block** — i.e. the instant every answer finished rendering. That is exactly the
reported symptom ("when the answer was generated the browser closed on me"), and exactly
why it reproduced on *every* in-VR question.

**Why nothing in the app ever saw it:** `window.onerror` never fires, no
`webglcontextlost`, no console output. The failure is one layer below anything JavaScript
can observe. The localStorage breadcrumb system built for this hunt could not have caught
it either — a point worth remembering next time.

### Fix

`focusInput()` in `chat.ts` gates focus on `isImmersive()`; `voice.ts`'s two focus calls
route through the same helper so the whole bug class is gone. `isImmersive` is fed by
**two independent sources** — `HudSystem`'s `world.visibilityState` subscription *and*
`renderer.xr` `sessionstart`/`sessionend` in `index.ts` — deliberately redundant, because
getting this one flag wrong kills the browser. Skipping focus in VR costs nothing: the DOM
composer is invisible in an immersive session.

### Verified, both directions

- **User retest on-headset:** answer rendered and was readable; browser survived.
- **Device log:** the full 105,419-line capture spans 10:03 → 10:38 and contains
  **exactly one** `FATAL EXCEPTION` — the original pre-fix one at 10:15:00. The browser
  restarted at 10:18 and ran to the end of the capture with **zero** further
  `com.oculus.browser ... has died` records.

### Also this session

**Meta VR CLI (`metavr`, formerly `hzdb`) removed from `portal/.mcp.json`** — it hard-gates
on `linux-x64` (`supported: darwin-arm64, darwin-x64, win32-x64`) and had been **silently
failing to start on every launch for months**; no `mcp__hzdb__*` tool was ever actually
available here. Replaced in `portal/CLAUDE.md` with the plain-`adb` equivalents table and
the `chrome://inspect#devices` path. `adb` is `/usr/lib/android-sdk/platform-tools/adb`
(Debian 28.0.2, from `apt install adb`). Note the split: **DevTools shows what the page
did; logcat shows what killed it.** A sleeping Quest exposes no DevTools socket at all —
the headset must be awake for a renderer to exist.

**In-VR chat scrolling fixed.** All three existing paths failed the user for different
reasons: UIKit drag-to-scroll needs the trigger held while sweeping the controller (fights
push-to-talk, imprecise with gloves); the left thumbstick worked but nothing on screen
advertised it and it dies entirely under hand tracking; and auto-scroll fired once at
50 ms, while a long answer is still wrapping — so it landed short of the real bottom.
Added `^ Up` / `v Down` / `Latest` buttons on the panel riding the same click path as the
quick-ask chips, made auto-scroll retry 4× over ~500 ms, and funnelled every scroll path
through one clamped helper. The old thumbstick code would have thrown on a null
`scrollPosition`, and read the "not yet overflowing" `undefined` max as a silent dead end.
Verified in IWER: ray-clicked a chip, got a real answer, confirmed auto-scroll hit bottom,
then `^ Up` paged back and the thumbstick paged forward. Zero console errors.

**Diagnostics stripped** now that the cause is known: `src/flags.ts` deleted (`?layers`,
`?video`, `?maxlevel`, `?hudchat` gone), the amber on-page breadcrumb panel removed, the
per-bubble GPU-counter pair reduced to one line. Kept the silent `crumb()` ring buffer —
it costs nothing and is the only trail that survives a tab death; read it with
`frCrumbs()` over `adb` + `chrome://inspect`.

| File / target | Change |
|---|---|
| `portal/src/chat.ts` | `focusInput()` guard + the full logcat trace as its doc comment; `finally` now calls it |
| `portal/src/voice.ts` | Both `inputEl.focus()` calls routed through `focusInput()` |
| `portal/src/hud-mirror.ts` | `setImmersive()` / `isImmersive()` shared flag |
| `portal/src/index.ts` | `sessionstart`/`sessionend` as a second independent source for the flag; flags + crumb-panel wiring removed |
| `portal/src/hud.ts` | `scrollChatBy` / `scrollChatToBottom` / `chatPageUnits` helpers; scroll buttons wired; retrying auto-scroll |
| `portal/ui/hud.uikitml` | `^ Up` / `v Down` / `Latest` row; hint now names the left stick |
| `portal/src/breadcrumbs.ts` | **New** (from the hunt); on-page panel stripped, `frCrumbs()` console inspector kept |
| `portal/src/videosphere.ts` | `?maxlevel` pin removed; ABR levels still logged once per lecture |
| `portal/src/flags.ts` | **Deleted** |
| `portal/vite.config.ts` | `/videos` → CloudFront dev proxy (makes HLS same-origin so the LAN dev server can reproduce headset conditions) |
| Deploy | `index-BuzlsTkp.js`, invalidation `IBYLNB4E9K2VJN4SJQGKWTJ94O`; served hash + new `ui/hud.json` both confirmed live |

---

## Next Steps / Open Items

- [x] **Import + activate `n8n_transcribe_webhook.json`** — done; live endpoint verified (`{"text":"Beep."}`)
- [x] **Deploy the 2026-06-01 v2 overhaul to CloudFront** — done (`index-EH2SN-ar.js`, invalidation `I925KT8NGZAV1LNRADY7WAVL52`)
- [x] **IWSDK v2 dev-server shakedown** — done 2026-06-01: IWER pass verified boot, follower-HUD comfort/lazy-follow, ray-click lecture switch. 360° video (dev CORS) + push-to-talk (no mic) are Quest-only tests
- [x] **Streamlit default → v2 IWSDK** — done 2026-06-08: tab1 embeds `/v2/index.html`, `?portal=v1` fallback; VR-module placeholder tab removed (deploy branch `feature/streamlit-landing-page`)
- [x] **Desktop/touch drag-to-look for the v2 360° videosphere** — done 2026-06-08 (`DesktopLookSystem`); verified live via Playwright (`index-231veDSM.js`)
- [ ] **`n8n_sync.py --push` is unsafe to run (2026-08-03)** — `trim_settings()` keeps only `executionOrder` and PUTs that, so a prompt-only sync silently wipes any UI-configured `timezone` / `errorWorkflow` / `executionTimeout` / `saveDataErrorExecution` on `S3uHJF57JAuA7bL0`. Preserve the live settings dict instead of trimming it. `--check` is unaffected and still safe
- [ ] **`n8n_sync.py` tool descriptions may never push (2026-08-03)** — doc key `video_transcript` (parsed from the `###` header) can't match the live namespace `video_transcript_v2`, and node names with hyphens (`ford_mach-e_2026`) don't match doc keys (`ford_mach_e_2026`). Silent skip, no warning, and `check_invariants` never verifies descriptions so `--check` still reports OVERALL PASS. Add a warn-on-unmatched path
- [ ] **`toAscii()` degrades safety-critical answers on the headset (2026-08-03)** — `hud-mirror.ts` collapses `\s+` to single spaces (numbered shutdown procedures become one run-on paragraph) and strips `°`/`≥`/`≤`/`±`/`→` ("above 2,000 °F" → "above 2,000 F"). The DOM panel is correct; only the in-VR user sees the degraded text. Preserve newlines and transliterate the units the font atlas lacks
- [ ] **Decide where the ingestion notebooks live (2026-08-03)** — working tree deletes `ingestion.ipynb` + `ingestion_transcript.ipynb` from the repo root with untracked copies in `Ingestions/`. Either `git add Ingestions/` and fix the four CLAUDE.md references (quick-start rows, project-layout block, the stale-`DOCS` open-issue note), or restore them. Currently uncommitted so nothing is lost
- [ ] **Remaining 2026-08-03 review findings (lower severity)** — sticky "Transcribing..." on transcribe-webhook failure (`voice.ts`); `[]`/`{}` rendered as a chat answer (`chat.ts` empty-body guard); video/chat errors clobbering the shared `#error-banner`; `activatePanorama` not pausing the outgoing video; `hud.ts` stale `placeholder` on re-wire + unregistered listener cleanup; duplicate `marked.parse` in `hud-mirror.ts`
- [x] **Chat webhook returns empty 200s (2026-07-20)** — resolved 2026-08-03. Root cause was the paused Supabase instance behind `Postgres Chat Memory`: execution `854` showed `Webhook → success`, `Postgres Chat Memory → ERROR "connection cannot be established"`, `Router Agent → ERROR`, so `Respond to Webhook` never ran and n8n closed the request with a zero-byte body. Operator resumed Supabase; five live POSTs verified 200 / 1391–2638 B / 6.8–24.3 s. No workflow changes were needed — again a LIVE-side fault, not repo data
- [x] **Deploy the 2026-07-20 HUD overhaul to `/v2/`** — done 2026-08-03 alongside the chat-box fix (`index-DjOsp3E-.js`, invalidation `I265DGY1NKX15AJOY0PN136BUK`); new bundle confirmed served
- [x] **Verify the bot-role chat bubble renders** — done 2026-08-03; bot bubbles render and chime, and fixing their overflow was this session's main change
- [x] **Deploy the 2026-08-03 code-review fixes** — done 2026-08-10; `f31db3c` (chat send-lock, HLS recovery) shipped inside `index-BuzlsTkp.js`. `streamlit_app.py` `CACHE_BUST` was already bumped to `20260803a`
- [x] **The in-VR answer-render crash** — fixed and confirmed 2026-08-10 (overlay-keyboard focus; see entry above). Superseded the whole `USE_WEBXR_LAYERS` / GPU-budget line of inquiry — layers are back on permanently
- [ ] **IWSDK v2 Quest 3 in-headset shakedown (remainder)** — load `https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html` directly (NOT via Streamlit iframe). Crash retest and in-VR chat scrolling are now **done**; still unvalidated on device: HUD comfort distance, push-to-talk latency, trigger-vs-laser conflict, and the seek buttons + progress bar (untestable in IWER — CORS blocks HLS, though the new `/videos` dev proxy makes the LAN dev server a viable substitute)
- [ ] **Quest memory pressure — observed, not diagnosed (2026-08-10)** — during the crash capture, `lowmemorykiller` was culling background apps (whatsapp, documentsui, systemutilities) at adj 975→945 and a renderer logged `Received critical onTrimMemory`. The browser itself was never lmk-killed and `VrApi` reported `Free=2979MB`, so this was **not** the crash cause — but it is real, and it is the most likely candidate if a *different* failure mode shows up later. Trim the Havok WASM (~2 MB, `physics: false` yet still bundled) and the 4K video texture before chasing anything exotic
- [ ] **IWSDK v2 cutover** — only after green shakedown: re-upload `portal/dist/index.html` as `inspector_portal.html` (per CLAUDE.md hard rule #2, never `copy_object`), bump CACHE_BUST, invalidate `/inspector_portal.html`
- [ ] **Original A-Frame in-VR HUD shakedown** — superseded by IWSDK shakedown above if v2 cutover proceeds; otherwise still pending
- [ ] **Full 360° video fix:** add mid (~2560×1280) + low (~1600×800) HLS renditions + master playlist, reusing existing 4K segments in place (plan: `~/.claude/plans/dreamy-kindling-lobster.md`)
- [ ] Wire `video_transcript_v2` namespace into n8n workflow (replace or add alongside `video_transcript`)
- [ ] Run evaluation: send all 90 questions from `eval_questions.json` (incl. the 30 live-class questions, IDs 61-90) through the chatbot, score answers
- [ ] Decide whether to retire `video_transcript` namespace post-evaluation
- [ ] Consider adding chapter markers to `video_metadata.json` for finer-grained citations
- [ ] Portal UI: surface `chunk_start_seconds` from responses to auto-seek the 360° video player to the cited moment
