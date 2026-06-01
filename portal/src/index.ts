import {
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
      maxWidth: 1.8,
    })
    .addComponent(Interactable);

  // World-space position: in front of viewer at comfortable eye level.
  hudEntity.object3D!.position.set(0, 1.45, -1.6);
  // Hidden until XR starts (HudSystem toggles on visibilityState).
  hudEntity.object3D!.visible = false;

  world.registerSystem(HudSystem).registerSystem(PushToTalkSystem);
});
