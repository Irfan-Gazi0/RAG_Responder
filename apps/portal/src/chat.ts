import { marked } from "marked";
import {
  flashHudStatus,
  isImmersive,
  mirrorToHud,
  setHudPending,
} from "./hud-mirror.js";
import { crumb } from "./breadcrumbs.js";

const WEBHOOK_URL =
  "https://irfangazi.app.n8n.cloud/webhook/a7782f7b-3403-48c3-9e6d-c14772a002a1";

const SESSION_ID = (() => {
  let id = localStorage.getItem("fr_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("fr_session_id", id);
  }
  return id;
})();

const messagesEl = document.getElementById("chat-messages") as HTMLDivElement;
const inputEl = document.getElementById("chat-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const errorEl = document.getElementById("error-banner") as HTMLDivElement;

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
}

export function addMessage(role: "user" | "bot", text: string) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user" ? "You" : "First Responder GPT";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "bot") {
    bubble.innerHTML = marked.parse(text) as string;
  } else {
    bubble.textContent = text;
  }

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  mirrorToHud(role, text);
  return wrap;
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot typing";
  wrap.innerHTML = `
    <span class="label">First Responder GPT</span>
    <div class="bubble"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function parseN8nResponse(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) data = data[0];
  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    return (
      (d.output as string) ||
      (d.text as string) ||
      (d.response as string) ||
      (d.answer as string) ||
      JSON.stringify(data)
    );
  }
  return String(data);
}

// One request at a time. `sendBtn.disabled` only ever guarded the DOM button —
// the in-VR Quick-Ask chips and voice call sendMessage() directly, so a gloved
// double-tap on a chip fired two concurrent 25 s agent calls and rendered two
// duplicate user bubbles in the HUD.
let inFlight = false;

export async function sendMessage(overrideText?: string) {
  const question = (overrideText ?? inputEl.value).trim();
  if (!question) return;

  if (inFlight) {
    flashHudStatus("Still answering the last question...");
    return;
  }
  inFlight = true;
  sendBtn.disabled = true;

  // Measured answers run 7-25 s (14 Pinecone tools at topK=10 behind a Sonnet
  // router), so 30 s left no margin on headset WiFi.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  // Declared out here, assigned inside the try: addMessage() and setHudPending()
  // reach into UIKit on the in-VR HUD, and a throw there before the try would
  // skip the finally and strand inFlight === true — every later send then dies
  // at the guard above and the Send button stays disabled until a page reload.
  let typingEl: HTMLDivElement | null = null;

  try {
    errorEl.style.display = "none";
    if (!overrideText) inputEl.value = "";
    autoGrow();

    addMessage("user", question);
    typingEl = addTyping();
    setHudPending(true); // mirror "Thinking…" into the in-VR HUD

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: SESSION_ID }),
      signal: controller.signal,
    });

    typingEl?.remove();

    // Read as text first: when the n8n agent errors before its Respond node, the
    // webhook answers 200 with a ZERO-BYTE body, and res.json() then throws
    // "Unexpected end of JSON input" — which is what the VR HUD showed the user.
    const raw = await res.text();

    if (!res.ok) {
      let detail: Record<string, unknown> = {};
      try {
        detail = JSON.parse(raw);
      } catch {
        /* non-JSON error body */
      }
      throw new Error(
        (detail.message as string) ||
          (detail.detail as string) ||
          `Webhook error ${res.status}`,
      );
    }

    if (!raw.trim()) {
      throw new Error("Assistant returned an empty response - please try again.");
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Assistant returned an unreadable response - please try again.");
    }

    const answer = parseN8nResponse(data);
    // The crash lands between here and the bubble appearing in VR, so record the
    // payload size first: if this is the last persisted crumb, the answer render
    // is confirmed as the trigger and we know how big the input was.
    crumb("chat", `answer received bytes=${raw.length} chars=${answer.length}`);
    addMessage("bot", answer);
    crumb("chat", "answer rendered");
  } catch (err) {
    crumb("chat", "sendMessage failed:", err as Error);
    typingEl?.remove();
    errorEl.style.display = "block";
    errorEl.textContent = `⚠ ${(err as Error).message}`;
    if ((err as Error).name === "AbortError") {
      flashHudStatus("Request timed out - try again.");
    } else {
      flashHudStatus("Chat error: " + (err as Error).message);
    }
  } finally {
    // Order matters: reset the send-lock and the button before touching the HUD,
    // and swallow HUD failures. A throw out of setHudPending() here would leave
    // whatever follows it unexecuted — same lockout, one level deeper.
    clearTimeout(timeout);
    inFlight = false;
    sendBtn.disabled = false;
    focusInput();
    try {
      setHudPending(false);
    } catch (hudErr) {
      crumb("chat", "setHudPending(false) failed:", hudErr as Error);
    }
  }
}

// Send a preset question without touching the DOM input (in-VR Quick-Ask chips).
export function askQuickQuestion(question: string) {
  void sendMessage(question);
}

export function setInputValue(text: string) {
  inputEl.value = text;
}

/**
 * Focus the composer — but NEVER while an immersive session is active.
 *
 * THIS IS THE "the browser closed on me when the answer was generated" CRASH.
 * Confirmed 2026-08-10 from `adb logcat` on a real Quest 3, not inferred:
 *
 *   FATAL EXCEPTION: main
 *   Process: com.oculus.browser, PID: 9087
 *   Caused by: java.lang.IllegalStateException:
 *       You need to use a Theme.AppCompat theme (or descendant) with this activity.
 *     at gu.setContentView(chromium-OculusBrowser.apk-stable-570200647:8)
 *     at android.app.Dialog.show(Dialog.java:325)
 *     at com.oculus.browser.VrShellDelegate.showOverlayKeyboard(...:91)
 *   ...4.5 s later:
 *   I Process : Sending signal. PID: 9087 SIG: 9
 *
 * Focusing a text input inside a WebXR session makes the Meta Quest Browser
 * open its VR overlay keyboard, and that keyboard throws while inflating its own
 * dialog. The throw is uncaught on the browser's main Looper, so Android's
 * default handler SIGKILLs the process. **The whole browser dies — not just the
 * tab, and there is no reload.** Nothing in JS can catch or recover from it;
 * `window.onerror` never fires, which is exactly why every previous fix attempt
 * (bubble overflow, MAX_BUBBLES, glyph budget, WebXR layers) missed it.
 *
 * This is a Meta Quest Browser bug (build 570200647), not a bug in this portal.
 * We can only avoid triggering it.
 *
 * The call site that fired it was `sendMessage()`'s finally block, which ran
 * this unconditionally the moment an answer finished rendering — hence the
 * symptom being reproducible on *every* in-VR question.
 *
 * Skipping it in VR costs nothing: the DOM composer is invisible in an immersive
 * session (the UIKit HUD is the UI), so there is no focus for the user to gain.
 */
export function focusInput() {
  if (isImmersive()) {
    crumb("chat", "focus() skipped in XR - Quest overlay-keyboard crash guard");
    return;
  }
  inputEl.focus();
}

export function initChatBindings() {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl.addEventListener("input", autoGrow);
  // Explicit closure: a bare reference would pass the DOM Event as overrideText.
  sendBtn.addEventListener("click", () => sendMessage());
}
