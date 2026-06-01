import {
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  VideoTexture,
  BackSide,
  SRGBColorSpace,
  LinearFilter,
  World,
} from "@iwsdk/core";
import Hls from "hls.js";

export interface LectureConfig {
  src: string;
  label: string;
  summary: string;
}

export const VIDEOS: LectureConfig[] = [
  {
    src: "https://d1ni7nkjr0eveg.cloudfront.net/videos/VID_20250912_110210_00_007_009/index.m3u8",
    label: "First Part",
    summary:
      "<strong>First Part — EV emergency-response fundamentals.</strong> " +
      "Classroom intro for first responders: why EV familiarity matters, hybrid vs. " +
      "lithium battery chemistry and why lithium fires run &gt;2,000&deg;F, how high " +
      "voltage is contained (contactors gated by the 12 V system), shutting HV down " +
      "(turn the car off, service disconnect, cut both battery cables, manual " +
      "disconnect), spotting a drive-away &ldquo;ready&rdquo; state, and SAE J2929 " +
      "tool-free cut loops.",
  },
  {
    src: "https://d1ni7nkjr0eveg.cloudfront.net/videos/VID_20250912_122900_00_010_012/index.m3u8",
    label: "Second Part",
    summary:
      "<strong>Second Part — Charging system &amp; HV battery hardware.</strong> " +
      "How to safely disconnect a charger in an emergency — never cut the cable " +
      "(DC fast charging exceeds 400 V) — how to release a locked Level-3 connector, " +
      "and how the high-voltage battery is built: modules, conductor plates, and the " +
      "thermal-transfer material that keeps them cool.",
  },
  {
    src: "https://d1ni7nkjr0eveg.cloudfront.net/videos/VID_20250912_134205_00_013_014/index.m3u8",
    label: "Third Part",
    summary:
      "<strong>Third Part — Battery fire response &amp; disconnects.</strong> " +
      "Thermal-runaway risk from densely packed lithium cells, the &ldquo;let it burn " +
      "out vs. keep cooling&rdquo; decision for battery fires, removing 12 V power for " +
      "extrication, and when to pull the manual disconnect device instead of cutting " +
      "the battery cables (long-term storage / evidence).",
  },
];

let currentVideoIdx = 0;
let activeVideo: HTMLVideoElement | null = null;
let sphereMaterial: MeshBasicMaterial | null = null;

const videoEls: HTMLVideoElement[] = [];
const videoTextures: VideoTexture[] = [];
const hlsInstances: (Hls | true | null)[] = [null, null, null];
const hlsReady: boolean[] = [false, false, false];
const hlsSupported = Hls.isSupported();

export function getActiveVideo(): HTMLVideoElement | null {
  return activeVideo;
}
export function getCurrentVideoIdx(): number {
  return currentVideoIdx;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
export { fmt };

function createHiddenVideoEls() {
  for (let i = 0; i < VIDEOS.length; i++) {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.playsInline = true;
    v.muted = true;
    v.style.display = "none";
    document.body.appendChild(v);
    videoEls.push(v);

    const tex = new VideoTexture(v);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    videoTextures.push(tex);
  }
}

function ensureHls(idx: number, onReady?: () => void) {
  if (hlsReady[idx]) {
    onReady?.();
    return;
  }
  if (hlsInstances[idx]) {
    if (hlsSupported && hlsInstances[idx] instanceof Hls) {
      (hlsInstances[idx] as Hls).once(Hls.Events.MANIFEST_PARSED, () => onReady?.());
    }
    return;
  }
  const src = VIDEOS[idx].src;
  const v = videoEls[idx];
  if (hlsSupported) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      capLevelOnFPSDrop: true,
      maxBufferLength: 20,
      maxMaxBufferLength: 30,
    });
    hlsInstances[idx] = hls;
    hls.loadSource(src);
    hls.attachMedia(v);
    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      hlsReady[idx] = true;
      onReady?.();
    });
  } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
    v.src = src;
    hlsInstances[idx] = true;
    v.addEventListener(
      "loadedmetadata",
      () => {
        hlsReady[idx] = true;
        onReady?.();
      },
      { once: true },
    );
  }
}

