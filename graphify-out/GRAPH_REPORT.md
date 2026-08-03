# Graph Report - RAG_Responder  (2026-08-03)

## Corpus Check
- 42 files · ~164,874 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 695 nodes · 951 edges · 48 communities (43 shown, 5 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `336d04e3`
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 231|Community 231]]
- [[_COMMUNITY_Community 232|Community 232]]
- [[_COMMUNITY_Community 246|Community 246]]

## God Nodes (most connected - your core abstractions)
1. `Project Progress — Ford Mustang Mach-E 2026 First Responder RAG Portal` - 28 edges
2. `Review Checklist` - 21 edges
3. `HudSystem` - 20 edges
4. `2. Per-Namespace Pinecone Tool Descriptions` - 16 edges
5. `Extrication & Post-Crash Handling` - 15 edges
6. `High Voltage Battery Pack` - 14 edges
7. `First Responder RAG Portal — EV Emergency Response Guides + 360° Training` - 13 edges
8. `Anti-Patterns to Avoid` - 13 edges
9. `2026-06-08 — Streamlit Cut Over to v2 + Desktop Drag-to-Look for the 360° Videosphere` - 13 edges
10. `check_invariants()` - 12 edges

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

## Communities (48 total, 5 thin omitted)

### Community 0 - "Chat & Voice Frontend"
Cohesion: 0.08
Nodes (46): addMessage(), addTyping(), askQuickQuestion(), autoGrow(), errorEl, initChatBindings(), inputEl, messagesEl (+38 more)

### Community 1 - "HUD & Videosphere Rendering"
Cohesion: 0.09
Nodes (25): HudSystem, getChatHistory(), setTranscriptListener(), index.ts World.create entry, pttStopWasRecent(), activatePanorama(), bindVideoControls(), createHiddenVideoEls() (+17 more)

### Community 2 - "Portal Build Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, hls.js, @iwsdk/core, marked, three, devDependencies, @iwsdk/cli, @iwsdk/reference (+23 more)

### Community 3 - "Deploy & HLS Pipeline"
Cohesion: 0.13
Nodes (23): chat_panel.html (First Responder GPT), chat_panel.sendMessage, chat_panel.startRecognition (Web Speech), Airbag / pretensioner / stored gas inflator, Cable cut location / no-cut HV cables, High-strength / no-cut structural zone, 400V Li-ion HV battery pack, eval_questions.json (Transcript+PDF QA set) (+15 more)

### Community 4 - "IWSDK Reference Docs"
Cohesion: 0.12
Nodes (16): 1a. `ui/hud.uikitml`, 1b. `src/hud-mirror.ts`, 1c. `src/hud.ts`, 2a. `ui/hud.uikitml`, 2b. `src/hud.ts`, 3a. `src/chat.ts`, 3b. `ui/hud.uikitml`, 3c. `src/hud.ts` (+8 more)

### Community 5 - "Transcription & Chat Agents"
Cohesion: 0.17
Nodes (12): Audio Playback, Available Types, Component Template, Core Architecture, Critical Import Rule, Key Imports, Physics Setup, Quick Reference (+4 more)

### Community 6 - "EV Response Guides & Concepts"
Cohesion: 0.18
Nodes (29): 12V / Low Voltage Battery, Airbag / SRS Components (inflators, pretensioners, control unit), Emergency Shutdown / Power Down Procedure, Fire Suppression / Li-Ion Battery Fire Guidance, First Responder Cut Loop / Cable Cut, High Voltage Battery Pack, High Voltage Disconnect / Service Disconnect, Immobilization / Stabilization / Lifting Points (+21 more)

