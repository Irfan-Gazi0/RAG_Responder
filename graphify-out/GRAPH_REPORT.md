# Graph Report - .  (2026-06-22)

## Corpus Check
- 120 files · ~240,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 390 nodes · 574 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 141 edges (avg confidence: 0.82)
- Token cost: 110,000 input · 2,650 output

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
- [[_COMMUNITY_n8n AI Agent Design|n8n AI Agent Design]]
- [[_COMMUNITY_Portal Entry & Vite Config|Portal Entry & Vite Config]]
- [[_COMMUNITY_MCP Server Config|MCP Server Config]]
- [[_COMMUNITY_Cut Loop & HV Disconnect|Cut Loop & HV Disconnect]]
- [[_COMMUNITY_12V & Thermal Runaway|12V & Thermal Runaway]]
- [[_COMMUNITY_Submersion Response|Submersion Response]]
- [[_COMMUNITY_Towing & Recovery|Towing & Recovery]]
- [[_COMMUNITY_HZDB Asset Server|HZDB Asset Server]]
- [[_COMMUNITY_AI-Assisted Dev Loop|AI-Assisted Dev Loop]]

## God Nodes (most connected - your core abstractions)
1. `HudSystem` - 14 edges
2. `High Voltage Battery Pack` - 14 edges
3. `sendMessage()` - 12 edges
4. `High Voltage Disconnect / Service Disconnect` - 12 edges
5. `Fire Suppression / Li-Ion Battery Fire Guidance` - 12 edges
6. `compilerOptions` - 11 edges
7. `EV emergency response training session (part 1)` - 11 edges
8. `12V / Low Voltage Battery` - 10 edges
9. `process_stem()` - 9 edges
10. `scripts` - 9 edges

## Surprising Connections (you probably didn't know these)
- `chat_panel.startRecognition (Web Speech)` --semantically_similar_to--> `n8n transcribe-audio webhook`  [INFERRED] [semantically similar]
  chat_panel.html → n8n_transcribe_webhook.json
- `n8n chat WEBHOOK_URL` --semantically_similar_to--> `Webhook processing pattern`  [INFERRED] [semantically similar]
  portal/src/chat.ts → .claude/skills/n8n-workflow-patterns/SKILL.md
- `sendMessage()` --conceptually_related_to--> `sessionId-keyed agent memory`  [INFERRED]
  portal/src/chat.ts → .claude/skills/n8n-agents/SKILL.md
- `sendMessage()` --conceptually_related_to--> `AI Agent workflow pattern`  [INFERRED]
  portal/src/chat.ts → .claude/skills/n8n-workflow-patterns/ai_agent_workflow.md
- `eval_questions.json (Transcript+PDF QA set)` --references--> `First Responder GPT Router Agent`  [INFERRED]
  eval_questions.json → n8n_router_config.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **2026-06-22 Router Fix (depth + prompt + model)** — rag_responder_n8n_router_config_topk_10, rag_responder_n8n_router_config_claude_opus_router_model, rag_responder_n8n_router_config_step1_identify_vehicle, rag_responder_progress_router_rediagnosis [EXTRACTED 1.00]
- **Before/After Router Evaluation Pipeline** — rag_responder_baseline_results_doc, rag_responder_postfix_results_doc, rag_responder_ev_responder_qa_comparison_doc [INFERRED 0.85]
- **Quest In-VR Voice Chain (no native STT to webhook)** — rag_responder_progress_quest_no_native_stt, rag_responder_progress_transcribe_webhook, rag_responder_progress_iwsdk_v2_portal [EXTRACTED 1.00]

## Communities (24 total, 5 thin omitted)

### Community 0 - "Chat & Voice Frontend"
Cohesion: 0.08
Nodes (38): sessionId-keyed agent memory, Webhook processing pattern, addMessage(), addTyping(), autoGrow(), errorEl, initChatBindings(), inputEl (+30 more)

