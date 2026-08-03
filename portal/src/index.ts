import {
  FollowBehavior,
  Follower,
  Interactable,
  PanelUI,
  SessionMode,
  World,
} from "@iwsdk/core";

import { initChatBindings } from "./chat.js";
import { initVoiceBindings } from "./voice.js";
import { initVideosphere } from "./videosphere.js";
import { HudSystem } from "./hud.js";
import { PushToTalkSystem } from "./push-to-talk.js";
import { DesktopLookSystem } from "./look-controls.js";
import { flashHudStatus } from "./hud-mirror.js";

// On a Quest there is no console to look at, so a hard failure just reads as
// "the app crashed". Surface it two ways: a [fatal] breadcrumb for the next
// remote-debug session, and a HUD flash so the person wearing the headset can
// report what actually died instead of describing the symptom.
window.addEventListener("error", (e) => {
  console.error("[fatal] uncaught error:", e.message, e.filename, e.lineno);
  flashHudStatus("Error: " + e.message, 8000);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[fatal] unhandled rejection:", e.reason);
});

initChatBindings();
initVoiceBindings();

// layers:true promotes the HUD panel to a WebXR quad layer on the Quest (not in
// the IWER emulator). Suspected (plan2.md H4) of the panel rendering but not
// repainting new chat bubbles on device. If Phase-1 shows the bubble meshes in
// the tree but nothing visible/updating on the headset, flip this to false and
// re-test on the Quest — one-line A/B.
const USE_WEBXR_LAYERS = true;

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
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
    console.error("[fatal] WebGL context lost", e);
    flashHudStatus("Graphics context lost - reload required.", 15000);
  });
  world.renderer.domElement.addEventListener("webglcontextrestored", () => {
    console.error("[fatal] WebGL context restored");
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
