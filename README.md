# Ford Mustang Mach-E 2026 — First Responder RAG Portal

An AI-powered web portal for firefighters, paramedics, and first responders. Combines a 360° interactive training video with a chatbot that answers emergency response questions using the official Emergency Response Guide (ERG), Rescue Sheet, and training video transcripts — all indexed into a Pinecone vector store and routed through an n8n AI agent.

---

## What It Does

- **360° Video Player** — interactive walk-around of the Ford Mach-E, drag to rotate, scroll to zoom; WebXR "Enter VR" support on Meta Quest
- **AI Chatbot** — answers questions about HV shutdown, fire response, no-cut zones, airbag locations, etc.
- **Voice input** — browser-native speech-to-text (Web Speech API); no extra API key required
- **Three knowledge sources** routed by topic:
  - `erg_full` — 38-page Emergency Response Guide (procedural steps)
  - `rescue_sheet` — 4-page quick-reference diagram card (component locations)
  - `video_transcript` — 360° training video narration (instructor walkthroughs)

---

## Prerequisites

Install system dependencies (macOS):

```bash
brew install poppler tesseract ffmpeg
```

Install Python packages (Python 3.11 required):

```bash
pip install openai-whisper openai pinecone-client python-dotenv unstructured[pdf]
```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Irfan-Gazi0/RAG_Responder.git
cd RAG_Responder
```

### 2. Add API keys

Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
```