### Community 1 - "HUD & Videosphere Rendering"
Cohesion: 0.10
Nodes (30): HudSystem, chatHistory, ChatListener, getRenderedHistory(), mirrorToHud(), PendingListener, setChatListener(), setHudPending() (+22 more)

### Community 2 - "Portal Build Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, hls.js, @iwsdk/core, marked, three, devDependencies, @iwsdk/cli, @iwsdk/reference (+23 more)

### Community 3 - "Deploy & HLS Pipeline"
Cohesion: 0.11
Nodes (26): build_master(), content_type(), encode_variant(), ffprobe_duration(), ABR HLS ladder (high/mid/low), main(), peak_bandwidth(), process_stem() (+18 more)

### Community 4 - "IWSDK Reference Docs"
Cohesion: 0.08
Nodes (30): captions / head-stabilized text for audio, one-handed / seated accessibility, VR accessibility guidelines, field-of-view content zones (primary 0-30deg), vestibular mismatch / cybersickness, VR comfort guidelines, createComponent typed data containers, createSystem query-driven systems (+22 more)

### Community 5 - "Transcription & Chat Agents"
Cohesion: 0.11
Nodes (27): Anti-loop bot-user-ID filtering, Shell + core + sub-agents composition, chat_panel.html (First Responder GPT), chat_panel.sendMessage, chat_panel.startRecognition (Web Speech), Airbag / pretensioner / stored gas inflator, Cable cut location / no-cut HV cables, High-strength / no-cut structural zone (+19 more)

### Community 6 - "EV Response Guides & Concepts"
Cohesion: 0.18
Nodes (29): 12V / Low Voltage Battery, Airbag / SRS Components (inflators, pretensioners, control unit), Emergency Shutdown / Power Down Procedure, Fire Suppression / Li-Ion Battery Fire Guidance, First Responder Cut Loop / Cable Cut, High Voltage Battery Pack, High Voltage Disconnect / Service Disconnect, Immobilization / Stabilization / Lifting Points (+21 more)

### Community 7 - "IWSDK Skills & HUD UI"
Cohesion: 0.10
Nodes (27): iwsdk-project-code-reviewer agent, UIKitML VS Code extension recommendation, hz-immersive-designer skill (VR/MR comfort & UX), Spatial UI comfort guidelines (1.0-2.0m UI depth, readability), Head-locked HUD anti-pattern (causes nausea), hz-iwsdk-webxr skill (build WebXR with IWSDK), IWSDK ECS architecture (components/systems/queries), IWSDK spatial UI (UIKitML + PanelUI) (+19 more)

### Community 8 - "Router Fix & Eval Results"
Cohesion: 0.11
Nodes (24): Baseline (before-fix) Chatbot Responses, Named-Supported-Vehicle Wrongly Treated as Unidentified, Router Non-Determinism (same question, opposite outcome), EV First-Responder Q&A Comparison (webhook vs graphify), Generic Deferral Policy (no model-specific answer without make/model/year), graphify Knowledge Graph (graph.json BFS traversal), n8n RAG Chat Webhook (live chat workflow), Vehicle-Naming Determines Grounded vs Deferred Answer (+16 more)

### Community 9 - "n8n MCP Node Config"
Cohesion: 0.14
Nodes (16): auto-sanitization on workflow updates, get_node discovery tool, n8n MCP Tools Expert skill, node JSON hygiene (UUID id, omit placeholder credentials, current typeVersion), nodeType format split (short nodes-base.* vs full n8n-nodes-base.*), patchNodeField surgical field edit, n8n_update_partial_workflow iterative editing, validate_node unified validation tool (+8 more)

### Community 10 - "n8n Workflow Patterns"
Cohesion: 0.15
Nodes (15): n8n-agents skill (agent design depth), Templates, Data Tables & Self-Help Tools Guide, n8n MCP Tools Expert (skill), Node Discovery Tools Guide, AI Agent Workflow Pattern, Database Operations Pattern (.agents copy), Database Operations Pattern (.claude copy), HTTP API Integration Pattern (.agents copy) (+7 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+4 more)

