# plan2.md — Fix the in-VR HUD: unresponsive controls + chat not showing on Quest

**Date:** 2026-07-20 · **Branch:** `meta-webvr` · **Scope:** v2 IWSDK portal (`portal/`)

## TL;DR — can I really build a "Claude-bubble" chat in VR?

**Yes — and it already exists.** `hud.ts::makeBubble()` renders exactly that:
right-aligned blue "You" bubbles, left-aligned grey "First Responder GPT" bubbles,
in a scrollable list (`#hud-chat-scroll`), auto-scrolling to the newest message,
with a "Thinking..." status line and an answer chime. **This whole path was
verified working in the IWER emulator** (see `progress.md` 2026-07-20: a chip
ray-click produced a correctly-labelled user bubble, stacked bubbles auto-scrolled,
thumbstick scrolling worked, no tofu glyphs). So the design is sound and the code
is real. The problem is **not** "can it be built" — it's that it misbehaves **on
the actual Quest**, in a layer the emulator can't exercise.

---

## What is CONFIRMED (verified this session, don't re-litigate)

1. **Quest is running current code.** Live `/v2/` bundle `index-D3dSLtxF.js` and
   live `ui/hud.json` (has `hud-back10/fwd10/chat-scroll/chip1/progress-fill/
   transcript`) both match the local `dist/` built today 08:25. The stale-build
   theory is **ruled out**.
2. **Chat backend is healthy.** `POST` to the chat webhook now returns `200`,
   2229 bytes, `{"output":"**Tesla Model S 2021**…"}` in ~21 s. The empty-200 that
   `progress.md` logged this morning was **transient** and has cleared. (21 s is
   slow but under the 30 s client abort.) → **The bot answer is no longer blocked.**
3. **DOM chat elements all present** in `index.html` (`chat-messages`, `chat-input`,
   `send-btn`, `mic-btn`, `error-banner`, `btn-play`, …). So `chat.ts`/`voice.ts`
   do **not** throw on module load, and `addMessage()` → `mirrorToHud()` **does**
   run on desktop (matches the user: "the normal web chat interface had it").
4. **Render + click path works in the emulator.** Only the *bot-role* bubble was
   never observed (was blocked on the then-broken webhook — now unblocked).
5. **The emulator cannot reproduce the failure.** Video is CORS-blocked
   (`cloudfront…/index.m3u8` — expected, see memory), the current IWER tab has a
   lost WebGL context, and hand-tracking pinch + mic aren't emulated. So the bug
   lives in **Quest-only territory: real controller/hand rays, mic, and
   `layers:true` WebXR compositing.**

## The two reported symptoms (Quest only)

- **A — Controls unresponsive:** can't click Play/Mute/seek (`< 10s`/`10s >`),
  can't switch lectures. ("can't drag or move forward the video".)
- **B — Chat invisible in VR:** voice records + transcribes (so `select`/pinch and
  the mic path fire), the question reaches n8n and the desktop DOM chat, **but the
  VR HUD never shows the user bubble, the "Thinking…" status, or the answer.**

**Working hypothesis (single root cause fits both A and B):** `HudSystem.wireHud()`
either never runs on the device, or the panel it wires is not the panel being
displayed. `wireHud()` is the one place that (a) attaches every button
`click` listener AND (b) calls `setChatListener()` / `setTranscriptListener()`.
If it doesn't complete: buttons are dead (A) **and** `mirrorToHud()`'s
`chatListener` stays `null` so no bubble/status ever renders (B) — even though the
desktop DOM chat still updates. One failure, both symptoms. This is the first
thing to confirm on-device. (Alternative: `wireHud` runs but the panel is a
promoted **WebXR quad layer** under `layers:true` that isn't receiving ray hits /
live texture repaints on this runtime — see Phase 2 H2/H4.)

---

## Phase 0 — Get eyes on the Quest (THE blocker; do this first)

Nothing below is diagnosable blind. Pick the fastest observability path:

