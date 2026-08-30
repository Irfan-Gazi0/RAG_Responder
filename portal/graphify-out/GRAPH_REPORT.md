# Graph Report - portal  (2026-07-06)

## Corpus Check
- 16 files · ~11,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 206 nodes · 269 edges · 13 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea3bfa8b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `Review Checklist` - 21 edges
2. `Anti-Patterns to Avoid` - 13 edges
3. `Quick Reference` - 12 edges
4. `compilerOptions` - 11 edges
5. `IWSDK Project - Claude Code Configuration` - 10 edges
6. `scripts` - 9 edges
7. `sendMessage()` - 9 edges
8. `HudSystem` - 7 edges
9. `Skills Available` - 7 edges
10. `setHudTranscript()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `sendMessage()` --calls--> `setHudPending()`  [EXTRACTED]
  src/chat.ts → src/hud-mirror.ts
- `addMessage()` --calls--> `mirrorToHud()`  [EXTRACTED]
  src/chat.ts → src/hud-mirror.ts
- `startMediaRecording()` --calls--> `sendMessage()`  [EXTRACTED]
  src/voice.ts → src/chat.ts
- `startSpeechRecognition()` --calls--> `sendMessage()`  [EXTRACTED]
  src/voice.ts → src/chat.ts
- `startMediaRecording()` --calls--> `setInputValue()`  [EXTRACTED]
  src/voice.ts → src/chat.ts

## Import Cycles
- None detected.

## Communities (13 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (27): addMessage(), addTyping(), autoGrow(), errorEl, inputEl, messagesEl, parseN8nResponse(), scrollToBottom() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (26): Agents Available, Audio Playback, Available Types, Component Template, Core Architecture, Critical Import Rule, Debugging Missing Features, hzdb (Meta Quest Device Tools) (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (21): 10. Audio Configuration, 11. Three.js Import Check (CRITICAL), 12. Component Size Check, 15. Direct asset loaders instead of AssetManager, 16. Raw scene.add() instead of createTransformEntity, 17. Manual Raycaster instead of Interactable, 18. Environment components on wrong entity, 19. Missing `_needsUpdate` on environment changes (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (22): dependencies, hls.js, @iwsdk/core, marked, three, devDependencies, @iwsdk/cli, @iwsdk/reference (+14 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (12): HudSystem, chatHistory, ChatListener, getRenderedHistory(), PendingListener, setChatListener(), setHudPending(), setPendingListener() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): Anti-Patterns to Avoid, Browser 3D With First-Class XR, Critical Best Practices, DON'T add environment components to arbitrary entities, DON'T forget `_needsUpdate` after changing environment properties, DON'T forget to cleanup subscriptions, DON'T pass numbers to ScreenSpace, DON'T poll for state changes (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (16): activatePanorama(), bindVideoControls(), createHiddenVideoEls(), ensureHls(), hlsInstances, hlsReady, hlsSupported, initVideosphere() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (7): initChatBindings(), DesktopLookSystem, PushToTalkSystem, initVoiceBindings(), isCurrentlyRecording(), isVoiceSupported(), stopRecognition()

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dev:down, dev:runtime, dev:status, preview, reference:status (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): `/iwsdk-debug`, `/iwsdk-grab`, `/iwsdk-physics`, `/iwsdk-planner`, `/iwsdk-ray`, `/iwsdk-ui`, Skills Available

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): Develop / build, First Responder Portal — v2 (IWSDK), Layout (flat — one module per concern, no starter-template scaffold)

## Knowledge Gaps
- **121 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+116 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IWSDK Project - Claude Code Configuration` connect `Community 1` to `Community 10`, `Community 5`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `Critical Best Practices` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _121 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._