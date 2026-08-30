# Plan: Modern agent-style chat + video controls for the v2 VR HUD

Execute top to bottom. Every decision is already made — do not ask questions.
All paths are relative to `portal/` (run everything from `portal/`).

## Context you must know before touching anything

- The in-VR HUD is a UIKit panel: markup in `ui/hud.uikitml`, auto-compiled to
  `public/ui/hud.json` by the Vite plugin (`compileUIKit` in `vite.config.ts`).
  **Never edit `public/ui/hud.json` by hand** — edit `ui/hud.uikitml`; the dev
  server recompiles it on save (and `npm run build` does too).
- `src/hud.ts` (`HudSystem`) wires panel elements by id and polls video state
  every 0.25 s. `src/hud-mirror.ts` bridges chat/voice → HUD. `src/chat.ts` is
  the DOM chat + n8n webhook client. `src/videosphere.ts` owns the `<video>`
  elements (`getActiveVideo()`).
- **Hard rules:**
  1. Import everything Three/IWSDK from `@iwsdk/core`, never from `'three'`.
  2. ECS query results are `Set`s — use `.size`, not `.length`.
  3. **HUD text must be pure ASCII** — the UIKit font atlas has no emoji,
     em-dash, ellipsis, or arrow glyphs (they render as tofu boxes). Button
     labels like `< 10s` are fine; `⏪` or `«` are not.
  4. An **empty** `<span>` in uikitml compiles to a Container, not a Text —
     `setProperties({text})` silently no-ops. Any span you want to write text
     into must be seeded with placeholder content. (Empty `<div>`s are fine —
     a Container is what you want for dynamic children.)
  5. `npx tsc --noEmit` must be clean before any runtime testing — type errors
     break system init without surfacing in the browser console.
- **Verified UIKit facts (do not re-research):**
  - `overflow: scroll` is a valid uikitml style property, along with
    `scrollbar-color` and `scrollbar-width` (kebab-case in uikitml → camelCase
    in the compiled JSON). Ray-drag scrolling on a scrollable container is
    handled by UIKit itself.
  - `UIKit` namespace is re-exported from `@iwsdk/core`
    (`import { UIKit } from "@iwsdk/core"`). `new UIKit.Container({...})` and
    `new UIKit.Text({ text: "...", ... })` take a flat camelCase properties
    object (same property names as uikitml styles). UIKit components extend
    THREE.Mesh, so `parent.add(child)` / `parent.remove(child)` work, and each
    component has `.dispose()`.
  - Every UIKit component has `scrollPosition: Signal<[x, y]>` and
    `maxScrollPosition: Signal<[x?, y?]>` (preact signals — read/write
    `.value`). Scroll to bottom = `el.scrollPosition.value = [0, el.maxScrollPosition.value[1] ?? 0]`.
    Set it one frame after adding children (layout is async) — use
    `setTimeout(..., 50)`.
- **Emulator limits:** the IWER emulator cannot play the 360° HLS video (CORS),
  so the time label stays `--:-- / --:--` and seek/progress can only be
  verified visually/by code review. That is expected and fine. The n8n chat
  webhook IS reachable from the emulator browser, so the chat pipeline can be
  tested end-to-end with a Quick-Ask chip click.
- The dev server + IWER emulator are normally already running. Check with
  `mcp__iwsdk-runtime__xr_get_session_status` (hydrate MCP schemas via
  ToolSearch first if deferred). Only if not connected: `npm run dev`
  (background) and wait ~15 s.

---

## Task 1 — Replace the single-paragraph chat with a scrollable bubble list

Today the whole conversation is flattened into one `<span>` (`#hud-chat-text`)
capped at 4 messages × 280 chars. Replace it with a scrollable message list
with per-role bubbles and no truncation.

### 1a. `ui/hud.uikitml`

Replace the `chat-surface` block (currently the div containing
`#hud-chat-text`, `#hud-transcript`, `#hud-hint`) with:

```html
  <div class="chat-surface">
    <div id="hud-chat-scroll" class="chat-scroll"></div>
    <span id="hud-transcript" class="chat-transcript">-</span>
    <span id="hud-hint" class="chat-hint">Hold RIGHT TRIGGER or PINCH to speak</span>
  </div>
```

(Keep `#hud-transcript` and `#hud-hint` exactly as they are — other code wires
them.)

In the `<style>` block, add (units are UIKit units, matching existing styles):