- [ ] **Option A (preferred — full MCP tooling): point the Quest at the LAN dev
      server.** Dev server already binds `0.0.0.0:8081`; this machine is
      `192.168.1.32`. On the Quest Browser open **`https://192.168.1.32:8081/`**,
      accept the self-signed cert ("Proceed to site"), enter VR. Then from a
      Claude session launched in `portal/`, the existing tools drive the **real
      headset**: `mcp__iwsdk-runtime__browser_get_console_logs`,
      `browser_screenshot`, `ecs_find_entities`, `ecs_query_entity`,
      `scene_get_hierarchy`. This is the highest-leverage step — it turns the
      Quest into the same debuggable target as the emulator, *with* real input.
      (Note: LAN origin ≠ CloudFront, so the 360 video will still CORS-fail — fine,
      we're debugging the HUD, not the video.)
- [ ] **Option B (fallback): `chrome://inspect` over USB/ADB.** `hzdb` exposes
      `device_list` + `get_device_logcat`; or use desktop Chrome
      `chrome://inspect` → remote-target the Quest Browser tab for a real DevTools
      console on the deployed `…/v2/index.html`.
- [ ] **Option C (last resort, zero-infra): on-HUD debug line.** Temporarily bind
      a `#hud-transcript`-style text element to a ring buffer of the last few log
      lines (`setHudTranscript`) so the headset itself shows whether `wireHud`
      ran, whether `chatListener` fired, and any caught error. Rip out after.

**Exit criteria for Phase 0:** we can read the Quest's console and ECS state while
wearing/emulating the headset.

## Phase 1 — Pinpoint on-device (once Phase 0 works)

- [ ] **Console scan** for uncaught errors during boot + first interaction (call
      `browser_get_console_logs` with `count` only, **no** level filter).
- [ ] **Did `wireHud` run?** Add a one-line `console.log("[hud] wired", !!doc)` at
      the end of `wireHud()` (temporary) OR inspect ECS: `ecs_find_entities`
      `withComponents:["PanelUI","PanelDocument"]` → confirm exactly **one** panel
      entity qualifies and it's the visible one. Confirm `HudSystem` is running via
      `ecs_list_systems` (priority, entity count, not paused).
- [ ] **Is the ray hovering the buttons?** Point the controller/hand ray at Play,
      then `ecs_find_entities withComponents:["Hovered"]`. **If nothing is Hovered,
      that is symptom A's root cause** (ray not hitting the panel colliders) — and
      it also means push-to-talk's `hoveringUI` guard is always false, so pinches
      near buttons start a recording instead of clicking (matches "records but
      button does nothing").
- [ ] **Controller vs hands:** test both `xr_set_input_mode` `controller` and
      `hand`. The user is likely pinching (hand-tracking is enabled); confirm
      whether clicks work with a controller ray but not with hands, or neither.
- [ ] **Is the bubble in the tree but invisible?** After sending a question,
      `scene_get_hierarchy` under the panel → is a new bubble mesh present? Separates
      "not rendered" (listener/wire problem, B via A) from "rendered but off-screen/
      not repainting" (layers problem).

## Phase 2 — Fixes, ranked by likelihood (apply the ones Phase 1 confirms)

- [ ] **H1 — `wireHud` never fires (most likely; explains A **and** B).**
      `init()` only does `queries.hudPanel.subscribe("qualify", …)`. elics
      `'qualify'` fires on *future* transitions, not for already-matching entities.
      The panel adds `PanelDocument` async after the `hud.json` fetch, so normally
      it qualifies *after* subscribe — but this is timing-dependent and the exact
      order can differ on device/CloudFront caching. **Fix (safe, do regardless):**
      after subscribing, also wire any panel that *already* qualifies:
      ```ts
      this.queries.hudPanel.subscribe("qualify", (e) => this.adopt(e));
      for (const e of this.queries.hudPanel.entities) this.adopt(e); // catch-up
      ```
      where `adopt(e)` sets `this.hudDoc` and calls `wireHud()` (guard against
      double-wire). 3 lines of insurance; removes the whole class of race.
- [ ] **H2 — Ray never hovers the panel (explains A; explains B only via H1).**
      Panel entity has `Interactable` only. If Phase 1 shows no `Hovered` on
      device, the panel needs proper ray-interaction geometry. Probe with
      `iwsdk-reference` (`search_code "PanelUI ray interaction Interactable
      RayInteractable"`, `find_usage_examples`) to confirm whether a
      `RayInteractable`/pointer-events opt-in is required on real hardware that the
      emulator didn't need. Add whatever the reference prescribes.
- [ ] **H3 — Push-to-talk swallows button clicks.** `push-to-talk.ts` fires on
      `getSelectStart()`, which on Quest **is** the hand pinch / controller trigger
      — the same gesture that clicks a UIKit button. The `hoveringUI` guard
      (`queries.hovered.size > 0`) is only correct if H2 is healthy. If hover is
      flaky, every button pinch starts a recording instead. **Fix options:** (a)
      make the guard robust (also skip PTT for a short grace window after any
      pointerdown on the panel); (b) require an explicit no-hover for ≥1 frame
      before starting capture; (c) confirm `pttStopWasRecent()`'s 150 ms window
      isn't eating legitimate clicks.
- [ ] **H4 — `layers:true` compositing (explains B: renders but doesn't repaint).**
      `World.create({ xr.features.layers: true })` can promote the panel to a
      WebXR quad layer on device but not in the emulator. If Phase 1 shows the
      bubble mesh exists in the tree but isn't visible/updating, **test with
      `layers:false`** (one-line experiment) and re-check on Quest. If that fixes
      it, either keep layers off for the HUD or force a texture/material update
      after `renderChatBubbles()`.
- [ ] **H5 — HUD hidden by visibility timing.** `index.ts` sets
      `hudEntity.object3D!.visible = false`; `HudSystem` flips it on
      `visibilityState !== NonImmersive`. The user sees the HUD (screenshot), so
      this is low-priority — but confirm the visibility subscription's `for…of`
      over `queries.hudPanel.entities` actually matched (it won't if H1 is true and
      the panel qualifies late).

## Phase 3 — Defensive hardening (land now; safe, emulator-verifiable)

- [ ] Apply **H1 catch-up wiring** immediately — it's pure upside.
- [ ] Guard `wireHud()` against running twice (idempotent), since Phase-0/1 probes
      may re-trigger qualify.
- [ ] Add a lightweight `console.log`/`console.error` breadcrumb at: end of
      `wireHud`, first `chatListener` call, and the `chat.ts` catch block — so the
      **next** on-device session reads state instead of guessing. (Keep them; they
      cost nothing and this bug proves we're flying blind on hardware.)
- [ ] Re-run the emulator smoke test after edits: chip click → user + bot bubble
      (bot now works, webhook healthy), hover, thumbstick scroll, no regressions.
      `npx tsc --noEmit` must be clean first (CLAUDE.md rule).

## Phase 4 — Deploy + re-verify on Quest

- [ ] `npx tsc --noEmit` → `npm run build` → `python3.10 deploy_portal_v2.py`
      **from the repo root** → invalidate `/v2/*`.
- [ ] Confirm the new hashed bundle name is actually served (this is the recurring
      "I don't see my changes" trap — the parked `/ship` skill exists for exactly
      this; consider building it as part of this work).
- [ ] Re-test on the real Quest via **`…/v2/index.html` direct URL** (NOT the
      Streamlit iframe — it withholds `xr-spatial-tracking`): buttons, seek, lecture
      switch, voice → user bubble → answer bubble + chime, thumbstick scroll.

---

## Quick wins to land this session (if continuing now)

1. **H1 catch-up wiring + idempotent `wireHud`** — 3-line safe fix, plausibly the
   whole bug, verifiable in the emulator.
2. **Boot/wire/error breadcrumbs** — makes the next device session 10× faster.
3. **`layers:false` experiment toggle** — one line, ready to A/B on the Quest.

## Open questions to resolve on-device

- Controller ray vs hand pinch — does one work and the other not?
- With the webhook healthy, does the **bot** bubble now render in the emulator
  (the one path never yet observed)?
- Is the panel a promoted WebXR layer on this Quest runtime (`layers:true`)?

## Reference pointers

- HUD wiring & bubbles: `portal/src/hud.ts` (`init`, `wireHud`, `renderChatBubbles`,
  `makeBubble`, `update`)
- DOM↔HUD bridge: `portal/src/hud-mirror.ts` (`setChatListener`, `mirrorToHud`,
  channel merge, `toAscii`)
- Chat client: `portal/src/chat.ts` (`sendMessage`, `addMessage`, `askQuickQuestion`)
- Voice → chat: `portal/src/voice.ts` (`onend`/`onstop` → `sendMessage`)
- Push-to-talk & the click-suppression guard: `portal/src/push-to-talk.ts`
- Entry / feature flags / follower / `Interactable`: `portal/src/index.ts`
- UI markup: `portal/ui/hud.uikitml` → compiled `portal/public/ui/hud.json`
- Prior context: `progress.md` (2026-07-20 entry), `portal/CLAUDE.md`
