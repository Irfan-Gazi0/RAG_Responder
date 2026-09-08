# UX pass 2 — "clear + informative" — RUNBOOK

**Status: code is written, type-checked, built and verified in a browser.
Nothing is live yet.** Sections 1–3 are the ground truth you need before you
touch anything. Section 4 lists what was already changed (do not redo it).
Section 5 is the remaining work, as exact commands. Section 6 is how you check
you succeeded. Section 7 lists what was deliberately NOT built, and why —
do not "helpfully" add those back.

This file replaces the earlier aspirational plan. Everything here is either a
verified fact about this repo or a literal command to run.

---

## 1. Ground truth: this is three deployables, not one app

The old plan said "inspect the current frontend" as if there were one. There
are three, they ship by three different mechanisms, and one of them is not ours.

| # | Thing | Path | How it ships | Can we change it? |
|---|---|---|---|---|
| 1 | Streamlit shell (hero, `Training` / `EV Explorer` tabs, all orientation copy) | `streamlit_app.py` | Streamlit Cloud auto-rebuilds on **push to `feature/streamlit-landing-page`** | Yes |
| 2 | The portal + the standalone chat panel | `apps/portal/` (Vite/TS → `dist/`) | `npm run build` then `python3.10 deploy/deploy_portal_v2.py --root` to S3/CloudFront | Yes |
| 3 | The desktop 3D vehicle viewer inside the EV Explorer tab | `https://alistairwstbrk.github.io/DOE-Training/` | Not ours. Third-party GitHub Pages site. | **No** |

Two consequences you must respect:

- **Editing a file is not shipping it.** A change to `apps/portal/index.html`
  is invisible on the live site until you run the build *and* the deploy script
  *and* bump `CACHE_BUST`. See §5.
- **You cannot add anything inside the 3D viewer.** No vehicle cards, no
  "Start exploring" button, no in-canvas interaction hints. Anything you want a
  user to read about that tab goes in `streamlit_app.py`, above the iframe.

### What the third-party viewer actually offers (verified 2026-09-07)

Read from its own `main.js` and confirmed on screen. Copy may describe **only**
these:

- A sidebar titled "Chevrolet Equinox EV" with a **Camera Views** select.
- An **Emergency Response Guide** panel (the Equinox ERG PDF, inline + new tab).
- **Guided Training** → `Start Guided Tour`, 4 stops: Vehicle Overview / Front
  Bumper / Engine Bay / Charging Port (CCS1).
- Three clickable 3D annotation pins: HV battery warning label, 12 V battery,
  charge port.
- Drag to rotate, scroll to zoom.

**It has exactly ONE vehicle.** Its tour and pins are chosen by substring match
against `?url=`, and the only mapped key is `EQUINOXREFINE_FINAL`. Passing any
other `?url=` silently loads a scan with no tour, no pins, and camera presets
aimed at the wrong bodywork. **Never add `?url=` to `SPLAT_VIEWER`.**

### What it does NOT offer

No "no-cut zones". No "stabilization / lifting points". Those hazard markers
exist only in the separate WebXR viewer (`apps/splat-vr/`, linked not embedded)
and **every one of them still carries `verified: false`** — their positions were
inferred from ERG diagrams and have never been confirmed in a headset. Telling a
responder where to cut is safety-critical. **Do not advertise cut points or
lift points anywhere in the UI until those flags are flipped by a human on
device.**

---

## 2. Where copy is allowed to live

`apps/portal/index.html` is **also the page a Quest loads** (it is served at the
S3 root as `inspector_portal.html`). Its `<body>` is `height: 100vh;
overflow: hidden`, and the video fills the remaining space.

- **Orientation paragraphs → `streamlit_app.py`**, outside the iframe. They then
  cannot steal video height and cannot follow the user into VR.
- **Labels, one-line hints → `apps/portal/index.html`**, inside the control bar.

---

## 3. Hard rules (breaking one of these breaks production)

