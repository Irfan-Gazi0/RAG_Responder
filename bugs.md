# bugs.md — full-module sweep, 2026-08-29

Every runnable module in this repo was executed and inspected. IWSDK / `portal/`
was skipped by request (its MCP tooling only loads from a `portal/` launch).

**What was run:** `splat-vr` typecheck + dev server + `render_check.mjs` +
`vr_check.mjs`, `streamlit_app.py` (driven in Chrome), `n8n_sync.py --check`,
`run_eval.py` (18 live webhook calls), `scripts/analyze_splats.py`, `graphify
update .`, byte-compile of all 9 Python modules, and a live check of every
CloudFront / Hugging Face / n8n endpoint the project depends on.

**Headline:** the four existing guards were all green *and hid three shipped
defects between them* — a controls panel that renders as nothing in VR, a live
deployment five days behind the source, and a RAG retrieval path that answers
1 in 15 of its own eval questions. None of those is visible from a passing test
suite, which is the through-line of this list.

---

## Status summary

| # | Severity | Finding | State |
|---|---|---|---|
| 1 | **P0** | In-VR controls panel faces 180° away on every VR entry | **fixed + guarded** |
| 2 | **P0** | Live `splat-vr` deployment is 5 days stale | needs deploy (your call) |
| 3 | **P0** | RAG transcript retrieval mis-scoped to Mach-E — 1/15 PASS | plan below, not applied |
| 4 | P1 | Deploy scripts claim success without verifying | plan below |
| 5 | P1 | `analyze_splats.py` tells you to paste values that regress scale 44% | plan below |
| 6 | P1 | Ingestion notebooks moved but never committed; docs point at gone paths | plan below |
| 7 | P1 | `run_eval.py` silently clobbers a same-day full run | plan below |
| 8–19 | P2 | Twelve smaller defects + doc drift | plan below |

---

## P0-1 — The in-VR controls panel renders as nothing (FIXED)

`splat-vr/src/help-panel.ts:place()` positioned the panel correctly and then
oriented it with:

```ts
const localCam = rig.worldToLocal(camPos.clone());
this.group.lookAt(localCam.x, this.group.position.y, localCam.z);
```

`Object3D.lookAt` takes a **world-space** target — it reads the object's own
position off `matrixWorld` and only converts the *result* back through the
parent's rotation. Feeding it a rig-local point mixes two frames, and the error
is exactly the rig's own translation.

`onEnterXr` calls `recentre()` (rig → `0,0,4.5`) **immediately before**
`helpPanel.show()`, so the rig is never at the origin when the panel is placed.

Measured through the dev seam:

| rig pose | panel normal · direction-to-head |
|---|---|
| origin `(0,0,0)` | **+0.988** — faces the viewer |
| after `recentre()` → `(0,0,4.5)` | **−0.988** — turned away |

The surface material is `MeshBasicMaterial` with default `side: FrontSide`, so
from behind it draws **nothing at all**, and its raycast misses too. This is not
a cosmetic mis-angle: on every VR entry the panel was invisible and its buttons
unreachable.

**Why 51/51 passed anyway.** `vr_check.mjs` reaches the panel through
`probeSurface()`, which steps out along *the panel's own +Z normal*. It therefore
lands on the front face whichever way the panel is turned. Every UV assertion is
structurally blind to orientation.

**Fix applied** — `help-panel.ts` now uses world coordinates, and `target` is
cloned because `worldToLocal()` mutates its argument in place (so `target.y` was
no longer `PLACE_HEIGHT` by the time `lookAt` read it):

```ts
this.group.position.copy(rig.worldToLocal(target.clone()));
this.group.lookAt(camPos.x, target.y, camPos.z);
```

**Guard added** — new `__vr.panelFacing()` seam in `main.ts` plus a `vr_check.mjs`
assertion, *"the panel faces the viewer after a recentre"*. Verified both ways:
it **FAILS** on the old code and **PASSES** on the fix. Suite is now **52/52**;
`render_check.mjs` still 4/4 (all scans within 3.5%).

