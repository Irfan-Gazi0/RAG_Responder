# First Responder Portal — v2 (IWSDK)

The v2 portal: a 360° EV training-video viewer with an in-page AI assistant,
built on Meta's Immersive Web SDK (`@iwsdk/core`, Vite + TypeScript). Deployed in
parallel to v1 under `/v2/` on CloudFront; see the repo-root `CLAUDE.md` for the
cutover plan and deploy rules.

## Layout (flat — one module per concern, no starter-template scaffold)

```
portal/
├── src/
│   ├── index.ts          # World.create() entry + system registration
│   ├── videosphere.ts    # 360° video sphere (HLS)
│   ├── hud.ts            # in-VR HUD panel
│   ├── hud-mirror.ts     # mirrors DOM/chat state onto the HUD
│   ├── push-to-talk.ts   # trigger-driven push-to-talk
│   ├── chat.ts           # n8n chat webhook client
│   ├── voice.ts          # SpeechRecognition + MediaRecorder→webhook fallback
│   └── look-controls.ts  # desktop look/orbit controls
├── ui/hud.uikitml        # UI markup → compiled to public/ui/hud.json at build
├── public/               # static assets (compiled ui/, etc.)
├── vite.config.ts        # basic-ssl for local https; UIKitML plugin
└── dist/                 # build output (uploaded by ../deploy_portal_v2.py)
```

## Develop / build

```bash
npm run dev        # Vite dev server + IWER Quest-3 emulator at https://localhost:8081/
npx tsc --noEmit   # type-check FIRST — IWSDK type errors often don't surface at runtime
npm run build      # → dist/
```

Deploy with `python3.10 ../deploy_portal_v2.py` from the repo root. IWSDK/VR hard
rules (Three.js imports, query `.size`, basic-ssl) live in this folder's
`CLAUDE.md`.
