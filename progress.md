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

## Next Steps / Open Items

- [ ] **Import + activate `n8n_transcribe_webhook.json`** in n8n cloud, then verify with the curl check — unblocks in-VR voice on Quest
- [ ] **IWSDK v2 dev-server shakedown** — `cd portal && npm run dev`, then drive IWER from MCP runtime tools to verify lecture switching, HUD clicks, push-to-talk, chat round-trip
- [ ] **IWSDK v2 Quest 3 in-headset shakedown** — load `https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html` directly (NOT via Streamlit iframe); validate HUD comfort distance, push-to-talk latency, trigger-vs-laser conflict
- [ ] **IWSDK v2 cutover** — only after green shakedown: re-upload `portal/dist/index.html` as `inspector_portal.html` (per CLAUDE.md hard rule #2, never `copy_object`), bump CACHE_BUST, invalidate `/inspector_portal.html`
- [ ] **Original A-Frame in-VR HUD shakedown** — superseded by IWSDK shakedown above if v2 cutover proceeds; otherwise still pending
- [ ] **Full 360° video fix:** add mid (~2560×1280) + low (~1600×800) HLS renditions + master playlist, reusing existing 4K segments in place (plan: `~/.claude/plans/dreamy-kindling-lobster.md`)
- [ ] Wire `video_transcript_v2` namespace into n8n workflow (replace or add alongside `video_transcript`)
- [ ] Run evaluation: send all 50 questions from `eval_questions.json` through the chatbot, score answers
- [ ] Decide whether to retire `video_transcript` namespace post-evaluation
- [ ] Consider adding chapter markers to `video_metadata.json` for finer-grained citations
- [ ] Portal UI: surface `chunk_start_seconds` from responses to auto-seek the 360° video player to the cited moment