`hotspot-card.ts` and `controller-hints.ts` were checked for the same class of
error — both are correct (they compose `parentInv * camWorldQuat` rather than
using `lookAt`). The defect was isolated to this one call site.

---

## P0-2 — The live splat-vr deployment is five days behind the source

```
live   https://…/splat-vr/  →  assets/index-Q1NEZhZM.js
local  splat-vr/dist/       →  assets/index-BpnDxUcH.js   (rebuilt today)
```

Feature probe of the **live** bundle:

| marker | live | local |
|---|---|---|
| `UNCONFIRMED PLACEMENT` (hazard hotspots) | ✗ | ✓ |
| `palmsign` (hand tracking) | ✗ | ✓ |
| `head travel` (tracking diagnostics) | ✗ | ✓ |
| `frameBufferScaleFactor` / `fixedFoveation` | ✓ | ✓ |

So the entire 2026-08-24 session — hazard markers, hand tracking, the 6DoF
diagnostic panel that CLAUDE.md's "NEXT SESSION" note asks you to read on device
— **was built but never deployed.** The half-resolution fix did ship.

This matters beyond staleness: the open issue list says *"NEXT SESSION: read the
panel on device and report what it says."* That panel does not exist in the live
build. Anyone following that instruction would find nothing and conclude the
diagnostics were broken.

**Plan**
1. `cd splat-vr && npm run build` — already done; `dist/` is clean (16 MB, four
   `.spz`, no `.ply` strays).
2. `python3.10 deploy_splat_vr.py` from the repo root.
3. Confirm with `curl -s …/splat-vr/index.html | grep -o 'assets/[^"]*'` that the
   served bundle name matches `dist/`. Do not trust the script's own success line
   (see P1-4).

Not deployed here — it is an outward-facing publish and yours to authorise.

---

## P0-3 — RAG: the transcript corpus is mis-scoped to the Mach-E

The 30 transcript-sourced eval questions are effectively unanswerable. Ran ids
61–75 against the live webhook:

**PASS 1 · FAIL 6 · REVIEW 8 · ERROR 0.**

The failures are not heuristic noise — they fall into three exact shapes:

| shape | example | id |
|---|---|---|
| refuses for lack of a vehicle | *"No vehicle has been identified in your question."* | 65, 74, 64 |
| pins to a default vehicle, then denies | *"**Ford Mustang Mach-E 2026** — The training videos do not contain a specific anecdote where…"* | 67, 69, 70, 62 |
| declines as out of scope | *"…a general industry standard — it is not specific to any…"* | 66, 71 |

**The content is demonstrably present.** Straight out of `Talk/*_segments.json`:

```
1790.76  We sat forward in Ashland, came across the vehicle where the contactors were stuck hot.
1904.58  So, J2929 is basically the Society of Automotive Engineers.
2107.52  Tesla, Lucid, Rivian.
1911.02  the Netherlands.
```

Those are verbatim the four answers the router said it did not have (ids 70, 66,
67, 73). Ingestion and the namespace are fine — `n8n_sync.py --check` passes all
four invariants, and the live node's namespace is correctly `video_transcript_v2`
at `topK=10`. **This is a routing defect, not a retrieval or data defect.**

Three reinforcing causes, all in live workflow `S3uHJF57JAuA7bL0`:

1. **The tool description mis-describes the corpus.** Live text opens:
   > *"Query spoken transcripts from the Sept 2025 **Mach-E 2026** First Responder Training videos."*

   The transcripts are a general instructor lecture — SAE J2929 badging,
   Tesla/Lucid/Rivian non-compliance, a Netherlands disconnect tool, the hybrid
   F-150's dual 12V, the Ashland stuck-contactor case. Almost none of it is
   Mach-E-specific. Per the project's own `n8n-agents` guidance, the tool
   description *is* the routing prompt.