### Community 7 - "IWSDK Skills & HUD UI"
Cohesion: 0.25
Nodes (8): HUD chat surface (history/transcript/hint), HUD mute button (#hud-mute), Push-to-talk hint (hold right trigger or pinch to speak), HUD play/pause button (#hud-play), HUD playback row (play/mute/video-select/time), In-VR HUD root panel (hud.json), HUD video select buttons (#hud-vid1/2/3), HUD Enter XR button (#xr-button)

### Community 8 - "Router Fix & Eval Results"
Cohesion: 0.07
Nodes (33): Baseline (before-fix) Chatbot Responses, Named-Supported-Vehicle Wrongly Treated as Unidentified, Router Non-Determinism (same question, opposite outcome), EV First-Responder Q&A Comparison (webhook vs graphify), Generic Deferral Policy (no model-specific answer without make/model/year), graphify Knowledge Graph (graph.json BFS traversal), n8n RAG Chat Webhook (live chat workflow), Vehicle-Naming Determines Grounded vs Deferred Answer (+25 more)

### Community 9 - "n8n MCP Node Config"
Cohesion: 0.13
Nodes (30): check_invariants(), do_check(), do_push(), extract_doc_system_message(), extract_doc_tool_descriptions(), fail_tag(), find_agent_node(), find_anthropic_node() (+22 more)

### Community 10 - "n8n Workflow Patterns"
Cohesion: 0.22
Nodes (9): 2026-06-08 — Streamlit Cut Over to v2 + Desktop Drag-to-Look for the 360° Videosphere, Changes, Deploy, Fix — `DesktopLookSystem` (`portal/src/look-controls.ts`, new), Polish — inline 🚒 favicon (`portal/index.html`), Reported symptom → real root cause, Still pending, Streamlit now defaults to v2 (IWSDK), VR-module placeholder removed (+1 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+4 more)

### Community 12 - "360 Video Transcripts"
Cohesion: 0.20
Nodes (12): 12-volt jumpstart / wake-up of dead EV, instructor Barry Smith (SE Community College), ERG cut-battery-cables / relay-removal de-energizing procedure, EV emergency response training session (part 1), high-voltage orange cable safety ('if it is orange, do not mess with it'), charging cable disconnect (never cut, DC fast charge >400V, locked plug), battery module conductor plate / coolant heat transfer, Ford Mustang Mach-E walk-around (+4 more)

### Community 13 - "Project Progress Log"
Cohesion: 0.12
Nodes (26): ask_webhook(), build_report(), config_hash(), extract_answer(), keyword_match(), load_cache(), load_questions(), main() (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (12): Open questions to resolve on-device, Phase 0 — Get eyes on the Quest (THE blocker; do this first), Phase 1 — Pinpoint on-device (once Phase 0 works), Phase 2 — Fixes, ranked by likelihood (apply the ones Phase 1 confirms), Phase 3 — Defensive hardening (land now; safe, emulator-verifiable), Phase 4 — Deploy + re-verify on Quest, plan2.md — Fix the in-VR HUD: unresponsive controls + chat not showing on Quest, Quick wins to land this session (if continuing now) (+4 more)

### Community 15 - "Portal Entry & Vite Config"
Cohesion: 0.22
Nodes (10): portal index.html (v2 entry, scene + chat shell), iwsdk-reference MCP server (SDK code search), iwsdk-runtime MCP server (IWER drive/screenshot/ECS), @iwsdk/core dependency (0.4.1), portal package.json (v2 build config), portal tsconfig.json (strict, Bundler resolution), basicSsl plugin (self-signed SSL), compileUIKit plugin (UIKITML -> public/ui) (+2 more)

### Community 16 - "MCP Server Config"
Cohesion: 0.33
Nodes (6): node, npx, @meta-quest/hzdb, hzdb, iwsdk-reference, iwsdk-runtime

### Community 17 - "Cut Loop & HV Disconnect"
Cohesion: 0.67
Nodes (3): Emergency Plug Data Gap (IONIQ 5 has no such feature in source), First Responder Cut Loop / Cable Cut, High Voltage Disconnect / Service Disconnect

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (10): Agents Available, Debugging Missing Features, IWSDK Project - Claude Code Configuration, `iwsdk-project-code-reviewer`, Meta Spatial Editor, mse-agent, Planning Rule, Project Structure (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (7): `/iwsdk-debug`, `/iwsdk-grab`, `/iwsdk-physics`, `/iwsdk-planner`, `/iwsdk-ray`, `/iwsdk-ui`, Skills Available

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (26): build_master(), content_type(), encode_variant(), ffprobe_duration(), ABR HLS ladder (high/mid/low), main(), peak_bandwidth(), process_stem() (+18 more)

### Community 26 - "Community 26"
Cohesion: 0.10
Nodes (19): Deploy, Env pre-flight (bit us repeatedly), Environment, First Responder RAG Portal — EV Emergency Response Guides + 360° Training, graphify, Known open issues, n8n workflow, NEXT STEPS (parked — build next session, do not auto-start) (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (12): Anti-Patterns to Avoid, DON'T add environment components to arbitrary entities, DON'T forget `_needsUpdate` after changing environment properties, DON'T forget to cleanup subscriptions, DON'T pass numbers to ScreenSpace, DON'T poll for state changes, DON'T store entity arrays in systems, DON'T use `entity.destroy()` for objects with GPU resources (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (6): 2026-06-01 — IWSDK v2 VR Interface Overhaul (Follower HUD, Audio/Haptics, Pinch-to-Talk), Changes, Headline fix — body-locked lazy-follow HUD, Other improvements, Still pending, Verified

### Community 29 - "Community 29"
Cohesion: 0.50
Nodes (4): Browser 3D With First-Class XR, Critical Best Practices, Feature Configuration (CRITICAL!), VR Performance Context

### Community 30 - "Community 30"
Cohesion: 0.50
Nodes (4): hzdb (Meta Quest Device Tools), IWER (Immersive Web Emulation Runtime), IWSDK Reference (Code Intelligence), MCP Tools Available

### Community 34 - "Community 34"
Cohesion: 0.08
Nodes (21): 10. Audio Configuration, 11. Three.js Import Check (CRITICAL), 12. Component Size Check, 15. Direct asset loaders instead of AssetManager, 16. Raw scene.add() instead of createTransformEntity, 17. Manual Raycaster instead of Interactable, 18. Environment components on wrong entity, 19. Missing `_needsUpdate` on environment changes (+13 more)

### Community 38 - "Community 38"
Cohesion: 0.12
Nodes (17): 1. Router Agent — System Message, 2. Per-Namespace Pinecone Tool Descriptions, bmw_ix3_2027, cadillac_lyriq_2023, chevrolet_blazer_ev_2024, chevrolet_bolt_ev_2022_2023, chevrolet_equinox_ev_2024, ford_lightning_2026 (+9 more)

### Community 62 - "Community 62"
Cohesion: 0.10
Nodes (19): 2026-04-16 — Initial Commit, 2026-04-20 — Enriched Metadata + Evaluation Framework, 2026-05-04 — Chatbox Added to Gaussian Splatting Tab, 2026-06-24 — Router Model Finalized: Claude Sonnet 4.6 (Audit-Log Closeout), 2026-06-29 — n8n Router Minimal Hardening (maxIterations + prompt de-dup), 2026-06-29 — Router Prompt De-Contradiction (Single/Multi-Tool Wording) + Full System-Message Doc Sync, 2026-07-05 — Workflow Tooling: Graphify Prune, Skill-Tree Consolidation, `n8n_sync.py` + `run_eval.py`, 2026-07-06 — v2 Portal: Deploy the Dead-CSS Cleanup That Never Shipped + Graphify Refresh + Router Doc Fix (+11 more)

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (4): IWER dev runtime launch config (port 8081, dev:runtime), IWER Quest emulator runtime, IWER emulator session state (agent mode, browser disconnected), portal .claude settings (IWSDK MCP tool allowlist)

### Community 71 - "Community 71"
Cohesion: 0.13
Nodes (15): Alternate Procedures, Citation-drift spot-check, Final router model: Claude Sonnet 4.6 (2026-06-24), Headline: no regression, Nissan Ariya 2026 — High-Voltage System Shutdown, Opus 4.6 router re-test (2026-06-22), Opus 4.6 Verification Appendix (2026-06-24), Parity summary (+7 more)

### Community 87 - "Community 87"
Cohesion: 0.04
Nodes (48): 1. Laminated glass — the window is now a cutting job, 2. Carbon fiber / high-strength structure — cut zones and PPE, 3. General cutting rules that still apply, Charging & Infrastructure Issues, ⚠️ Critical safety warnings first, Designated cut points (where cutting is easiest / appropriate), EV First-Responder Q&A — n8n RAG Webhook vs. graphify Knowledge Graph, Extrication & Post-Crash Handling (+40 more)

### Community 91 - "Community 91"
Cohesion: 0.22
Nodes (9): 2026-05-24 — IWSDK v2 Portal (Meta Immersive Web SDK Migration), Changes, Not yet verified, Pain points hit during build, Rollout model, Scope split — what migrated vs what stayed, Verified locally, What was built (+1 more)

### Community 92 - "Community 92"
Cohesion: 0.15
Nodes (13): 2026-05-25 — IWSDK v2 Verify Pass + HUD Comfort Bump + Voice STT Fallback + First v2 Deploy, 2026-06-01 — IWSDK v2 Live IWER Emulator Pass + Quest STT Correction + Transcribe Webhook, Changes, Changes, CORS fix note, HUD comfort height (`portal/src/index.ts`), IWER emulator verify pass (v2 portal), Live IWER emulator pass (v2 portal) (+5 more)

### Community 106 - "Community 106"
Cohesion: 0.17
Nodes (12): 2026-06-01 — Transcribe Webhook Activated + v2 Overhaul DEPLOYED (the stale-bundle fix), 2026-06-29 — v2 Portal Copy Cleanup + Streamlit VR Caption Reword (Deployed), Caught: the v2 VR overhaul had never been deployed (root cause of "no changes in VR"), Changes, Deploy, Deploy, Deploy, Note on what does NOT need a deploy (+4 more)

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
Cohesion: 0.16
Nodes (16): 2026-05-04 — CloudFront Migration + Streamlit CORS Fix, 2026-05-04 — Meta Quest 3 VR Support (A-Frame Migration), 2026-05-24 — In-VR HUD + Right-Trigger Voice Chat (Meta Quest 3), Changes, Changes, Changes, Deploy protocol followed, Not yet verified (+8 more)

### Community 231 - "Community 231"
Cohesion: 0.50
Nodes (4): 2026-05-03 — CloudFront HLS Video Integration + Portal Cleanup, `inspector_portal.html` changes, `streamlit_app.py` changes, Video Hosting — Local → CloudFront HLS

### Community 232 - "Community 232"
Cohesion: 0.50
Nodes (4): 2026-05-04 — HLS Fix + Whisper Voice Input + chat_panel.html, chat_panel.html + Gaussian tab refactor (`streamlit_app.py`), HLS fix (`inspector_portal.html`), Whisper voice input button (`inspector_portal.html`)

### Community 246 - "Community 246"
Cohesion: 0.50
Nodes (3): Develop / build, First Responder Portal — v2 (IWSDK), Layout (flat — one module per concern, no starter-template scaffold)

## Knowledge Gaps
- **349 isolated node(s):** `npx`, `@meta-quest/hzdb`, `name`, `version`, `private` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `12V / Low Voltage Battery` connect `EV Response Guides & Concepts` to `Deploy & HLS Pipeline`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `Encode one rendition into out_dir/index.m3u8 + seg*.ts. Idempotent.`, `Peak BANDWIDTH (bits/s) = max(segment_bytes * 8 / segment_duration).`, `Upload every file in var_dir -> videos/<stem>/<tier>/<name>.` to the rest of the system?**
  _375 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat & Voice Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.07792207792207792 - nodes in this community are weakly interconnected._
- **Should `HUD & Videosphere Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.08780487804878048 - nodes in this community are weakly interconnected._
- **Should `Portal Build Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Deploy & HLS Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._
- **Should `IWSDK Reference Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._