### Community 12 - "360 Video Transcripts"
Cohesion: 0.20
Nodes (12): 12-volt jumpstart / wake-up of dead EV, instructor Barry Smith (SE Community College), ERG cut-battery-cables / relay-removal de-energizing procedure, EV emergency response training session (part 1), high-voltage orange cable safety ('if it is orange, do not mess with it'), charging cable disconnect (never cut, DC fast charge >400V, locked plug), battery module conductor plate / coolant heat transfer, Ford Mustang Mach-E walk-around (+4 more)

### Community 13 - "Project Progress Log"
Cohesion: 0.18
Nodes (11): DesktopLookSystem (drag-to-look on world.camera), Project Progress Log, eval_questions.json (90 ground-truth QA pairs), Body-Locked Lazy-Follow HUD (IWSDK Follower), inspector_portal.html v1 (A-Frame 360 portal), IWSDK v2 Portal (Meta Immersive Web SDK migration), n8n Workflow S3uHJF57JAuA7bL0, Pinecone Index ford-mache-erg (per-vehicle namespaces) (+3 more)

### Community 14 - "n8n AI Agent Design"
Cohesion: 0.29
Nodes (10): RAG vector store retrieve-as-tool, n8n AI Agent node, Agent model/memory/tools/outputParser slots, Structured output parser + autoFix, Sub-workflow as agent tool, Agent system prompt design, $fromAI tool parameter helper, Tool names/descriptions as prompt (+2 more)

### Community 15 - "Portal Entry & Vite Config"
Cohesion: 0.22
Nodes (10): portal index.html (v2 entry, scene + chat shell), iwsdk-reference MCP server (SDK code search), iwsdk-runtime MCP server (IWER drive/screenshot/ECS), @iwsdk/core dependency (0.4.1), portal package.json (v2 build config), portal tsconfig.json (strict, Bundler resolution), basicSsl plugin (self-signed SSL), compileUIKit plugin (UIKITML -> public/ui) (+2 more)

### Community 16 - "MCP Server Config"
Cohesion: 0.33
Nodes (6): node, npx, @meta-quest/hzdb, hzdb, iwsdk-reference, iwsdk-runtime

### Community 17 - "Cut Loop & HV Disconnect"
Cohesion: 0.67
Nodes (3): Emergency Plug Data Gap (IONIQ 5 has no such feature in source), First Responder Cut Loop / Cable Cut, High Voltage Disconnect / Service Disconnect

## Knowledge Gaps
- **126 isolated node(s):** `npx`, `@meta-quest/hzdb`, `name`, `version`, `private` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `12V / Low Voltage Battery` connect `EV Response Guides & Concepts` to `Transcription & Chat Agents`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `High Voltage Battery Pack` (e.g. with `Cadillac Lyriq 2023 ERG` and `Chevrolet Bolt EV 2022-2023 ERG`) actually correct?**
  _`High Voltage Battery Pack` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `sendMessage()` (e.g. with `sessionId-keyed agent memory` and `AI Agent workflow pattern`) actually correct?**
  _`sendMessage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `High Voltage Disconnect / Service Disconnect` (e.g. with `Cadillac Lyriq 2023 ERG` and `Chevrolet Bolt EV 2022-2023 ERG`) actually correct?**
  _`High Voltage Disconnect / Service Disconnect` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `Fire Suppression / Li-Ion Battery Fire Guidance` (e.g. with `Cadillac Lyriq 2023 ERG` and `Chevrolet Bolt EV 2022-2023 ERG`) actually correct?**
  _`Fire Suppression / Li-Ion Battery Fire Guidance` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Encode one rendition into out_dir/index.m3u8 + seg*.ts. Idempotent.`, `Peak BANDWIDTH (bits/s) = max(segment_bytes * 8 / segment_duration).`, `Upload every file in var_dir -> videos/<stem>/<tier>/<name>.` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat & Voice Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.07955596669750231 - nodes in this community are weakly interconnected._