2. **The system message repeats the scope error.** `n8n_router_config.md` §1:
   *"…Mustang Mach-E 2026 only — the 360° training video transcript"*, and
   ROUTING RULES gate the tool behind the Mach-E path (*"call `video_transcript`
   FIRST … ALSO cross-check `ford_mach_e_2026`"*).

3. **STEP 1 gates everything on identifying a vehicle**, and *"the only answer
   without a tool call is the clearly-labeled GENERIC fallback."* So a question
   about what the instructor said, with no vehicle named, routes to **generic
   model knowledge** rather than to the tool that holds the answer.

**Bonus defect found in the same place — video 3 is invisible to the router.**
The CONTENT MAP lists only *Video 1 (Exterior)* and *Video 2 (Interior/Underside)*,
and the citation clause maps only `VID_20250912_122900…` and `VID_20250912_134205…`.
`video_metadata.json` has **three** stems. The unmapped one —
`VID_20250912_110210_00_007_009` — is exactly the video containing J2929,
Ashland, Lucid and Rivian. The highest-value lecture material has no label, no
entry in the content map, and no reason for the router to reach for it.

**Plan** (edit `n8n_router_config.md` §1 + the tool description, then
`python3.10 n8n_sync.py --push --yes`; re-run `--check` after):

1. Rewrite the `video_transcript` tool description to say what it is: a
   **vehicle-agnostic instructor training session** covering general EV response
   practice, with Mach-E demonstrations as one part. State explicitly that it is
   the right tool when **no** vehicle is named.
2. Add the third video to the CONTENT MAP and to the `source_doc` → label
   citation mapping.
3. Amend STEP 1 / ROUTING RULES: a question about *the instructor, the training,
   the videos, or general EV practice* routes to `video_transcript` **without**
   requiring a vehicle — it must not fall through to the generic-knowledge
   fallback.
4. Drop "Mach-E 2026 only" from the corpus description in §1.
5. Re-run `python3.10 run_eval.py --ids 61-90` and compare. That band is the
   regression test for this fix; today's numbers (1/15 on 61–75) are the baseline.

Not applied — this is a live production workflow and the change is yours to make.

---

## P1-4 — Deploy scripts declare victory without checking

Both `deploy_splat_vr.py` and `deploy_portal_v2.py` end with an unconditional

```
🚀 Done. Splat VR viewer live at: https://…
```

There is no post-deploy verification anywhere, which is precisely how P0-2 went
unnoticed for five days. `deploy_splat_vr.py --upload --invalidate-only` also
uploads nothing, invalidates nothing, and still prints that line.

**Plan** — this is the parked `/ship` skill, and it has now cost something real:

1. After upload, `GET` the live `index.html`, parse out its `assets/*.js`
   reference, and assert it equals the local `dist/` bundle name. Exit non-zero
   otherwise.
2. Make `--upload --invalidate-only` an argparse error rather than a silent no-op.
3. Only print the success line once the assertion passes.

---

## P1-5 — `analyze_splats.py` tells you to paste values that regress scale

The script prints `Paste into splat-vr/src/models.ts:` and CLAUDE.md repeats
*"Re-run it after re-converting and paste the JSON into `splat-vr/src/models.ts`."*
Following that instruction breaks the calibration:

| scan | script emits | models.ts (correct) | error if pasted |
|---|---|---|---|
| equinox-hood-open | 1.123 | **1.565** | −28% |
| equinox-hood-closed | 1.126 | **1.387** | −19% |
| blazer-hood-open | 1.21 | **1.087** | +11% |
| blazer-hood-closed | 1.075 | **1.007** | +7% |

`models.ts` explains why: the analytic pass measures a bounding box that includes
each crop's captured tarmac, so scale had to be corrected empirically against
headless renders. `yOffset` diverges too (−0.596 vs −0.484). Only `rotation` is
safe to paste. `render_check.mjs` would catch the regression — but only if
someone runs it.

**Plan**
1. Split the output: print `rotation` under "paste this", and
   `scaleMultiplier` / `yOffset` under "starting estimate only — re-derive with
   `scripts/render_check.mjs`, do not paste over the tuned values".
2. Correct the CLAUDE.md line to match.

---

## P1-6 — The documented ingestion path points at files that are gone

`ingestion.ipynb` and `ingestion_transcript.ipynb` were moved to `Ingestions/`,
but the move was never committed — git still tracks them at the repo root as
deleted (`git status`: ` D ingestion.ipynb`). CLAUDE.md's quick-start table and
project layout both reference the root paths, which no longer exist on disk.

Same for `apply.md`, `baseline_results.md`, `postfix_results.md` (the latter two
superseded by `run_eval.py`, so those are just uncommitted deletions).

**Plan**
1. `git add -A Ingestions/ && git rm --cached ingestion*.ipynb` — commit the move.
2. Update the two CLAUDE.md references to `Ingestions/…`.
3. Commit the deletions of the three superseded docs.
4. While there: CLAUDE.md's warning that `ingestion.ipynb`'s `DOCS` list is STALE
   (targets the retired `erg_full` / `rescue_sheet` namespaces) still stands and
   should move into the notebook's own first cell, where someone about to hit
   "Run All" will actually see it.

---

## P1-7 — `run_eval.py` clobbers a same-day full run

Output path is `eval_results/<date>.md` with no regard for what was run. A
`--sample 3` triage today **overwrote** the day's report; a later full
90-question baseline would be silently destroyed by any subsequent sample. The
file records "Questions run: 3", so the damage is at least detectable — but only
after the fact. (Observed live: today's file went from a 3-question sample and
had to be re-run to `--out` to preserve it.)

**Plan** — when the default path exists and the new run covers fewer questions
than the existing report, either refuse or auto-suffix
(`2026-08-29.sample3.md`). Full runs may overwrite.

---

## P2 — Smaller defects

**8. `?hazards=0` permanently disables hazard markers.** `main.ts:308` folds the
URL override into `comfort`, and the first `applyComfort()` call persists it via
`saveComfort()`. Harmless in headless CI (fresh profile), but a person who opens
the render-check URL and then touches any comfort control has hazards off for
good, with nothing in the UI explaining why. *Fix:* keep the override out of the
persisted object — apply it to `hotspots.setEnabled()` only.

**9. `updateVrSurfaces()` assumes 90 Hz.** `main.ts:1120` accumulates a hardcoded
`surfacesAt += 1 / 90` instead of the `dt` the loop already computes. On a
72 Hz or 120 Hz session the panel/diagnostics refresh interval is off by
±33%. *Fix:* pass `dt` in and accumulate that.

**10. Tracking preflight false-alarms on a correctly-permitted frame.**
`tracking.ts:119` warns *"This page is inside a frame, which usually blocks
positional tracking"* even when `featurePolicy.allowsFeature("xr-spatial-tracking")`
has explicitly returned `true`. The file's own docstring says a false alarm here
"would send the next person chasing an iframe that is not there." *Fix:* gate the
framed branch on `allowed !== true`.

**11. Teleport is impossible while ducked.** `teleport.ts:198` tests
`p.y <= 0 && prevY > 0`, so an arc launched from below the floor plane never
registers a hit. Measured through the seam:

```
controller y = +1.20  → valid: true,  lands z = 0.68
controller y = +0.05  → valid: true,  lands z = 1.93
controller y = −0.30  → valid: FALSE, "landing" runs away to y = −29.8
```

−0.30 m is well inside the −1.4 m rise/duck range — i.e. exactly the pose the
height axis exists for. In teleport style (and hand mode, where teleport is the
*only* locomotion) the reticle just turns red with no explanation. *Fix:* clamp
the launch origin to `max(originY, 0.02)`, or detect an origin below the plane
and fall back to a downward ray.

**12. Environment documentation is wrong in three places.** CLAUDE.md's "Env
pre-flight (bit us repeatedly)" says *"`aws` CLI and `jq` are **NOT** installed"* —
`aws` is indeed missing, but **`jq` is at `/usr/bin/jq`**. It also specifies
`/opt/homebrew/bin/python3.11` for the ingestion notebooks: that is a macOS path,
`python3.11` is **not installed at all** here, and the ingestion dependencies
(`unstructured`, `whisper`, `pi_heif`) all live under **python3.10** — the same
interpreter as the deploy scripts. The Quick-start `brew install` line is macOS
too; `ffmpeg`, `tesseract` and `pdftoppm` are already present via apt.

**13. Invalid font MIME types.** Both deploy scripts map `.woff` → `font-woff`
and `.woff2` → `font-woff2`. Correct values are `font/woff` and `font/woff2`.

**14. Hazard markers only exist on the driver's side.** In `hotspots-data.ts`,
`restraints-pillar`, `high-strength-zone`, `lifting-points` and `charge-port` are
all placed at `+Z` (driver side) with `normal: [0,0,1]`. Restraints, high-strength
zones and lifting points exist on **both** sides of a real vehicle. A responder
working the passenger side sees ghosted far-side markers and none on the side
they are standing on. Downstream of the existing `verified: false` caveat, but it
is a coverage gap rather than a placement estimate. *Fix:* mirror the symmetric
four to `−Z` when the positions are confirmed in-headset.

**15. `inspector_portal.html` is not in the repo.** Streamlit still serves it as
the v1 fallback (`?portal=v1`, live and returning 200 with 43,507 bytes), but the
file is absent from disk *and* untracked (`git ls-files` lists only
`chat_panel.html`). The live v1 portal currently has no source of truth. *Fix:*
either recover it from S3 into the repo, or drop the `?portal=v1` branch from
`streamlit_app.py` and retire it deliberately.

**16. The third-party splat viewer looks broken for ~15 s.** Tab 2 renders a red
placeholder cube while it pulls a **43.6 MB** `.ply` from Hugging Face with no
progress indication. It does eventually render (confirmed), and the URL and its
CORS headers are fine — but "verify pixels, not HTTP" applies to the first
fifteen seconds too. Nothing to fix in this repo (zero code here); worth a
one-line `st.caption` telling users the scan takes a moment to load.

**17. `convert_splats.sh` header lies about its output.** Says
`Output: splat-vr/models/*.spz`; actually writes `splat-vr/public/models/`.

**18. Streamlit tab 1 froze the renderer twice** while loading the v2 portal
iframe (CDP `captureScreenshot` timed out at 30 s, recovered on retry). Consistent
with the known Chromium-on-Linux no-hardware-H.264-decode caveat plus the ~2 MB
Havok WASM. Both tabs do render correctly once settled. Not chased further — v2
is IWSDK, out of scope for this pass.

**19. Dead code.** `VrInput.applySettings` (main.ts writes `.settings` and calls
`saveComfort` itself), `Ground.setVisible`, `HandInput.isTracking` / `anyTracking`
/ `dispose`, and `BTN.stick`. `HandInput.dispose()` also calls
`geometry.dispose()` on both meshes, which share **one** `SphereGeometry` —
harmless today only because nothing calls it.

---

## Suggested order

1. **Deploy the splat-vr fix** (P0-1 is fixed but only in source; P0-2 means
   nothing since 08-24 is live). One build, one deploy, one curl.
2. **Fix the transcript routing** (P0-3) — largest user-visible win, and
   `run_eval.py --ids 61-90` measures it directly.
3. **Add post-deploy verification** (P1-4) so 1 and 2 cannot silently regress —
   this is the `/ship` skill, now with a concrete cost to justify it.
4. Commit the notebook move and correct the env docs (P1-6, P2-12) — cheap, and
   they are actively misleading.
5. P1-5, P1-7, then the P2 list as convenient.

## Verified healthy

- `n8n_sync.py --check` — all four production invariants PASS (topK=10 × 14 nodes,
  router `claude-sonnet-4-6`, maxIterations=10, systemMessage sha256 match).
- HLS ABR ladder — all three videos serve **3 renditions** live, as documented.
- `render_check.mjs` — 4/4, every scan within 3.5% of real length.
- `vr_check.mjs` — 52/52 after the fix and the new guard.
- `npx tsc --noEmit` on `splat-vr` — clean, including after the change.
- All 9 Python modules byte-compile; every dependency present under python3.10.
- Chat webhook end-to-end (18 live calls, 0 errors).
- All five live endpoints (CloudFront ×4, GitHub Pages ×1) return 200; the
  Hugging Face `.ply` is reachable with correct CORS on both redirect hops.
- `graphify update .` — rebuilt to 1080 nodes / 1550 edges / 87 communities,
  now covering the previously-unindexed 2026-08-24 modules.
