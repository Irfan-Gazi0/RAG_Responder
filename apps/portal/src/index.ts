import {
  FollowBehavior,
  Follower,
  Interactable,
  PanelUI,
  SessionMode,
  World,
} from "@iwsdk/core";

// The chat panel's styling, shared verbatim with the standalone chat.html.
import "./chat-panel.css";

import { initChatBindings } from "./chat.js";
import { cancelRecording, initVoiceBindings } from "./voice.js";
import { initVideosphere, suspendPlayback } from "./videosphere.js";
import { HudSystem, setRendererProbe } from "./hud.js";
import { PushToTalkSystem } from "./push-to-talk.js";
import { DesktopLookSystem } from "./look-controls.js";
import { flashHudStatus, isImmersive, setImmersive } from "./hud-mirror.js";
import { archivePreviousRun, crumb, installCrumbsInspector } from "./breadcrumbs.js";

// Rotate the previous run's breadcrumbs into the archive BEFORE anything else
// can log, so run boundaries stay clean. This is a silent forensic buffer now —
// read it with `frCrumbs()` from a console (on a Quest, via chrome://inspect).
archivePreviousRun();
installCrumbsInspector();
crumb("boot", navigator.userAgent);

// On a Quest there is no console to look at, so a hard failure just reads as
// "the app crashed". Surface it two ways: a breadcrumb (persisted, so it
// survives the tab dying) and a HUD flash so the person wearing the headset can
// report what actually died instead of describing the symptom.
//
// The guard is load-bearing, not defensive padding. flashHudStatus() reaches
// into UIKit via the transcript listener; if that throws, the exception escapes
// this listener and the browser reports it right back to 'error' -> this handler
// runs again -> unbounded recursion -> the renderer hangs and the tab is killed,
// with nothing logged. That is one of the shapes the reported crash can take.
let inErrorHandler = false;
window.addEventListener("error", (e) => {
  if (inErrorHandler) return;
  inErrorHandler = true;
  try {
    crumb("fatal", "uncaught error:", e.message, `${e.filename}:${e.lineno}`);
    try {
      flashHudStatus("Error: " + e.message, 8000);
    } catch {
      /* HUD not up (or is itself the thing that died) - the crumb is the record */
    }
  } finally {
    inErrorHandler = false;
  }
});
window.addEventListener("unhandledrejection", (e) => {
  crumb("fatal", "unhandled rejection:", e.reason);
});

// Nothing this page starts should outlive the page being put away. Left running,
// the 4K lecture keeps decoding with audio and an in-flight push-to-talk keeps
// the microphone open — which is what a headset reports back as the site still
// running in the background, and what makes the tab awkward to close.
//
// `pagehide` rather than `beforeunload`: the latter is not fired reliably on
// mobile/standalone browsers (the Quest Browser included) and blocks bfcache.
function releaseBackgroundWork(reason: string) {
  crumb("lifecycle", "releasing background work:", reason);
  suspendPlayback();
  cancelRecording();
}
window.addEventListener("visibilitychange", () => {
  // Guarded on the immersive flag, not just document.hidden. An immersive
  // session goes on rendering through the headset while the flat document can
  // report itself hidden (and does, on some Quest Browser builds, the moment the
  // 2D panel is dismissed) — pausing there would stop the lecture at exactly the
  // point someone put the headset on. Taking the headset off mid-session is a
  // blur, not an exit, so this stays hands-off there too and playback is still
  // running when they put it back on.
  if (document.hidden && !isImmersive()) releaseBackgroundWork("tab hidden");
});
window.addEventListener("pagehide", () => releaseBackgroundWork("pagehide"));

initChatBindings();
initVoiceBindings();

