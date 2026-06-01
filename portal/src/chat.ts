import { marked } from "marked";
import { mirrorToHud, setHudPending } from "./hud-mirror.js";

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

export async function sendMessage() {
  const question = inputEl.value.trim();
  if (!question) return;

  errorEl.style.display = "none";
  inputEl.value = "";
  autoGrow();
  sendBtn.disabled = true;

  addMessage("user", question);
  const typingEl = addTyping();
  setHudPending(true); // mirror "Thinking…" into the in-VR HUD

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: SESSION_ID }),
    });

    typingEl.remove();

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.message || detail.detail || `Webhook error ${res.status}`);
    }

    const data = await res.json();
    const answer = parseN8nResponse(data);
    addMessage("bot", answer);
  } catch (err) {
    typingEl.remove();
    errorEl.style.display = "block";
    errorEl.textContent = `⚠ ${(err as Error).message}`;
  } finally {
    setHudPending(false);
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

export function setInputValue(text: string) {
  inputEl.value = text;
}

export function initChatBindings() {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl.addEventListener("input", autoGrow);
  sendBtn.addEventListener("click", sendMessage);
}
