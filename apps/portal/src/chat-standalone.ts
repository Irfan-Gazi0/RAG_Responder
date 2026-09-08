// Entry point for chat.html — the standalone chat panel embedded by the
// Streamlit "EV Explorer" tab.
//
// Deliberately thin: it calls exactly what src/index.ts calls to wire the
// portal's own panel, so there is one chat client, not two. None of these
// modules import @iwsdk/core, so this bundle is the chat client plus marked —
// not the SDK.
import "./chat-panel.css";

import { initChatBindings } from "./chat.js";
import { initVoiceBindings } from "./voice.js";

initChatBindings();
initVoiceBindings();
