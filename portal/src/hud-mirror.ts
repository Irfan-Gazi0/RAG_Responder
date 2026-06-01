// Bridge between vanilla-JS chat/voice modules and the IWSDK HUD system.
// The HUD system registers listeners on init; chat/voice call the export functions.

type ChatListener = (role: "user" | "bot", text: string) => void;
type TranscriptListener = (text: string) => void;
type PendingListener = (pending: boolean) => void;

let chatListener: ChatListener | null = null;
let transcriptListener: TranscriptListener | null = null;
let pendingListener: PendingListener | null = null;

const chatHistory: { role: "user" | "bot"; text: string }[] = [];

export function setChatListener(fn: ChatListener | null) {
  chatListener = fn;
  // Replay history so a late-mounting HUD shows existing exchanges.
  if (fn) for (const m of chatHistory) fn(m.role, m.text);
}

export function setTranscriptListener(fn: TranscriptListener | null) {
  transcriptListener = fn;
}

export function setPendingListener(fn: PendingListener | null) {
  pendingListener = fn;
}

export function mirrorToHud(role: "user" | "bot", text: string) {
  chatHistory.push({ role, text });
  while (chatHistory.length > 4) chatHistory.shift();
  chatListener?.(role, text);
}

export function setHudTranscript(text: string) {
  transcriptListener?.(text);
}

// Mirrors the in-flight chat round-trip so VR users (who can't see the DOM
// typing indicator) get feedback that their question was heard.
export function setHudPending(pending: boolean) {
  pendingListener?.(pending);
}

export function getRenderedHistory(): string {
  return chatHistory
    .map((m) => {
      const prefix = m.role === "user" ? "You: " : "AI: ";
      const t = m.text.length > 280 ? m.text.slice(0, 277) + "..." : m.text;
      return prefix + t;
    })
    .join("\n\n");
}
