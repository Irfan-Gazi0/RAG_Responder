// Bridge between vanilla-JS chat/voice modules and the IWSDK HUD system.
// The HUD system registers listeners on init; chat/voice call the export functions.

import { marked } from "marked";

type ChatListener = (role: "user" | "bot", text: string) => void;
type TranscriptListener = (text: string) => void;

let chatListener: ChatListener | null = null;
let transcriptListener: TranscriptListener | null = null;

const chatHistory: { role: "user" | "bot"; text: string }[] = [];

// ---------------------------------------------------------------------------
// Two logical channels rendered into the single #hud-transcript element:
//   live      — sticky status: voice "Listening..."/"Recording...", "Thinking..."
//   transient — one-shot flashes (errors) that auto-clear and then reveal `live`
// Display = transient || live. This kills the old clobbering: an error flash
// can't be wiped by voice's onend clear, and "Thinking..." survives a 4 s flash.
// ---------------------------------------------------------------------------
let liveText = "";
let transientText = "";
let transientTimer: ReturnType<typeof setTimeout> | null = null;

// The UIKit font atlas has no emoji / em-dash / smart-quote / ellipsis glyphs
// (they render as tofu boxes). Map the common ones to ASCII, then strip anything
// else non-ASCII (incl. the ⚠ that voice/chat error strings carry). Defined once
// here and reused by every path that feeds the HUD.
function toAscii(s: string): string {
  return s
    .replace(/[—–]/g, "-") // em/en dash
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/…/g, "...") // ellipsis
    .replace(/[^\x00-\x7F]/g, "") // strip remaining non-ASCII (incl. ⚠)
    .replace(/\s+/g, " ")
    .trim();
}

function pushMerged() {
  transcriptListener?.(toAscii(transientText || liveText));
}

export function setChatListener(fn: ChatListener | null) {
  chatListener = fn;
  // Replay history so a late-mounting HUD shows existing exchanges.
  if (fn) for (const m of chatHistory) fn(m.role, m.text);
}

export function setTranscriptListener(fn: TranscriptListener | null) {
  transcriptListener = fn;
}

// Collapse a bot answer's markdown to plain text for the HUD chat surface:
// marked -> HTML -> textContent (drops **bold**, links, list markers, etc.),
// then ASCII-sanitized. The HUD renders full text in a scrollable bubble list,
// so no truncation happens here or downstream.
function mdToPlain(md: string): string {
  const html = marked.parse(md) as string;
  const div = document.createElement("div");
  div.innerHTML = html;
  return toAscii(div.textContent || "");
}

export function mirrorToHud(role: "user" | "bot", text: string) {
  const stored = role === "bot" ? mdToPlain(text) : toAscii(text);
  chatHistory.push({ role, text: stored });
  while (chatHistory.length > 40) chatHistory.shift();
  chatListener?.(role, stored);
}

// Sticky live-channel status (voice states). Empty string clears it.
export function setHudTranscript(text: string) {
  liveText = text;
  pushMerged();
}

// Transient one-shot flash (errors / brief feedback). Auto-clears after `ms`
// (re-armed per call); on clear the live channel underneath is revealed.
export function flashHudStatus(text: string, ms = 4000) {
  transientText = text;
  if (transientTimer) clearTimeout(transientTimer);
  transientTimer = setTimeout(() => {
    transientText = "";
    transientTimer = null;
    pushMerged();
  }, ms);
  pushMerged();
}

// Mirrors the in-flight chat round-trip so VR users (who can't see the DOM
// typing indicator) get feedback that their question was heard. Drives the live
// channel; chat.ts keeps calling this untouched.
export function setHudPending(pending: boolean) {
  liveText = pending ? "Thinking..." : "";
  pushMerged();
}

export function getChatHistory(): readonly { role: "user" | "bot"; text: string }[] {
  return chatHistory;
}
