// Bridge between vanilla-JS chat/voice modules and the IWSDK HUD system.
// The HUD system registers listeners on init; chat/voice call the export functions.

type ChatListener = (role: "user" | "bot", text: string) => void;
type TranscriptListener = (text: string) => void;

let chatListener: ChatListener | null = null;
let transcriptListener: TranscriptListener | null = null;

const chatHistory: { role: "user" | "bot"; text: string }[] = [];

export function setChatListener(fn: ChatListener | null) {
  chatListener = fn;
  // Replay history so a late-mounting HUD shows existing exchanges.
  if (fn) for (const m of chatHistory) fn(m.role, m.text);
}

export function setTranscriptListener(fn: TranscriptListener | null) {
  transcriptListener = fn;
}

export function mirrorToHud(role: "user" | "bot", text: string) {
  chatHistory.push({ role, text });
  while (chatHistory.length > 4) chatHistory.shift();
  chatListener?.(role, text);
}

export function setHudTranscript(text: string) {
  transcriptListener?.(text);
}

export function getRenderedHistory(): string {
  return chatHistory
    .map((m) => {
      const prefix = m.role === "user" ? "You: " : "AI: ";
      const t = m.text.length > 280 ? m.text.slice(0, 277) + "…" : m.text;
      return prefix + t;
    })
    .join("\n\n");
}