// Promotes the HUD panel to a WebXR quad layer on the Quest (ignored by the IWER
// emulator): the panel is composited at native resolution instead of being
// resampled through the eye buffer, which is what keeps small HUD text legible.
// Was briefly suspected in the answer-render crash and cleared — that was the
// Quest Browser's overlay keyboard (see focusInput() in chat.ts).
const USE_WEBXR_LAYERS = true;

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    // NOT "always". That mode calls navigator.xr.offerSession() at load and
    // RE-OFFERS on every session end (@iwsdk/core init/world-initializer.js
    // manageOfferFlow), so the page never leaves the immersive-eligible state —
    // exiting VR was reported back as "the immersive environment is still
    // running in the background", and the tab would not close cleanly. Its offer
    // promise also has no .catch, so an offer aborted by our own
    // requestSession() escapes as an unhandled rejection.
    //
    // We don't need it: entry is the Enter VR button in the video bar and its
    // twin on the in-VR HUD, both gated on the isSessionSupported probe in
    // hud.ts. Do not "restore" this to the SDK default.
    //
    // Dev is the exception, and only for tooling: IWER grants requestSession()
    // directly, so the buttons work either way, but `npx iwsdk xr enter` /
    // xr_accept_session can only accept an OFFERED session and fails with "No
    // session has been offered" without this. "once" rather than "always", so
    // the re-offer loop is gone in dev too. Nothing is lost by the split —
    // IWER's offerSession() is a stub that stores the config and never settles
    // (iwer/lib/initialization/XRSystem.js), so the emulator cannot exercise
    // this behaviour in either direction; only a Quest can.
    offer: import.meta.env.DEV ? "once" : "none",
    features: { handTracking: true, layers: USE_WEBXR_LAYERS },
  },
  features: {
    locomotion: false,
    grabbing: false,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  // GPU-side death is the leading hypothesis for the Quest crash (glyph instance
  // buffers + a 4K360 video texture). A lost context is silent otherwise: the
  // canvas simply stops updating.
  world.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    crumb("fatal", "WebGL context lost", (e as Event).type);
    flashHudStatus("Graphics context lost - reload required.", 15000);
  });
  world.renderer.domElement.addEventListener("webglcontextrestored", () => {
    crumb("fatal", "WebGL context restored");
  });

  // Second, INDEPENDENT source of truth for the in-XR flag. HudSystem also sets
  // it from world.visibilityState, but getting this wrong kills the entire Meta
  // Quest Browser process (see focusInput() in chat.ts), so the guard does not
  // hang off a single subscription that a HUD init failure could silently take
  // out. These come straight off the WebXR session lifecycle.
  world.renderer.xr.addEventListener("sessionstart", () => {
    setImmersive(true);
    crumb("xr", "session start");
  });
  world.renderer.xr.addEventListener("sessionend", () => {
    setImmersive(false);
    // A push-to-talk release can no longer reach us: PushToTalkSystem reads it
    // off the right controller's gamepad, and that gamepad is already gone. If
    // the session ended mid-press, this is the only thing that closes the mic.
    cancelRecording();
    crumb("xr", "session end");
  });

  // The renderer is the only handle on GPU-side resource counts, and the crash
  // hypothesis is a GPU budget blowout. Hand it to the HUD so appendBubble can
  // record textures/geometries at the exact moment an answer is built.
  setRendererProbe(() => {
    const mem = world.renderer.info.memory;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } })
      .memory?.usedJSHeapSize;
    return {
      geometries: mem.geometries,
      textures: mem.textures,
      triangles: world.renderer.info.render.triangles,
      heapMB: heap ? Math.round(heap / 1048576) : -1,
    };
  });

  initVideosphere(world);

  const hudEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "./ui/hud.json",
      maxHeight: 1.0,
      // ~1.3 m wide at the 1.4 m follow distance ≈ 50° of arc — the comfort
      // ceiling for a single panel (wider forces eye/neck strain).
      maxWidth: 1.3,
    })
    .addComponent(Interactable)
    // Body-locked lazy-follow: the panel trails the user's gaze with lag and
    // settles ~1.4 m ahead at eye level, re-centering only after they turn
    // past maxAngle. This is the comfortable alternative to v1's rigid
    // head-lock (which Meta flags as a nausea/occlusion anti-pattern).
    .addComponent(Follower, {
      target: world.player.head,
      offsetPosition: [0, -0.2, -1.4],
      behavior: FollowBehavior.PivotY, // yaw only — no pitch/roll tilt
      maxAngle: 30, // deg of gaze slack before it slides back to center
      tolerance: 0.4, // m of positional slack before catching up
      speed: 3, // lerp speed (soft follow, not a hard snap)
    });

  // Hidden until XR starts (HudSystem toggles on visibilityState). FollowSystem
  // positions it relative to the head, so no static world position is set.
  hudEntity.object3D!.visible = false;

  world
    .registerSystem(HudSystem)
    .registerSystem(PushToTalkSystem)
    .registerSystem(DesktopLookSystem);
});