```css
  .chat-scroll {
    height: 26;
    overflow: scroll;
    scrollbar-color: #64748b;
    scrollbar-width: 0.4;
    display: flex;
    flex-direction: column;
    gap: 1;
    padding-right: 1;
  }
```

Also delete the now-unused `.chat-history` style rule, and change
`.chat-surface`'s `min-height: 22` to nothing (the fixed-height scroll area
now controls size).

### 1b. `src/hud-mirror.ts`

- Change the history cap from 4 to 40: `while (chatHistory.length > 40) chatHistory.shift();`
- Add an accessor:

```ts
export function getChatHistory(): readonly { role: "user" | "bot"; text: string }[] {
  return chatHistory;
}
```

- Delete `getRenderedHistory()` (and its 280-char truncation) — hud.ts is its
  only caller and will stop using it.
- Leave `mdToPlain`, `toAscii`, and everything else untouched.

### 1c. `src/hud.ts`

- Update the import from `./hud-mirror.js`: drop `getRenderedHistory`, add
  `getChatHistory`.
- Add `UIKit` to the `@iwsdk/core` import if not present (it is already
  imported).
- Replace the fields `private chatText: UIKit.Text | null = null;` with
  `private chatScroll: UIKit.Container | null = null;`
- In `wireHud()`:
  - Replace `this.chatText = doc.getElementById("hud-chat-text") as UIKit.Text;`
    with `this.chatScroll = doc.getElementById("hud-chat-scroll") as UIKit.Container;`
  - Replace the `setChatListener` body with:

```ts
    setChatListener((role) => {
      this.renderChatBubbles();
      if (role === "bot") this.playChime();
    });
    this.renderChatBubbles(); // initial render (placeholder or replayed history)
```

- Add these methods to `HudSystem`:

```ts
  // Rebuild the bubble list from scratch. Runs only when a message arrives
  // (not per frame), and history is capped at 40, so rebuild-all is cheap
  // and far simpler than diffing.
  private renderChatBubbles() {
    const scroll = this.chatScroll;
    if (!scroll) return;
    for (const child of [...scroll.children]) {
      scroll.remove(child);
      (child as UIKit.Component).dispose?.();
    }
    const history = getChatHistory();
    if (history.length === 0) {
      const placeholder = new UIKit.Text({
        text: "First Responder GPT - ask about EV emergency response.",
        fontSize: 2,
        color: "#94a3b8",
      });
      scroll.add(placeholder);
      return;
    }
    for (const m of history) {
      scroll.add(this.makeBubble(m.role, m.text));
    }
    // Layout is async; scroll to the newest message a frame later.
    setTimeout(() => {
      const max = scroll.maxScrollPosition.value;
      scroll.scrollPosition.value = [0, max[1] ?? 0];
    }, 50);
  }

  private makeBubble(role: "user" | "bot", text: string): UIKit.Container {
    const isUser = role === "user";
    const bubble = new UIKit.Container({
      flexDirection: "column",
      gap: 0.3,
      maxWidth: "85%",
      alignSelf: isUser ? "flex-end" : "flex-start",
      backgroundColor: isUser ? "#1e3a8a" : "#334155",
      borderRadius: 1.2,
      padding: 1,
      flexShrink: 0,
    });
    bubble.add(
      new UIKit.Text({
        text: isUser ? "You" : "First Responder GPT",
        fontSize: 1.5,
        color: isUser ? "#93c5fd" : "#94a3b8",
      }),
    );
    bubble.add(
      new UIKit.Text({
        text,
        fontSize: 2,
        color: "#e2e8f0",
      }),
    );
    return bubble;
  }
```

Type note: if `UIKit.Component` complains about `dispose?.()`, cast to `any`
for the dispose call. If `maxWidth: "85%"` fails the type check, use
`maxWidth: 40` (UIKit units) instead.

---

## Task 2 — Video playback controls: seek buttons + progress bar

### 2a. `ui/hud.uikitml`

Insert a new row **between** the `playback-row` div and the `chat-surface` div:

```html
  <div class="seek-row">
    <button id="hud-back10" class="hud-btn hud-btn-seek">&lt; 10s</button>
    <div id="hud-progress-track" class="progress-track">
      <div id="hud-progress-fill" class="progress-fill"></div>
    </div>
    <button id="hud-fwd10" class="hud-btn hud-btn-seek">10s &gt;</button>
  </div>
```