1. **The `<div class="chat-empty">` block must stay identical in
   `apps/portal/index.html` and `apps/portal/chat.html`** (modulo leading
   indentation). It is one panel rendered in two places. Change one → change
   both. Verify with the snippet in §6.
2. **`npx tsc --noEmit` must be clean before any build.** IWSDK type errors
   frequently do not surface at runtime.
3. **In-VR HUD text (`apps/portal/ui/hud.uikitml`) is ASCII only.** The font
   atlas has no glyphs for emoji, `—`, `…`, `·` or curly quotes; they render as
   tofu boxes. DOM text has no such limit — `·` and `°` in `index.html` are fine.
4. **Bump `CACHE_BUST` in `streamlit_app.py` whenever portal HTML changes.**
   CloudFront serves the HTML with no `Cache-Control`, so Chrome caches it
   heuristically and a CloudFront invalidation does **not** clear that.
5. **`aws` CLI is not installed.** Use `python3.10` + the scripts in `deploy/`.
   Bare `python3` lacks `dotenv`.
6. **Do not touch the VR entry happy path.** Specifically: never `await`
   between the Enter-VR click and `world.launchXR()`. An await can spend the
   transient user activation that `requestSession()` requires on the headset.
7. **Streamlit Cloud deploys `feature/streamlit-landing-page`.** Work committed
   to any other branch is invisible on the live site.

---

## 4. Already done — do NOT redo (code written, tsc clean, build clean, checked in Chrome)

### 4.1 `streamlit_app.py`

- `page_title` `"RAG Responder Hub"` → `"First Responder Training"`. "RAG" is
  implementation jargon; it was the browser tab title.
- `CACHE_BUST` `20260907e` → `20260907f`.
- New `.tab-intro` CSS rule (with a comment explaining why the copy lives here
  and not in the portal).
- **Training tab intro**, above the existing VR note:
  > **Watch the 360° training and ask questions as you go.** Drag the video to
  > look around the scene. The Training Assistant beside it answers questions
  > about what you are watching, EV hazards and emergency-response procedure.
  > *Start with 1 · Fundamentals, then 2 · Charging & Battery, then 3 · Fire
  > Response.*
- **EV Explorer tab intro**, above the existing VR/loading note:
  > **Explore a 3D scan of the Chevrolet Equinox EV.** Get familiar with the
  > vehicle before you have to work around one at a scene: drag to rotate,
  > scroll to zoom, and open a pin on the model to read what that component is.
  > *Use the sidebar for preset camera views, the guided walkthrough of the
  > exterior, front fascia, engine bay and charge port, and this vehicle's
  > Emergency Response Guide. The assistant on the right answers questions
  > about anything you find.*

  Every capability named there was checked against the live viewer. Nothing
  about cut zones or lifting points appears.

### 4.2 `apps/portal/index.html`

- Header: `360° Training` → `360° Training Video`; hint `Drag to rotate` →
  `Drag to look around the scene`.
- The three topic buttons are now a labelled row:
  `TRAINING TOPICS  [1 · Fundamentals] [2 · Charging & Battery] [3 · Fire Response]  Watch in order, or jump to one.`
  New CSS: `.lecture-row`, `.lecture-label`, `.lecture-hint`.
  **Button ids are unchanged (`btn-vid1/2/3`)** — `videosphere.ts:273` and the
  in-VR HUD bind to them by id.
- Chat empty-state paragraph → `Questions about the training? Ask about what
  you are watching, EV hazards, or emergency-response procedure.`
- New `@media (max-width: 760px)` block: stacks the video above the chat panel
  instead of squeezing a 400 px column beside it. Only fires below 760 px, so
  the Quest layout is untouched.

### 4.3 `apps/portal/chat.html`

- Same empty-state paragraph, kept byte-identical with `index.html`.

### 4.4 `apps/portal/src/hud.ts`

Fixes a dead button. `#btn-enter-vr` called `world.launchXR()`, and
`@iwsdk/core`'s `launchXR` is `requestSession(...).then(...)` **with no
`.catch`**. Inside the Streamlit iframe `xr-spatial-tracking` is withheld, so
the click produced an unhandled rejection and nothing visible.

