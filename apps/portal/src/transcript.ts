// The conversation, as shared state across every document on this origin.
//
// Two pages render this chat: the portal (index.html, chat panel beside the
// 360 video) and the standalone panel (chat.html, the EV Explorer tab's
// iframe). They used to be two unrelated clients with DOM-only message lists,
// so the same person asking a question in one tab found an empty panel in the
// other — while the n8n agent, keyed on the shared session_id, remembered the
// whole exchange. The transcript lives here so the UI matches what the
// assistant already knows.
//
// localStorage rather than sessionStorage: both panels are iframes on the
// Streamlit page, same CloudFront origin, so a plain `storage` event syncs them
// live with no postMessage plumbing. Every access is guarded — a browser with
// site data blocked must still render a working (just non-persistent) panel.

const TRANSCRIPT_KEY = "fr_transcript";
const SESSION_KEY = "fr_session_id";

// Answers run long (ERG tables, bulleted protocols). 60 messages is a couple of
// hours of use and stays far under the 5 MB quota; older turns fall off the top,
// which costs nothing since the agent's own memory is server-side.
const MAX_MESSAGES = 60;

export type Role = "user" | "bot";
export interface Message {
  role: Role;
  text: string;
}

export function loadTranscript(): Message[] {
  try {
    const raw = localStorage.getItem(TRANSCRIPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        !!m &&
        typeof m.text === "string" &&
        (m.role === "user" || m.role === "bot"),
    );
  } catch {
    return [];
  }
}

export function appendMessage(role: Role, text: string) {
  try {
    const messages = loadTranscript();
    messages.push({ role, text });
    localStorage.setItem(
      TRANSCRIPT_KEY,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    /* quota or blocked storage - the in-page DOM is still correct */
  }
}

export function clearTranscript() {
  try {
    localStorage.removeItem(TRANSCRIPT_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Read on every send, never cached in a module const.
 *
 * Clearing rotates this id, and the rotation can happen in the OTHER panel.
 * A `const SESSION_ID = ...` evaluated at import time would keep posting the
 * dead id from whichever page happened to be open first, so a "cleared"
 * conversation would come back the moment you asked from that tab.
 */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // No storage: still send a stable id for this document, so multi-turn
    // context works within the page even though it can't be shared.
    return (fallbackSessionId ??= crypto.randomUUID());
  }
}
let fallbackSessionId: string | undefined;

/**
 * New session id, so the n8n Postgres Chat Memory (keyed on session_id) starts
 * empty too. Clearing only the bubbles would leave the assistant able to quote
 * a conversation the user believes they deleted.
 */
export function rotateSessionId() {
  try {
    localStorage.setItem(SESSION_KEY, crypto.randomUUID());
  } catch {
    fallbackSessionId = crypto.randomUUID();
  }
}

/**
 * Fires when ANOTHER document on this origin changes the transcript — which is
 * exactly the other iframe on the Streamlit page. `storage` never fires in the
 * document that made the change, so this cannot loop back on itself.
 */
export function subscribeToTranscript(onChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    // key === null is localStorage.clear() from elsewhere; treat it as a change.
    if (e.key === null || e.key === TRANSCRIPT_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