(If the uikitml parser rejects `&lt;`/`&gt;` entities — check the dev-server
console for a compile error on save — use plain `< 10s` and `10s >` text; if
that also fails to parse, fall back to labels `-10s` and `+10s`.)

Styles to add:

```css
  .seek-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1;
  }

  .hud-btn-seek { width: 8; font-size: 1.8; padding: 0.7; }

  .progress-track {
    flex-grow: 1;
    height: 1.2;
    background-color: #334155;
    border-radius: 0.6;
    overflow: hidden;
  }

  .progress-fill {
    width: 0%;
    height: 100%;
    background-color: #3b82f6;
    border-radius: 0.6;
  }
```

### 2b. `src/hud.ts`

- Add fields:

```ts
  private progressFill: UIKit.Container | null = null;
```

- In `wireHud()` wire the new elements:

```ts
    this.progressFill = doc.getElementById("hud-progress-fill") as UIKit.Container;
    doc.getElementById("hud-back10")?.addEventListener("click", () =>
      this.guardedClick(() => this.seekBy(-10)),
    );
    doc.getElementById("hud-fwd10")?.addEventListener("click", () =>
      this.guardedClick(() => this.seekBy(10)),
    );
```

- Add the method:

```ts
  private seekBy(seconds: number) {
    const v = getActiveVideo();
    if (!v || !v.duration || isNaN(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  }
```

- In the existing `update()` 0.25 s block, next to the time-label update, add:

```ts
    if (v.duration && !isNaN(v.duration)) {
      const pct = Math.round((v.currentTime / v.duration) * 100);
      this.progressFill?.setProperties({ width: `${pct}%` });
    }
```

(If the `width: \`${pct}%\`` template-string type is rejected, use
`(pct + "%") as any`.)

---

## Task 3 — Extra feature 1: Quick-Ask chips (one-click common questions)

Three preset questions a responder actually needs, sent to the AI with a
single ray click — no typing or voice required.

### 3a. `src/chat.ts`

Refactor so a question can be sent programmatically:

```ts
export async function sendMessage(overrideText?: string) {
  const question = (overrideText ?? inputEl.value).trim();
  if (!question) return;

  errorEl.style.display = "none";
  if (!overrideText) inputEl.value = "";
  autoGrow();
  ...
```

(Only those first lines change; the rest of the function body stays
identical.) In `initChatBindings`, change both call sites to explicit
zero-arg closures so DOM `Event` objects are never passed as `overrideText`:
`sendMessage()` inside the keydown handler is already a bare call — keep it —
and change `sendBtn.addEventListener("click", sendMessage);` to
`sendBtn.addEventListener("click", () => sendMessage());`.

Add:

```ts
export function askQuickQuestion(question: string) {
  void sendMessage(question);
}
```

### 3b. `ui/hud.uikitml`

Add a chips row **inside** `.chat-surface`, directly **above**
`#hud-chat-scroll`:

```html
    <div class="chips-row">
      <button id="hud-chip1" class="hud-chip">Shut down HV</button>
      <button id="hud-chip2" class="hud-chip">Battery fire</button>
      <button id="hud-chip3" class="hud-chip">Where to cut</button>
    </div>
```

Styles:

```css
  .chips-row {
    display: flex;
    flex-direction: row;
    gap: 1;
  }

  .hud-chip {
    flex-grow: 1;
    padding: 0.7;
    background-color: #0f172a;
    border-color: #3b82f6;
    border-width: 0.1;
    border-radius: 2;
    color: #93c5fd;
    font-size: 1.7;
    text-align: center;
    cursor: pointer;
  }

  .hud-chip:hover { background-color: #1e3a8a; }
```

### 3c. `src/hud.ts`

Import `askQuickQuestion` from `./chat.js` and wire in `wireHud()`:

```ts
    const QUICK_QUESTIONS: [string, string][] = [
      ["hud-chip1", "How do I shut down the high-voltage system on an EV?"],
      ["hud-chip2", "How should I respond to an EV battery fire?"],
      ["hud-chip3", "Where are the safe cut points for extrication on an EV?"],
    ];
    for (const [id, q] of QUICK_QUESTIONS) {
      doc.getElementById(id)?.addEventListener("click", () =>
        this.guardedClick(() => askQuickQuestion(q)),
      );
    }
```

The answer flows through the existing `addMessage` → `mirrorToHud` path, so
bubbles, chime, and "Thinking..." all work with zero extra code.

---

## Task 4 — Extra feature 2: left-thumbstick scrolls the chat history