Now: `isSessionSupported("immersive-vr")` is probed **once at init** into
`this.xrSupported`, and the click branches on that boolean **synchronously**
(rule 3.6). When VR is unavailable the shared `#error-banner` explains which
case it is:

- `navigator.xr` present but unsupported → "No VR headset available in this
  browser. Open this page in your headset's browser, then tap Enter VR."
- `navigator.xr` absent (embedded) → "This embedded view can't start VR. Open
  the portal directly in your headset's browser, then tap Enter VR."

Confirmed on screen in desktop Chrome.

### 4.5 Verification already performed

- `npx tsc --noEmit` → clean.
- `npm run build` → clean, both entries emitted, `hud.json` compiled.
- Streamlit run locally, both tabs screenshotted; EV Explorer intro checked
  side-by-side against the live viewer's actual sidebar.
- Portal `dist/` served over plain HTTP and screenshotted at full width and at
  a 500 px viewport (stacked layout confirmed).
- Enter VR clicked with no headset → banner appears with the right message.

---

## 5. Remaining work — run these in order

Run every command from the repo root `/home/igazi2/Documents/RAG_Responder`
unless the command itself changes directory.

### Step 1 — rebuild (the tree may have changed since the last build)

```bash
cd apps/portal && npx tsc --noEmit && npm run build && cd -
```

Both must exit 0. If `tsc` reports an error, fix it before continuing; do not
build over a type error.

### Step 2 — deploy to the staging path and look at it

```bash
python3.10 deploy/deploy_portal_v2.py
```

This uploads `apps/portal/dist/` to `s3://first-responder-training/v2/` and
invalidates `/v2/*`. It re-fetches the live `index.html` and fails non-zero if
it does not match the local bundle. Then open
`https://d1ni7nkjr0eveg.cloudfront.net/v2/index.html` and confirm the header
reads "360° Training Video" and the topic row reads "TRAINING TOPICS".

### Step 3 — deploy to the live root

```bash
python3.10 deploy/deploy_portal_v2.py --root
```

`index.html` lands as `/inspector_portal.html`, `chat.html` as `/chat.html`,
plus `assets/`, `ui/`, `audio/`. The script verifies both entry pages against
the local bundle hash and exits non-zero if either is stale.

### Step 4 — refresh the knowledge graph

```bash
graphify update .
```

Required by `CLAUDE.md` after any code change. (The graph is currently stale —
it still models `streamlit_app.py → chat_panel.html`, a link deleted at the
2026-09-07 cutover.)

### Step 5 — commit and push

`streamlit_app.py` only goes live when it is pushed to
`feature/streamlit-landing-page`, which is the branch you should already be on.
Confirm, then commit:

```bash
git branch --show-current          # must print feature/streamlit-landing-page
git add streamlit_app.py apps/portal/index.html apps/portal/chat.html \
        apps/portal/src/hud.ts plan.md graphify-out/
git commit -m "$(cat <<'EOF'
UX pass 2: say what each part is, without adding a second title bar

<one paragraph on what a first-time user could not previously work out, and
what now tells them>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D6vZUezaDumzibHB1Hcs5R
EOF
)"
git push
```

Streamlit Cloud rebuilds `nec4-jumpstart.streamlit.app` automatically on that
push. Give it ~2 minutes, then run the §6 checks against the live site.

### Step 6 — record the one thing still untested

Append to the "Known open issues" list in `CLAUDE.md`:

> The Enter-VR fallback message added 2026-09-07 (`hud.ts`, `xrSupported`
> probe) has been seen only in desktop Chrome. On a Quest,
> `isSessionSupported("immersive-vr")` must return true so the button still
> launches the session — confirm on the next device pass that Enter VR still
> enters VR and no banner appears.

---

## 6. Acceptance checks — mechanical, run them all

### 6.1 Empty-state parity (hard rule 3.1)