You need:
- [OpenAI API key](https://platform.openai.com/api-keys) — for embeddings (`text-embedding-3-small`) and the GPT-4o agent
- [Pinecone API key](https://app.pinecone.io) — free Starter tier is sufficient

### 3. Create the Pinecone index

In the [Pinecone console](https://app.pinecone.io), create an index:

| Setting | Value |
|---|---|
| Index name | `ford-mache-erg` |
| Dimensions | `1536` |
| Metric | `cosine` |
| Cloud / Region | AWS `us-east-1` |

### 4. Index the PDF documents

Open `ingestion.ipynb` in VS Code, select the **Python 3.11** kernel, and run all cells.

This partitions the ERG and Rescue Sheet PDFs, generates embeddings, and upserts into Pinecone under namespaces `erg_full` and `rescue_sheet`.

> Safe to re-run. Delete `Ford Mache-E/processed.log` to force a full re-index.

### 5. Add and transcribe training videos (optional)

Place your 360° `.mp4` training videos into the `360/` folder, then run:

```bash
python3 transcribe_videos.py --model turbo
```

This uses local OpenAI Whisper to transcribe each video and saves a `*_segments.json` file per video into `Talk/`.

Already-transcribed files are skipped automatically. Use `--force` to re-transcribe.

> **Note:** Transcription is slow on CPU. A 52-minute video takes roughly 10–20 minutes on an M-series Mac.

### 6. Index the transcripts

Open `ingestion_transcript.ipynb` in VS Code, select the **Python 3.11** kernel, and run all cells.

This chunks the transcripts using a sliding window (10 segments, step 8), embeds them, and upserts into Pinecone under the `video_transcript` namespace with timestamps and video labels attached as metadata.

> Safe to re-run — upsert is idempotent (same vector IDs overwrite, no duplicates).

### 7. Set up the n8n AI agent

1. Sign up at [n8n.io](https://n8n.io) (cloud or self-hosted)
2. Go to **Workflows → Import** and upload `Sample n8n JSON/1.1 First Responder.json`
3. In the imported workflow, update the credentials:
   - **OpenAI Chat Model** and **Embeddings OpenAI** nodes → add your OpenAI API key
   - **erg_full**, **rescue_sheet**, **video_transcript** Pinecone nodes → add your Pinecone API key
   - **Postgres Chat Memory** → add a PostgreSQL connection (used for per-session chat history)
4. Copy the **Webhook URL** from the Webhook node (it looks like `https://your-n8n.app.n8n.cloud/webhook/...`)
5. Open `inspector_portal.html` and update the `WEBHOOK_URL` constant at the top of the `<script>` section:

```javascript
const WEBHOOK_URL = "https://your-n8n.app.n8n.cloud/webhook/your-webhook-id";
```

6. Activate the workflow in n8n (toggle to **Active**)

### 8. Run the portal

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/inspector_portal.html](http://localhost:8080/inspector_portal.html) in your browser.

---

## Project Structure

```
RAG_Responder/
├── inspector_portal.html         # Web UI: 360° video + chatbot
├── ingestion.ipynb               # PDF ingestion pipeline (ERG + Rescue Sheet)
├── ingestion_transcript.ipynb    # Transcript ingestion pipeline
├── transcribe_videos.py          # Transcribe videos → Talk/*_segments.json
├── .env                          # API keys (not committed)
├── 360/                          # 360° video files (not committed — too large)
├── Ford Mache-E/
│   ├── EmergencyResponseGuide-Ford-Mach-E-2026.pdf
│   ├── RescueSheet-Ford-Mach-E-2026.pdf
│   └── processed.log
├── Talk/
│   └── *_segments.json           # Whisper transcript output
└── Sample n8n JSON/
    └── 1.1 First Responder.json  # n8n workflow — import this
```

---

## Architecture

```
Browser
  ├── 360° Video Player (A-Frame v1.6 / WebXR + HLS.js)
  └── Chatbot UI
        │  POST { question, session_id }
        ▼
    n8n Webhook
        │
    Router Agent (GPT-4o)
        ├── erg_full tool      → Pinecone namespace: erg_full       (37 docs)
        ├── rescue_sheet tool  → Pinecone namespace: rescue_sheet   (4 docs)
        └── video_transcript   → Pinecone namespace: video_transcript (537 docs)
```

**Routing logic:**
- How-to / procedural questions → `erg_full`
- "Where is" / location questions → `rescue_sheet` first, then `erg_full`
- Training video / instructor said → `video_transcript` first
- Safety-critical → always cross-check `erg_full`

---

## Chatbot Request / Response Format

The portal POSTs to the n8n webhook:

```json
{ "question": "How do I shut off the HV system?", "session_id": "uuid-here" }
```

n8n returns:

```json
{ "output": "Step 1: Press the Start/Stop button..." }
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Video player | A-Frame v1.6 (WebXR) + HLS.js |
| Chat UI | Vanilla JS + Marked.js |
| Voice input | Web Speech API (browser-native, no key) |
| AI agent | n8n (LangChain agent, GPT-4o) |
| Vector store | Pinecone (`text-embedding-3-small`, 1536 dims) |
| Chat memory | PostgreSQL (via n8n) |
| PDF parsing | Unstructured (`partition_pdf`) + Tesseract OCR fallback |
| Transcription | OpenAI Whisper (local, `turbo` model) |
| Embeddings | OpenAI `text-embedding-3-small` |

---

## Troubleshooting

**Whisper FP16 warning on Mac:**  
`FP16 is not supported on CPU; using FP32 instead` — this is expected on Apple Silicon without CUDA. Transcription still works correctly.

**`pip install openai-whisper` fails:**  
Make sure you're using Python 3.11 (`/opt/homebrew/bin/python3.11`). Python 3.9 (macOS system default) lacks required packages.

**Chatbot returns "No matching information found":**  
Check that Pinecone is reachable and the index name/namespace match exactly. Verify your `.env` keys are correct.

**n8n webhook not responding:**  
Ensure the workflow is set to **Active** in n8n. Test mode webhooks only fire when the workflow editor is open.

**360° video plays audio but shows no picture (Linux + Chrome):**  
Chrome on Linux often lacks hardware H.264 decode, so the single 4K stream can't keep up as a live WebGL texture. Enable `chrome://settings` → System → **"Use graphics acceleration when available"**, restart Chrome, and confirm `chrome://gpu` shows **"Video Decode: Hardware accelerated"**. A lower-resolution adaptive (ABR) rendition ladder is the full fix (see `CLAUDE.md` → NEXT STEP).

**Voice input button does nothing:**  
The Web Speech API requires an HTTPS origin and a supported browser (Chrome/Edge/Safari; not Firefox). The button is auto-disabled with a tooltip where unsupported.
