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

initChatBindings();
initVoiceBindings();

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: false,
    grabbing: false,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
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
