# Graph Report - RAG_Responder  (2026-08-29)

## Corpus Check
- 66 files · ~219,199 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1114 nodes · 1596 edges · 89 communities (76 shown, 13 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58eb02a1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat & Voice Frontend|Chat & Voice Frontend]]
- [[_COMMUNITY_HUD & Videosphere Rendering|HUD & Videosphere Rendering]]
- [[_COMMUNITY_Portal Build Dependencies|Portal Build Dependencies]]
- [[_COMMUNITY_Deploy & HLS Pipeline|Deploy & HLS Pipeline]]
- [[_COMMUNITY_IWSDK Reference Docs|IWSDK Reference Docs]]
- [[_COMMUNITY_Transcription & Chat Agents|Transcription & Chat Agents]]
- [[_COMMUNITY_EV Response Guides & Concepts|EV Response Guides & Concepts]]
- [[_COMMUNITY_IWSDK Skills & HUD UI|IWSDK Skills & HUD UI]]
- [[_COMMUNITY_Router Fix & Eval Results|Router Fix & Eval Results]]
- [[_COMMUNITY_n8n MCP Node Config|n8n MCP Node Config]]
- [[_COMMUNITY_n8n Workflow Patterns|n8n Workflow Patterns]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_360 Video Transcripts|360 Video Transcripts]]
- [[_COMMUNITY_Project Progress Log|Project Progress Log]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Portal Entry & Vite Config|Portal Entry & Vite Config]]
- [[_COMMUNITY_MCP Server Config|MCP Server Config]]
- [[_COMMUNITY_Cut Loop & HV Disconnect|Cut Loop & HV Disconnect]]
- [[_COMMUNITY_12V & Thermal Runaway|12V & Thermal Runaway]]
- [[_COMMUNITY_Submersion Response|Submersion Response]]
- [[_COMMUNITY_Towing & Recovery|Towing & Recovery]]
- [[_COMMUNITY_HZDB Asset Server|HZDB Asset Server]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 231|Community 231]]
- [[_COMMUNITY_Community 246|Community 246]]