```bash
cd apps/portal && python3 - <<'EOF'
import io, re
def block(p):
    s = io.open(p, encoding="utf-8").read()
    m = re.search(r'<div class="chat-empty" id="chat-empty">.*?</div>', s, re.S)
    return "\n".join(l.strip() for l in m.group(0).split("\n"))
print("identical:", block("index.html") == block("chat.html"))
EOF
```

Must print `identical: True`.

### 6.2 No implementation jargon reaches a user

```bash
grep -nEi "\brag\b|pinecone|vector (db|database)|n8n|namespace|webxr|rollup" \
  streamlit_app.py apps/portal/index.html apps/portal/chat.html
```

Only matches inside HTML comments or Python comments are acceptable. Any match
in visible text is a bug — rewrite it.

### 6.3 HUD text is still ASCII (hard rule 3.3)

```bash
python3 - <<'EOF'
import io
s = io.open("apps/portal/ui/hud.uikitml", encoding="utf-8").read()
bad = sorted({c for c in s if ord(c) > 127})
print("non-ascii in hud.uikitml:", bad or "none")
EOF
```

Must print `none`.

### 6.4 On the live site (`https://nec4-jumpstart.streamlit.app`)

- Browser tab title reads **First Responder Training** (not "RAG Responder Hub").
- **Training tab**, before scrolling: two sentences say what the training is and
  what the assistant is for; a third line names the starting topic.
- Inside the portal iframe: header reads **360° Training Video · Drag to look
  around the scene**; the topic row reads **TRAINING TOPICS** with buttons
  **1 · Fundamentals / 2 · Charging & Battery / 3 · Fire Response** and the hint
  **Watch in order, or jump to one.**
- Clicking a topic button switches the video **and** the bold summary line
  underneath. That bold summary is what tells the user which topic is playing —
  there is deliberately no separate "Current topic:" line.
- Clicking **Enter VR** inside the Streamlit page shows the red banner
  explaining that VR needs a headset browser (it does **not** silently do
  nothing).
- **EV Explorer tab**: the intro names the Equinox, and every capability it
  lists is visible in the sidebar (Camera Views / Emergency Response Guide /
  Start Guided Tour). It says nothing about cut zones or lifting points.
- Ask a question in the Training tab, switch to EV Explorer: the same
  conversation is there (shared `fr_transcript` in `localStorage`).

### 6.5 Narrow window

Drag the browser window to ~500 px wide, or open the portal URL on a phone. The
video must sit **above** the assistant, not beside it, and the page must scroll.

---

## 7. Rejected from the previous plan — do not build these

Each was in the earlier draft. Each is wrong for this codebase.

| Rejected | Why |
|---|---|
| "Choose a vehicle" / vehicle cards / `[ Start exploring ]` in EV Explorer | The embedded viewer is third-party and Equinox-only. There is no second vehicle to choose, and no way to inject a button into it. |
| Listing "No-cut zones" and "Stabilization / lifting points" as things you can explore | Not present in the embedded viewer at all. They exist only in `apps/splat-vr`, where every marker is still `verified: false`. Safety-critical; do not claim it. |
| An in-viewer "Drag to rotate / scroll to zoom / select highlighted areas" overlay | Same reason — we cannot render inside that iframe. The equivalent sentence now lives in the Streamlit intro. |
| A separate `Current topic: Fundamentals` line | Redundant. The active segmented button plus the bold topic name in `#video-summary` already say it, twice. A third indicator is the clutter the plan's own §12 warns against. |
| Per-topic description blocks under the three buttons | `videosphere.ts` already renders a rich per-topic summary into `#video-summary`, and it updates on switch. A second description layer duplicates it and eats video height. |
| An `<h2>EV Emergency Response Training</h2>` above the Training tab | The hero already says "First Responder Training" and the tab already says "Training". The previous UX pass existed specifically to kill a stack of four redundant title bars; do not rebuild one. The lead sentence is bolded instead. |
| Any orientation paragraph inside `apps/portal/index.html` | That file is the Quest page. See §2. |
| Curly quotes / `…` / emoji in HUD strings | Font atlas has no glyphs. See rule 3.3. |