Ray-drag scrolling works but is fiddly; the left stick gives effortless
reading of long answers (the right hand stays on push-to-talk).

In `src/hud.ts` `update()`, add **before** the 0.25 s throttle check (this
must run every frame):

```ts
    // Left-thumbstick scrolls the chat history (right hand is push-to-talk).
    const left = this.input.xr.gamepads.left;
    const axes = left?.getAxesValues(InputComponent.Thumbstick);
    if (this.chatScroll && axes && Math.abs(axes.y) > 0.2) {
      const pos = this.chatScroll.scrollPosition.value;
      const max = this.chatScroll.maxScrollPosition.value[1] ?? 0;
      const y = Math.max(0, Math.min(max, (pos[1] ?? 0) + axes.y * delta * 40));
      this.chatScroll.scrollPosition.value = [pos[0] ?? 0, y];
    }
```

Add `InputComponent` to the `@iwsdk/core` import in `hud.ts`.
Sign check during verification: push stick **down** should scroll **toward
newer messages** (increasing y). If it's inverted, negate `axes.y`.

---

## Verification (in order)

1. `npx tsc --noEmit` — must be clean. Fix any errors before proceeding.
2. Confirm the dev server recompiled the UI: the dev-server output logs the
   uikitml compile; `public/ui/hud.json` mtime should be newer than your edit.
   A uikitml syntax error appears in the dev-server console — fix before
   continuing.
3. Load MCP runtime tool schemas (ToolSearch `select:` for the
   `mcp__iwsdk-runtime__*` tools), then:
   - `mcp__iwsdk-runtime__xr_get_session_status` — expect connected.
   - `mcp__iwsdk-runtime__browser_reload_page`, wait ~5 s.
   - `mcp__iwsdk-runtime__xr_accept_session` to enter VR.
   - `mcp__iwsdk-runtime__browser_screenshot` — verify: seek row with two seek
     buttons + progress track, chips row, chat area showing the placeholder
     text, no tofu boxes anywhere.
   - `mcp__iwsdk-runtime__browser_get_console_logs` with `count: 40` (no
     `level` filter) — no new errors (ignore known HLS/CORS video failures).
4. End-to-end chat test: use the `/iwsdk-ray` skill (or `xr_look_at` on the
   chip's position + `xr_select`) to click the "Shut down HV" chip. Wait ~15 s,
   screenshot again: expect a right-aligned user bubble, "Thinking..." status
   while pending, then a left-aligned answer bubble, auto-scrolled to bottom.
5. Scroll test: click another chip to lengthen history, then
   `mcp__iwsdk-runtime__xr_set_gamepad_state` on the **left** controller with
   thumbstick axes `y = 1` for a moment (then reset to 0) and screenshot —
   the list should have scrolled. Also verify ray-drag: press-and-hold
   (`xr_set_select_value` 1.0) over the chat area, move the controller with
   `xr_set_transform`, release — list scrolls.
6. Video controls can NOT be exercised in the emulator (CORS blocks HLS) —
   correctness is by code review only; note this in your final report as a
   Quest-hardware test item.
7. `npm run build` — must succeed.
8. `graphify update .` (run from the repo root `..`) to refresh the knowledge
   graph.
9. Commit (do NOT deploy — Quest shakedown gates deploys):

```bash
git add ui/hud.uikitml src/hud.ts src/hud-mirror.ts src/chat.ts plan.md
git commit -m "HUD v2: scrollable chat bubbles, seek controls + progress bar, quick-ask chips, thumbstick scroll

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Known-risk fallbacks (apply only if the symptom occurs)

- **Bubbles invisible but no errors:** the dynamic Container may need explicit
  `flexDirection` on the scroll container — it is set in `.chat-scroll`; make
  sure the compiled `public/ui/hud.json` actually contains
  `"overflow": "scroll"` (grep it). If the stylesheet dropped it, set the
  properties from TS instead:
  `this.chatScroll.setProperties({ overflow: "scroll", scrollbarColor: "#64748b", scrollbarWidth: 0.4 })`.
- **Panel grows instead of scrolling:** the fixed `height: 26` on
  `.chat-scroll` is mandatory — confirm it survived compilation; also add
  `flexShrink: 0` styles are only on bubbles, not the scroll container.
- **`scrollPosition.value` assignment doesn't move the list:** try
  `[0, 100000]` (UIKit clamps to max) and re-screenshot.
- **Phantom chip click after push-to-talk release:** already handled — all new
  buttons go through `guardedClick`.
