import { sendMessage, setInputValue } from "./chat.js";
import { setHudTranscript } from "./hud-mirror.js";

// Fallback transcription endpoint used when the browser lacks
// SpeechRecognition (Chrome on Linux desktop is the known case).
// Expected n8n contract:
//   POST multipart/form-data with field "audio" (audio/webm or audio/ogg blob)
//   and optional "session_id" string field.
//   Response: JSON with one of { text, transcript, output } containing the
//   transcribed string. n8n side wires this to an OpenAI Whisper node.
// Leave empty to disable the fallback.
const TRANSCRIBE_URL =
  "https://irfangazi.app.n8n.cloud/webhook/transcribe-audio";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const SpeechRecognition: SpeechRecognitionCtor | undefined =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const hasMediaRecorder =
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

const micBtn = document.getElementById("mic-btn") as HTMLButtonElement;
const inputEl = document.getElementById("chat-input") as HTMLTextAreaElement;
const errorEl = document.getElementById("error-banner") as HTMLDivElement;

type Mode = "speech" | "media" | null;

let recognition: SpeechRecognitionLike | null = null;
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let mediaChunks: Blob[] = [];
let isRecording = false;
let activeMode: Mode = null;

export function isVoiceSupported(): boolean {
  return Boolean(SpeechRecognition) || hasMediaRecorder;
}

export function isCurrentlyRecording(): boolean {
  return isRecording;
}

export function stopRecognition() {
  if (!isRecording) return;
  if (activeMode === "speech" && recognition) {
    recognition.stop();
  } else if (activeMode === "media" && mediaRecorder) {
    if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }
}

export function startRecognition(opts: { source?: "vr" | "desktop" } = {}) {
  if (isRecording) return;
  const vrMode = opts.source === "vr";
  if (SpeechRecognition) {
    startSpeechRecognition(vrMode);
  } else if (hasMediaRecorder) {
    startMediaRecording(vrMode);
  }
}

function startSpeechRecognition(vrMode: boolean) {
  activeMode = "speech";
  recognition = new SpeechRecognition!();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  const baseText = vrMode ? "" : inputEl.value.trim();
  let lastTranscript = "";

  recognition.onstart = () => {
    isRecording = true;
    if (vrMode) {
      setHudTranscript("Listening...");
    } else {
      micBtn.classList.add("recording");
      micBtn.title = "Listening… click to stop";
    }
  };

  recognition.onresult = (e) => {
    let transcript = "";
    for (let i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    lastTranscript = transcript.trim();
    if (vrMode) {
      setHudTranscript(lastTranscript || "Listening...");
    } else {
      inputEl.value = [baseText, lastTranscript].filter(Boolean).join(" ");
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
  };

  recognition.onerror = (e) => {
    const msg =
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "⚠ Microphone access denied. Allow mic permissions and try again."
        : `⚠ Voice input error: ${e.error}`;
    showVoiceError(msg, vrMode);
  };

  recognition.onend = () => {
    isRecording = false;
    activeMode = null;
    if (vrMode) {
      setHudTranscript("");
      if (lastTranscript) {
        setInputValue(lastTranscript);
        sendMessage();
      }
    } else {
      micBtn.classList.remove("recording");
      micBtn.title = "Voice input";
      inputEl.focus();
    }
  };

  recognition.start();
}

async function startMediaRecording(vrMode: boolean) {
  if (!TRANSCRIBE_URL) {
    showVoiceError(
      "⚠ Voice input not supported in this browser and no transcription endpoint configured.",
      vrMode,
    );
    return;
  }

  activeMode = "media";
  const baseText = vrMode ? "" : inputEl.value.trim();
  mediaChunks = [];

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    activeMode = null;
    const denied = (err as DOMException).name === "NotAllowedError";
    showVoiceError(
      denied
        ? "⚠ Microphone access denied. Allow mic permissions and try again."
        : `⚠ Microphone error: ${(err as Error).message}`,
      vrMode,
    );
    return;
  }

  // Pick the first MIME type the browser actually supports.
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) mediaChunks.push(e.data);
  };

  mediaRecorder.onstart = () => {
    isRecording = true;
    if (vrMode) {
      setHudTranscript("Recording...");
    } else {
      micBtn.classList.add("recording");
      micBtn.title = "Recording… click to stop";
    }
  };

  mediaRecorder.onerror = (e) => {
    showVoiceError(`⚠ Recorder error: ${(e as ErrorEvent).message || "unknown"}`, vrMode);
  };

  mediaRecorder.onstop = async () => {
    isRecording = false;
    if (vrMode) setHudTranscript("Transcribing...");
    else {
      micBtn.classList.remove("recording");
      micBtn.title = "Transcribing…";
    }

    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;

    const blob = new Blob(mediaChunks, { type: mimeType || "audio/webm" });
    mediaChunks = [];

    try {
      const text = await transcribeBlob(blob);
      if (vrMode) {
        setHudTranscript("");
        if (text) {
          setInputValue(text);
          sendMessage();
        }
      } else {
        inputEl.value = [baseText, text].filter(Boolean).join(" ");
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
        micBtn.title = "Voice input";
        inputEl.focus();
      }
    } catch (err) {
      showVoiceError(`⚠ Transcription failed: ${(err as Error).message}`, vrMode);
      if (!vrMode) {
        micBtn.title = "Voice input";
      }
    } finally {
      activeMode = null;
      mediaRecorder = null;
    }
  };

  mediaRecorder.start();
}

async function transcribeBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  const ext = (blob.type.match(/audio\/(webm|ogg|mp4|wav)/) || [, "webm"])[1];
  fd.append("audio", blob, `recording.${ext}`);
  const sessionId = localStorage.getItem("fr_session_id");
  if (sessionId) fd.append("session_id", sessionId);

  const res = await fetch(TRANSCRIBE_URL, { method: "POST", body: fd });
  if (!res.ok) {
    let detail: Record<string, unknown> = {};
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    const msg = (detail.message as string) || (detail.detail as string) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const payload = Array.isArray(data) && data.length > 0 ? data[0] : data;
  if (typeof payload === "object" && payload !== null) {
    const d = payload as Record<string, unknown>;
    return ((d.text || d.transcript || d.output || "") as string).trim();
  }
  return String(payload).trim();
}

function showVoiceError(msg: string, vrMode: boolean) {
  if (vrMode) {
    setHudTranscript(msg);
  } else {
    errorEl.style.display = "block";
    errorEl.textContent = msg;
  }
}

export function initVoiceBindings() {
  if (!isVoiceSupported()) {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser";
    return;
  }
  micBtn.addEventListener("click", () => {
    if (isRecording) {
      stopRecognition();
      return;
    }
    startRecognition();
  });
}