## God Nodes (most connected - your core abstractions)
1. `Project Progress — Ford Mustang Mach-E 2026 First Responder RAG Portal` - 32 edges
2. `VrInput` - 27 edges
3. `HelpPanel` - 24 edges
4. `HudSystem` - 23 edges
5. `Review Checklist` - 21 edges
6. `Hotspots` - 19 edges
7. `ControllerHints` - 16 edges
8. `compilerOptions` - 16 edges
9. `2. Per-Namespace Pinecone Tool Descriptions` - 16 edges
10. `check_invariants()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `chat_panel.startRecognition (Web Speech)` --semantically_similar_to--> `n8n transcribe-audio webhook`  [INFERRED] [semantically similar]
  chat_panel.html → n8n_transcribe_webhook.json
- `volkswagen_id4_2025` --references--> `Fire Suppression / Li-Ion Battery Fire Guidance`  [INFERRED]
  n8n_router_config.md → vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf
- `volkswagen_id4_2025` --references--> `High Voltage Battery Pack`  [INFERRED]
  n8n_router_config.md → vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf
- `volkswagen_id4_2025` --references--> `High Voltage Disconnect / Service Disconnect`  [INFERRED]
  n8n_router_config.md → vehicle_docs/EmergencyResponseGuide-Nissan-Ariya-2026.pdf
- `First Responder GPT Router Agent` --references--> `eval_questions.json (Transcript+PDF QA set)`  [INFERRED]
  n8n_router_config.md → eval_questions.json

## Import Cycles
- None detected.

## Communities (89 total, 13 thin omitted)

### Community 0 - "Chat & Voice Frontend"
Cohesion: 0.15
Nodes (23): addMessage(), addTyping(), askQuickQuestion(), autoGrow(), errorEl, focusInput(), initChatBindings(), inputEl (+15 more)

### Community 1 - "HUD & Videosphere Rendering"
Cohesion: 0.13
Nodes (7): HudSystem, getChatHistory(), setTranscriptListener(), pttStopWasRecent(), fmt(), getActiveVideo(), getCurrentVideoIdx()

### Community 2 - "Portal Build Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, hls.js, @iwsdk/core, marked, three, devDependencies, @iwsdk/cli, @iwsdk/reference (+23 more)

### Community 3 - "Deploy & HLS Pipeline"
Cohesion: 0.10
Nodes (30): build_master(), content_type(), encode_variant(), ffprobe_duration(), ABR HLS ladder (high/mid/low), main(), peak_bandwidth(), process_stem() (+22 more)

### Community 4 - "IWSDK Reference Docs"
Cohesion: 0.12
Nodes (16): 1a. `ui/hud.uikitml`, 1b. `src/hud-mirror.ts`, 1c. `src/hud.ts`, 2a. `ui/hud.uikitml`, 2b. `src/hud.ts`, 3a. `src/chat.ts`, 3b. `ui/hud.uikitml`, 3c. `src/hud.ts` (+8 more)

### Community 5 - "Transcription & Chat Agents"
Cohesion: 0.17
Nodes (12): Audio Playback, Available Types, Component Template, Core Architecture, Critical Import Rule, Key Imports, Physics Setup, Quick Reference (+4 more)

### Community 6 - "EV Response Guides & Concepts"
Cohesion: 0.14
Nodes (37): 12V / Low Voltage Battery, Airbag / pretensioner / stored gas inflator, Airbag / SRS Components (inflators, pretensioners, control unit), Cable cut location / no-cut HV cables, Emergency Shutdown / Power Down Procedure, Fire Suppression / Li-Ion Battery Fire Guidance, First Responder Cut Loop / Cable Cut, High-strength / no-cut structural zone (+29 more)

### Community 7 - "IWSDK Skills & HUD UI"
Cohesion: 0.25
Nodes (8): HUD chat surface (history/transcript/hint), HUD mute button (#hud-mute), Push-to-talk hint (hold right trigger or pinch to speak), HUD play/pause button (#hud-play), HUD playback row (play/mute/video-select/time), In-VR HUD root panel (hud.json), HUD video select buttons (#hud-vid1/2/3), HUD Enter XR button (#xr-button)

### Community 8 - "Router Fix & Eval Results"
Cohesion: 0.18
Nodes (11): DesktopLookSystem (drag-to-look on world.camera), Project Progress Log, eval_questions.json (90 ground-truth QA pairs), Body-Locked Lazy-Follow HUD (IWSDK Follower), inspector_portal.html v1 (A-Frame 360 portal), IWSDK v2 Portal (Meta Immersive Web SDK migration), n8n Workflow S3uHJF57JAuA7bL0, Pinecone Index ford-mache-erg (per-vehicle namespaces) (+3 more)

### Community 9 - "n8n MCP Node Config"
Cohesion: 0.12
Nodes (35): check_invariants(), _description_field(), do_check(), do_push(), doc_key_for(), extract_doc_system_message(), extract_doc_tool_descriptions(), fail_tag() (+27 more)

### Community 10 - "n8n Workflow Patterns"
Cohesion: 0.13
Nodes (15): 2026-06-01 — IWSDK v2 VR Interface Overhaul (Follower HUD, Audio/Haptics, Pinch-to-Talk), 2026-06-08 — Streamlit Cut Over to v2 + Desktop Drag-to-Look for the 360° Videosphere, Changes, Changes, Deploy, Fix — `DesktopLookSystem` (`portal/src/look-controls.ts`, new), Headline fix — body-locked lazy-follow HUD, Other improvements (+7 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+4 more)

### Community 12 - "360 Video Transcripts"
Cohesion: 0.20
Nodes (12): 12-volt jumpstart / wake-up of dead EV, instructor Barry Smith (SE Community College), ERG cut-battery-cables / relay-removal de-energizing procedure, EV emergency response training session (part 1), high-voltage orange cable safety ('if it is orange, do not mess with it'), charging cable disconnect (never cut, DC fast charge >400V, locked plug), battery module conductor plate / coolant heat transfer, Ford Mustang Mach-E walk-around (+4 more)

### Community 13 - "Project Progress Log"
Cohesion: 0.10
Nodes (31): ask_webhook(), build_report(), config_hash(), default_out_path(), existing_question_count(), extract_answer(), keyword_match(), load_cache() (+23 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (12): Open questions to resolve on-device, Phase 0 — Get eyes on the Quest (THE blocker; do this first), Phase 1 — Pinpoint on-device (once Phase 0 works), Phase 2 — Fixes, ranked by likelihood (apply the ones Phase 1 confirms), Phase 3 — Defensive hardening (land now; safe, emulator-verifiable), Phase 4 — Deploy + re-verify on Quest, plan2.md — Fix the in-VR HUD: unresponsive controls + chat not showing on Quest, Quick wins to land this session (if continuing now) (+4 more)

### Community 15 - "Portal Entry & Vite Config"
Cohesion: 0.22
Nodes (10): portal index.html (v2 entry, scene + chat shell), iwsdk-reference MCP server (SDK code search), iwsdk-runtime MCP server (IWER drive/screenshot/ECS), @iwsdk/core dependency (0.4.1), portal package.json (v2 build config), portal tsconfig.json (strict, Bundler resolution), basicSsl plugin (self-signed SSL), compileUIKit plugin (UIKITML -> public/ui) (+2 more)

### Community 16 - "MCP Server Config"
Cohesion: 0.67
Nodes (3): node, iwsdk-reference, iwsdk-runtime

### Community 17 - "Cut Loop & HV Disconnect"
Cohesion: 0.67
Nodes (3): Emergency Plug Data Gap (IONIQ 5 has no such feature in source), First Responder Cut Loop / Cable Cut, High Voltage Disconnect / Service Disconnect

### Community 23 - "Community 23"
Cohesion: 0.40
Nodes (5): 2026-08-10 — The Quest "browser closed on me" Crash: It Was `inputEl.focus()` Opening the VR Overlay Keyboard (Found via `adb logcat`, Not Inference), Also this session, Fix, Root cause, Verified, both directions

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (16): CanvasSurface, fitText(), hitAt(), makeCanvasSurface(), Rect, roundRect(), bindingRows(), Hit (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (24): ControllerHints, HandRig, HintItem, HintSpec, LAYOUT, HandEvent, HandInput, HandSpace (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (21): 3D Views of EVs — Gaussian splat scans (Streamlit tab 2), Deploy, Env pre-flight (bit us repeatedly), Environment, First Responder RAG Portal — EV Emergency Response Guides + 360° Training, graphify, Known open issues, n8n workflow (+13 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (12): Anti-Patterns to Avoid, DON'T add environment components to arbitrary entities, DON'T forget `_needsUpdate` after changing environment properties, DON'T forget to cleanup subscriptions, DON'T pass numbers to ScreenSpace, DON'T poll for state changes, DON'T store entity arrays in systems, DON'T use `entity.destroy()` for objects with GPU resources (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.04
Nodes (43): camera, canvas, carRig, comfort, controllerHintsEl, controls, currentConfig, devEl (+35 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (15): ArchivedRun, archivePreviousRun(), buffer, crumb(), getArchive(), installCrumbsInspector(), persist(), readJson() (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (18): dependencies, @sparkjsdev/spark, three, description, devDependencies, @types/three, typescript, vite (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (17): activatePanorama(), bindVideoControls(), createHiddenVideoEls(), ensureHls(), hlsInstances, hlsReady, hlsRecoveries, hlsSupported (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 34 - "Community 34"
Cohesion: 0.08
Nodes (21): 10. Audio Configuration, 11. Three.js Import Check (CRITICAL), 12. Component Size Check, 15. Direct asset loaders instead of AssetManager, 16. Raw scene.add() instead of createTransformEntity, 17. Manual Raycaster instead of Interactable, 18. Environment components on wrong entity, 19. Missing `_needsUpdate` on environment changes (+13 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (14): PushToTalkSystem, errorEl, initVoiceBindings(), inputEl, isCurrentlyRecording(), isVoiceSupported(), mediaChunks, micBtn (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (4): Blink, INVALID, Teleport, VALID

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (10): Agents Available, Debugging Missing Features, IWSDK Project - Claude Code Configuration, `iwsdk-project-code-reviewer`, Meta Spatial Editor, mse-agent, Planning Rule, Project Structure (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (14): 2. Per-Namespace Pinecone Tool Descriptions, bmw_ix3_2027, cadillac_lyriq_2023, chevrolet_blazer_ev_2024, chevrolet_bolt_ev_2022_2023, chevrolet_equinox_ev_2024, ford_lightning_2026, ford_mach_e_2026 (+6 more)

### Community 39 - "Community 39"
Cohesion: 0.36
Nodes (10): chatHistory, ChatListener, mdToPlain(), mirrorToHud(), pushMerged(), setChatListener(), setHudPending(), setHudTranscript() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.36
Nodes (9): ndarray, analyze(), is_y_down(), load_positions(), main(), Path, Cross-section area shrinks toward the roof; rising area means Y-down., Decode splat centres from an SPZ file (24-bit fixed point, gzipped). (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (10): Claude Opus 4.8 Router Model (lmChatAnthropic), OpenAI text-embedding-3-small Embeddings (1536-dim), Per-Vehicle Pinecone Retrieval Tools (vectorStorePinecone), Router Agent (First Responder GPT), topK = 10 Retrieval Depth Fix, video_transcript Tool (Mach-E 360 training narration), Router Upgrade (topK 4 to 10, Opus 4.8, de-contradicted prompt), Professor's Accuracy Report (identical/hedged answers) (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.31
Nodes (5): css(), Ground, makeGroundTexture(), mulberry32(), _srgb

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (9): EV First-Responder Q&A Comparison (webhook vs graphify), Generic Deferral Policy (no model-specific answer without make/model/year), graphify Knowledge Graph (graph.json BFS traversal), n8n RAG Chat Webhook (live chat workflow), Vehicle-Naming Determines Grounded vs Deferred Answer, Never Mix Data Across Vehicles, STEP 1 Identify-the-Vehicle Routing Rule, Router Agent System Message (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (11): el(), fitToGround(), loadModel(), onHotspotSlide(), refreshSliderLabels(), reportError(), setStatus(), syncHotspotPane() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (10): cache_control_for(), content_type_for(), invalidate_cloudfront(), local_bundles(), main(), Deploy the standalone WebXR splat viewer (splat-vr/dist/) to S3 + invalidate Clo, The hashed JS bundles the freshly-built local index.html references., Re-fetch the live page and assert the edge serves this build.      index.html is (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (7): `/iwsdk-debug`, `/iwsdk-grab`, `/iwsdk-physics`, `/iwsdk-planner`, `/iwsdk-ray`, `/iwsdk-ui`, Skills Available

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (7): 1. The GridHelper had to go (`splat-vr/src/ground.ts`, new), 2026-08-19 — splat-vr on the Quest 3: ground blending, comfort locomotion, in-VR controls panel, 2. Comfort locomotion (`splat-vr/src/vr-input.ts`, new), 3. In-VR controls panel (`splat-vr/src/help-panel.ts`, new), Harness rot caught (`scripts/render_check.mjs`), Still to confirm on device, Verified

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): { chromium }, outDir, require, res, shots, TARGET

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (6): 2026-08-18 — 3D-EVs Tab Fix (dead viewer host) + Standalone WebXR Splat Viewer, Gotchas worth remembering, New: `splat-vr/` — WebXR walkaround of the car scans, NOT verified — first job next session, Root cause: the 3D-EVs tab was iframing a 404, Verified

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (3): 1. Router Agent — System Message, n8n Router Agent — Multi-Vehicle Config, n8n Router Agent Multi-Vehicle Config

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (4): Browser 3D With First-Class XR, Critical Best Practices, Feature Configuration (CRITICAL!), VR Performance Context

### Community 52 - "Community 52"
Cohesion: 0.50
Nodes (4): IWER (Immersive Web Emulation Runtime), IWSDK Reference (Code Intelligence), MCP Tools Available, Quest device access — plain `adb`, NOT hzdb/metavr (2026-08-10)

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (9): applyComfort(), hazardsVisible(), pressAt(), pressHotspot(), pressPanel(), pulseFor(), recentre(), syncComfortInputs() (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (3): findModel(), ModelConfig, MODELS

### Community 56 - "Community 56"
Cohesion: 1.00
Nodes (3): Baseline (before-fix) Chatbot Responses, Named-Supported-Vehicle Wrongly Treated as Unidentified, Router Non-Determinism (same question, opposite outcome)

### Community 59 - "Community 59"
Cohesion: 0.15
Nodes (15): chat_panel.html (First Responder GPT), chat_panel.sendMessage, chat_panel.startRecognition (Web Speech), eval_questions.json (Transcript+PDF QA set), n8n chat webhook (a7782f7b), First Responder GPT Router Agent, n8n transcribe-audio webhook, main() (+7 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (5): { chromium }, consoleErrors, EXPECTED_ACTIONS, require, results

### Community 62 - "Community 62"
Cohesion: 0.12
Nodes (16): 2026-04-16 — Initial Commit, 2026-05-04 — Chatbox Added to Gaussian Splatting Tab, 2026-06-24 — Router Model Finalized: Claude Sonnet 4.6 (Audit-Log Closeout), 2026-06-29 — n8n Router Minimal Hardening (maxIterations + prompt de-dup), 2026-06-29 — Router Prompt De-Contradiction (Single/Multi-Tool Wording) + Full System-Message Doc Sync, 2026-07-05 — Workflow Tooling: Graphify Prune, Skill-Tree Consolidation, `n8n_sync.py` + `run_eval.py`, 2026-07-06 — v2 Portal: Deploy the Dead-CSS Cleanup That Never Shipped + Graphify Refresh + Router Doc Fix, 2026-07-20 — v2 HUD Overhaul: Scrollable Chat Bubbles, Seek Controls, Quick-Ask Chips, Thumbstick Scroll (+8 more)

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (4): IWER dev runtime launch config (port 8081, dev:runtime), IWER Quest emulator runtime, IWER emulator session state (agent mode, browser disconnected), portal .claude settings (IWSDK MCP tool allowlist)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (12): bugs.md — full-module sweep, 2026-08-29, P0-1 — The in-VR controls panel renders as nothing (FIXED), P0-2 — The live splat-vr deployment is five days behind the source, P0-3 — RAG: the transcript corpus is mis-scoped to the Mach-E, P1-4 — Deploy scripts declare victory without checking, P1-5 — `analyze_splats.py` tells you to paste values that regress scale, P1-6 — The documented ingestion path points at files that are gone, P1-7 — `run_eval.py` clobbers a same-day full run (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (13): C, ACCENT, DRIVER_SIDE, HOTSPOTS, hotspotsFor(), MIRROR_NOTES, mirrorToPassengerSide(), Severity (+5 more)

### Community 69 - "Community 69"
Cohesion: 0.25
Nodes (8): Charging & Infrastructure Issues, EV First-Responder Q&A — n8n RAG Webhook vs. graphify Knowledge Graph, Q1. How can I quickly identify if a vehicle is an EV or hybrid when arriving at a crash scene?, Q20. What are the common safety issues or fire risks associated with residential or commercial EV chargers?, Q21. If an EV is currently plugged into a DC fast charger at a station, is it safe to cut the charging cable during an emergency?, Q2. If a vehicle is on its side and I cannot see the exterior badges, what other visual clues or dash indicators can I look for?, Q3. What does a green 'Ready' light or symbol on the dash indicate about the vehicle's operational status?, Scene Arrival & Vehicle Identification

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (8): Designated cut points (where cutting is easiest / appropriate), No-cut / avoid zones (reinforced structure and hazard components), R1. On a Hyundai IONIQ 5 2025, where is the high-voltage disconnect and how do I isolate it?, R2. For a Rivian R1T 2025 that's come to rest on its roof, where are the safe lifting and stabilization points?, R3. On a Volkswagen ID.4 2025, where are the designated cut points and which structural areas are no-cut zones?, R4. For a Chevrolet Blazer EV 2024, where are the airbag inflators and seatbelt pretensioners I need to stay clear of during extrication?, R5. Walk me through the step-by-step high-voltage shutdown procedure for a Nissan Ariya 2026., Vehicle-Specific Replacement Questions

### Community 71 - "Community 71"
Cohesion: 0.18
Nodes (10): Alternate Procedures, Final router model: Claude Sonnet 4.6 (2026-06-24), Nissan Ariya 2026 — High-Voltage System Shutdown, Opus 4.6 Verification Appendix (2026-06-24), Primary Procedure (recommended), Q17 — Volkswagen ID.4 2025 ERG · ✅ confirmed, Q3 — Chevrolet Blazer EV 2024 ERG · ⚠️ term real, color claim unsupported, R5 — Nissan Ariya 2026 ERG · ✅ confirmed (+2 more)

### Community 72 - "Community 72"
Cohesion: 0.29
Nodes (7): Immobilization & De-energization, Q10. If I am using an Emergency Plug and the light flashes green, what does that mean? What if it turns solid blue or red?, Q5. Can you give me the simplest, step-by-step method to immobilize an EV and disable the high-voltage system for a newly arriving responder?, Q6. Why is it so important to disconnect the 12-volt battery to disable the high-voltage system, and where is it typically located?, Q7. What are 'cut loops', where are they typically located (like the C-pillar), and how do I use them to disable the vehicle?, Q8. How does an 'Emergency Plug' work to trick the vehicle's charging communication and disable the high voltage?, Q9. Is it safe to cut the orange high-voltage cables during an extrication?

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (5): Citation-drift spot-check, Headline: no regression, Opus 4.6 router re-test (2026-06-22), Parity summary, Watch-items (3)

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (5): Fire Suppression & Hazard Management, Q12. What is the recommended strategy for an EV battery fire: letting it burn out defensively or actively trying to suppress it?, Q13. How many gallons of water are typically needed to cool and extinguish a burning EV battery?, Q14. How do we effectively get water or an extinguishing agent directly onto the battery cells if they are protected by a strong metal container?, Q15. Why are fire blankets potentially problematic or less effective for lithium-ion battery fires?

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (5): Original run (no vehicle named), Out-of-scope refusals — removed and replaced, Per-question detail (original run), Retest run (same questions, vehicle named) — the headline result, Scorecard

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (4): 2026-05-04 — HLS Fix + Whisper Voice Input + chat_panel.html, chat_panel.html + Gaussian tab refactor (`streamlit_app.py`), HLS fix (`inspector_portal.html`), Whisper voice input button (`inspector_portal.html`)

### Community 77 - "Community 77"
Cohesion: 0.67
Nodes (3): cardHitUV(), panelHitUV(), probeSurface()

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): 2026-04-20 — Enriched Metadata + Evaluation Framework, Evaluation Framework, Metadata Enrichment (video_transcript_v2 namespace), n8n Agent System Message

### Community 87 - "Community 87"
Cohesion: 0.13
Nodes (15): 1. Laminated glass — the window is now a cutting job, 2. Carbon fiber / high-strength structure — cut zones and PPE, 3. General cutting rules that still apply, ⚠️ Critical safety warnings first, Extrication & Post-Crash Handling, Hazards of cutting these components, Q16. How does the increasing use of laminate glass and carbon fiber in modern EVs affect extrication and saw-cutting safety?, Q17. What are the hazards of cutting into gas-charged struts or seat pretensioners? (+7 more)

### Community 91 - "Community 91"
Cohesion: 0.22
Nodes (9): 2026-05-24 — IWSDK v2 Portal (Meta Immersive Web SDK Migration), Changes, Not yet verified, Pain points hit during build, Rollout model, Scope split — what migrated vs what stayed, Verified locally, What was built (+1 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (20): 2026-05-25 — IWSDK v2 Verify Pass + HUD Comfort Bump + Voice STT Fallback + First v2 Deploy, 2026-06-01 — IWSDK v2 Live IWER Emulator Pass + Quest STT Correction + Transcribe Webhook, 2026-06-01 — Transcribe Webhook Activated + v2 Overhaul DEPLOYED (the stale-bundle fix), Caught: the v2 VR overhaul had never been deployed (root cause of "no changes in VR"), Changes, Changes, CORS fix note, Deploy (+12 more)

### Community 107 - "Community 107"
Cohesion: 0.25
Nodes (8): 2026-06-18 — Ingestion/n8n Audit: Real Bug Was 3 Missing Tool Nodes (Not Re-Ingestion) + `Ford Mache-E` → `vehicle_docs`, Audit findings — the "Mach-E only" theory is FALSE, BLOCKED — live chat verification (expired OpenAI key, NOT our change), Changes, Context — the professor's report, Repo cleanup — `Ford Mache-E/` → `vehicle_docs/`, The fix (n8n side — applied + verified structurally), The real bug — 3 missing n8n tool nodes

### Community 108 - "Community 108"
Cohesion: 0.25
Nodes (8): 2026-06-22 — Router Re-Diagnosis: Real Bug Was Retrieval Depth + Prompt Contradiction + Weak Model (Supersedes the 06-18 "3 Missing Tools" Theory) + Eval Set 60→90 + Skill Cleanup, Changes, Context — the professor's report, take two, Eval set expanded 60 → 90 (live-class questions), Repo / skill cleanup, The fix (applied via the n8n public API — GET → mutate → PUT), The real root causes (all in the live workflow, none in the repo data), What the re-audit ruled OUT (the assumed causes were wrong)

### Community 166 - "Community 166"
Cohesion: 0.33
Nodes (6): 2026-05-18 — Code Cleanup, Native Voice Input, Streamlit Polish, Linux/Chrome Video Triage, 360° video black-screen on Linux/Chrome (triage + quick fix), Code cleanup (`/simplify` pass), Deploy pipeline note, Tab renames + Streamlit polish (`streamlit_app.py`), Voice input — Whisper → browser-native Web Speech API

### Community 198 - "Community 198"
Cohesion: 0.11
Nodes (21): 2026-05-04 — CloudFront Migration + Streamlit CORS Fix, 2026-05-04 — Meta Quest 3 VR Support (A-Frame Migration), 2026-05-24 — In-VR HUD + Right-Trigger Voice Chat (Meta Quest 3), 2026-06-29 — v2 Portal Copy Cleanup + Streamlit VR Caption Reword (Deployed), Changes, Changes, Changes, Changes (+13 more)

### Community 231 - "Community 231"
Cohesion: 0.50
Nodes (4): 2026-05-03 — CloudFront HLS Video Integration + Portal Cleanup, `inspector_portal.html` changes, `streamlit_app.py` changes, Video Hosting — Local → CloudFront HLS

### Community 246 - "Community 246"
Cohesion: 0.50
Nodes (3): Develop / build, First Responder Portal — v2 (IWSDK), Layout (flat — one module per concern, no starter-template scaffold)

## Knowledge Gaps
- **503 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+498 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Hotspots` connect `Community 64` to `Community 67`, `Community 29`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Tracking` connect `Community 66` to `Community 29`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `VrInput` connect `Community 28` to `Community 25`, `Community 29`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `Encode one rendition into out_dir/index.m3u8 + seg*.ts. Idempotent.`, `Peak BANDWIDTH (bits/s) = max(segment_bytes * 8 / segment_duration).`, `Upload every file in var_dir -> videos/<stem>/<tier>/<name>.` to the rest of the system?**
  _540 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat & Voice Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Should `HUD & Videosphere Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.13438735177865613 - nodes in this community are weakly interconnected._
- **Should `Portal Build Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._