export function activatePanorama(idx: number) {
  activeVideo = videoEls[idx];
  activeVideo.muted = false;
  updateMuteButton();
  if (sphereMaterial) {
    sphereMaterial.map = videoTextures[idx];
    sphereMaterial.needsUpdate = true;
  }
  const v = activeVideo;
  ensureHls(idx, async () => {
    try {
      await v.play();
    } catch {
      v.muted = true;
      updateMuteButton();
      try {
        await v.play();
      } catch {
        // give up; user can press Play
      }
    }
    updatePlayButton();
  });
  updatePlayButton();
}

export function switchVideo(idx: number) {
  if (idx === currentVideoIdx) return;
  currentVideoIdx = idx;
  ["btn-vid1", "btn-vid2", "btn-vid3"].forEach((id, i) =>
    document.getElementById(id)!.classList.toggle("active", i === idx),
  );
  updateVideoSummary(idx);
  activatePanorama(idx);
}

function updateVideoSummary(idx: number) {
  document.getElementById("video-summary")!.innerHTML = VIDEOS[idx].summary;
}

function updatePlayButton() {
  const btn = document.getElementById("btn-play");
  if (!btn || !activeVideo) return;
  btn.textContent = activeVideo.paused ? "▶ Play" : "⏸ Pause";
}
function updateMuteButton() {
  const btn = document.getElementById("btn-mute");
  if (!btn || !activeVideo) return;
  btn.textContent = activeVideo.muted ? "🔊 Unmute" : "🔇 Mute";
}

function bindVideoControls() {
  const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
  const btnMute = document.getElementById("btn-mute") as HTMLButtonElement;
  const progressBar = document.getElementById("progress-bar") as HTMLDivElement;
  const progressThumb = document.getElementById("progress-thumb") as HTMLDivElement;
  const timeLabel = document.getElementById("video-time") as HTMLSpanElement;
  const progressWrap = document.getElementById("progress-bar-wrap") as HTMLDivElement;

  btnPlay.addEventListener("click", () => {
    if (!activeVideo) return;
    if (activeVideo.paused) {
      activeVideo.play();
      btnPlay.textContent = "⏸ Pause";
    } else {
      activeVideo.pause();
      btnPlay.textContent = "▶ Play";
    }
  });

  btnMute.addEventListener("click", () => {
    if (!activeVideo) return;
    activeVideo.muted = !activeVideo.muted;
    updateMuteButton();
  });

  let lastTime = -1;
  let lastLabel = "";
  setInterval(() => {
    const v = activeVideo;
    if (!v || !v.duration || isNaN(v.duration)) return;
    if (v.currentTime === lastTime) return;
    lastTime = v.currentTime;
    const pct = (v.currentTime / v.duration) * 100;
    progressBar.style.width = pct + "%";
    progressThumb.style.left = pct + "%";
    const label = `${fmt(v.currentTime)} / ${fmt(v.duration)}`;
    if (label !== lastLabel) {
      lastLabel = label;
      timeLabel.textContent = label;
    }
  }, 250);

  function seekTo(clientX: number) {
    const v = activeVideo;
    if (!v || !v.duration || isNaN(v.duration)) return;
    const rect = progressWrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
    progressBar.style.width = pct * 100 + "%";
    progressThumb.style.left = pct * 100 + "%";
  }

  progressWrap.addEventListener("pointerdown", (e) => {
    progressWrap.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    e.preventDefault();
    e.stopPropagation();
  });
  progressWrap.addEventListener("pointermove", (e) => {
    if (!progressWrap.hasPointerCapture(e.pointerId)) return;
    seekTo(e.clientX);
  });
  progressWrap.addEventListener("pointerup", (e) => {
    progressWrap.releasePointerCapture(e.pointerId);
  });

  document
    .getElementById("btn-vid1")!
    .addEventListener("click", () => switchVideo(0));
  document
    .getElementById("btn-vid2")!
    .addEventListener("click", () => switchVideo(1));
  document
    .getElementById("btn-vid3")!
    .addEventListener("click", () => switchVideo(2));
}

export function initVideosphere(world: World) {
  createHiddenVideoEls();

  sphereMaterial = new MeshBasicMaterial({
    map: videoTextures[0],
    side: BackSide,
  });
  const mesh = new Mesh(new SphereGeometry(100, 64, 32), sphereMaterial);
  mesh.rotation.y = -Math.PI / 2;
  world.createTransformEntity(mesh);

  updateVideoSummary(0);
  bindVideoControls();
  activatePanorama(0);
}
