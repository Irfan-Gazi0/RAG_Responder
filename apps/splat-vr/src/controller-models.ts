/**
 * The controllers you are actually holding, rendered in the scene - and lit up
 * on the buttons that do something.
 *
 * Why this exists
 * ---------------
 * Until this module there was NOTHING in this app where the physical controller
 * is. A Quest user got a cyan laser leaving their hand and three labelled rings
 * floating in mid-air, each supposedly circling a button on a device that was
 * not drawn. Every other VR app renders the controller, and the absence is the
 * kind of thing that reads as "the tracking is broken" rather than "the model is
 * missing".
 *
 * The two reasons this was skipped before, and what is done about each
 * ------------------------------------------------------------------
 * 1. THE ASSETS COME FROM A CDN. three's XRControllerModelFactory fetches
 *    webxr-input-profiles from jsdelivr, and its only failure path is
 *    `.catch(console.warn)` - a silent no-model. The Quest 3 profile is now
 *    vendored into public/controllers/ (452 KB, see
 *    scripts/fetch_controller_assets.sh) and served same-origin from the same
 *    CloudFront distribution as the page. The CDN is kept as a second try for
 *    headsets we did not vendor, and a procedural proxy is the third. There is
 *    no path that ends in "nothing in your hand, no explanation".
 *
 * 2. THE GLTF IS LIT AND THIS SCENE WAS NOT. The Touch Plus asset carries a
 *    single MeshStandardMaterial (`controllerMATphongRT`, one baseColorTexture),
 *    so with no lights it renders pure black - which is exactly why
 *    hand-input.ts hand-rolls its joint spheres out of MeshBasicMaterial. main.ts
 *    adds a hemisphere + key light; they touch nothing else in the scene, because
 *    the controller glTFs are the only lit materials in it.
 *
 * WHY THE BUTTONS GLOW RATHER THAN WEARING RINGS
 * ----------------------------------------------
 * This module used to hand controller-hints.ts a MEASURED position and surface
 * normal for each button, so it could park a ring around one. That worked, but a
 * ring is a proxy for the thing it circles: it has to be positioned, oriented,
 * sized, and kept from sinking into the bodywork, and every one of those is a
 * chance to be slightly wrong on hardware nobody has tested. The buttons are
 * already modelled, already exactly where they are, and already the right shape.
 * Lighting the actual mesh is correct by construction on any profile, needs no
 * offsets and no normals, and cannot drift.
 *
 * THE TRAP, and it is a good one: the Touch Plus glTF carries six separate button
 * meshes but they ALL reference material index 0 - after load, ONE shared
 * MeshStandardMaterial instance. Setting `.emissive` on `mesh.material` lights up
 * the ENTIRE CONTROLLER, which looks like a deliberate design choice rather than
 * a bug and would be very easy to ship. Every glowable mesh therefore gets its
 * own `material.clone()` first. Same shader program, so the cost is nil; the
 * headless check asserts the three are distinct instances.
 *
 * Parented to the GRIP space, not the target ray: the grip is the pose of the
 * held device itself, and the profile's asset is authored in exactly that frame.
 * The grip spaces are the same objects controller-hints.ts uses - three caches
 * one per input-source slot - so both modules see the identical Object3D.
 */
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { C } from "./canvas-ui";
import type { InputSources, SlotState } from "./input-sources";
import type { Handedness } from "./vr-input";

/** Vendored profiles, relative to the page (vite base is "./"). */
const LOCAL_PATH = "./controllers";
/** Second try, for a headset whose profile we did not vendor. */
const CDN_PATH =
  "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.20/dist/profiles";

/**
 * How long a connected controller may go without a model before we say so.
 *
 * Not a retry timer - by this point the factory has either resolved or swallowed
 * its own error - it is purely the point at which "you are looking at the grey
 * proxy" stops being a loading state and becomes a reportable fault.
 */
const MODEL_TIMEOUT = 8;

/**
 * How hard a highlighted button burns. `emissiveIntensity` scales the emissive
 * colour, and the base texture under it is nearly black, so this is close to the
 * whole signal - 1.6 reads clearly at hand distance without blooming into a
 * shapeless blob that hides which button it is sitting on.
 */
const GLOW_MAX = 1.6;

/** The one highlight colour, shared with every other in-VR surface. */
const GLOW_COLOR = new Color(C.accent);

/**
 * The named button meshes the Touch profile carries.
 *
 * Only three of them are ever lit (see controller-hints.ts), but the full list is
 * what the headless check asserts the asset still contains: an asset refresh that
 * renames `thumbstick` would otherwise show up as a button that silently stops
 * lighting, in a headset, weeks later. Both hands are listed because the face
 * buttons differ (A/B right, X/Y left) while trigger, squeeze and thumbstick
 * share their names.
 *
 * NO `thumbrest`: the profile declares the component but the asset carries no
 * bare `thumbrest` node to light.
 */
export const BUTTON_NODES: Record<Handedness, readonly string[]> = {
  right: ["trigger", "squeeze", "thumbstick", "a_button", "b_button"],
  left: ["trigger", "squeeze", "thumbstick", "x_button", "y_button"],
};

/**
 * One button's glow state.
 *
 * `materials` are CLONES, never the asset's shared instance - see the header.
 * `baseColors` exists for the placeholder proxy, whose MeshBasicMaterial has no
 * emissive slot at all: there the highlight is a colour lerp instead, so the same
 * call site works whether or not a glTF ever arrived.
 */
export type GlowTarget = {
  materials: Material[];
  baseColors: Color[];
  /** Last applied intensity, so a per-frame call is free when nothing changed. */
  applied: number;
};

type Emissive = Material & { emissive: Color; emissiveIntensity: number };
type Tinted = Material & { color: Color };

function isEmissive(m: Material): m is Emissive {
  return (m as Emissive).emissive instanceof Color;
}

/**
 * Clone the materials under each named node so they can be lit independently.
 *
 * Idempotent per call but NOT cached across calls: XRControllerModelFactory drops
 * and rebuilds the glTF on `disconnected`, so a stale registry would be pointing
 * at materials that are no longer on anything.
 */
export function registerGlow(
  root: Object3D,
  nodes: readonly string[],
): Map<string, GlowTarget> {
  const out = new Map<string, GlowTarget>();
  for (const name of nodes) {
    const node = root.getObjectByName(name);
    if (!node) continue;

    const materials: Material[] = [];
    const baseColors: Color[] = [];
    node.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      // THE WHOLE POINT: every button on this asset shares one material
      // instance, so without the clone the first setGlow lights the controller.
      const cloned = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(
        (m) => m.clone(),
      );
      mesh.material = cloned.length === 1 ? cloned[0] : cloned;
      for (const m of cloned) {
        if (isEmissive(m)) m.emissive.copy(GLOW_COLOR);
        materials.push(m);
        baseColors.push(isTinted(m) ? m.color.clone() : new Color());
      }
    });

    if (materials.length) out.set(name, { materials, baseColors, applied: -1 });
  }
  return out;
}

function isTinted(m: Material): m is Tinted {
  return (m as Tinted).color instanceof Color;
}

/** Drive one button's highlight, 0 (off) to 1 (fully lit). */
export function applyGlow(target: GlowTarget, intensity: number) {
  const v = Math.max(0, Math.min(1, intensity));
  if (Math.abs(v - target.applied) < 0.004) return;
  target.applied = v;
  target.materials.forEach((m, i) => {
    if (isEmissive(m)) {
      m.emissiveIntensity = v * GLOW_MAX;
    } else if (isTinted(m)) {
      // The proxy's unlit bumps: no emissive slot, so lerp the flat colour.
      m.color.copy(target.baseColors[i]).lerp(GLOW_COLOR, v);
    }
  });
}

/** Unlit base colour of the placeholder's button bumps. Named because
 *  registerProxy has to restore it before re-registering - see below. */
const PROXY_BUMP = 0x64748b;

/** The proxy's three lightable bumps, keyed by what they stand in for. */
export type ProxyBumps = { trigger: Mesh; thumbstick: Mesh; secondary: Mesh };

/**
 * The stand-in shown until a glTF arrives, and kept if none ever does.
 *
 * Unlit on purpose: it has to be legible on the frame the controller connects,
 * before anything has had a chance to load, and MeshBasicMaterial cannot be
 * defeated by a lighting mistake. Roughly Touch-shaped in grip space - +Y out of
 * the top face where the thumbstick sits, -Z along the pointing direction.
 *
 * It carries its own three button bumps. That is what finally retires the
 * eyeballed fallback offsets this file's predecessor apologised for: these are
 * positions on geometry WE authored, so they are exact by construction rather
 * than a guess about hardware nobody had measured, and the glow path that runs
 * on the real asset runs here unchanged.
 */
function buildProxy(): { group: Group; bumps: ProxyBumps } {
  const g = new Group();

  const body = new Mesh(
    new CapsuleGeometry(0.021, 0.062, 3, 10),
    new MeshBasicMaterial({ color: 0x2c3444 }),
  );
  body.position.set(0, -0.036, 0.014);
  body.rotation.x = 0.32;
  g.add(body);

  // The top face, where every button the hints label actually lives. Lighter so
  // the proxy reads as two surfaces rather than one flat blob.
  const face = new Mesh(
    new CylinderGeometry(0.028, 0.026, 0.009, 16),
    new MeshBasicMaterial({ color: 0x475569 }),
  );
  face.position.set(0, 0.016, -0.008);
  face.rotation.x = 0.32;
  g.add(face);

  const bump = (r: number, x: number, y: number, z: number) => {
    const m = new Mesh(
      new SphereGeometry(r, 12, 8),
      new MeshBasicMaterial({ color: PROXY_BUMP }),
    );
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  const bumps: ProxyBumps = {
    // On the underside nose, where an index finger rests.
    trigger: bump(0.011, 0, -0.012, -0.052),
    thumbstick: bump(0.012, 0, 0.024, -0.028),
    secondary: bump(0.008, 0.009, 0.021, 0.012),
  };

  return { group: g, bumps };
}

type Slot = {
  grip: Group;
  /** Everything visual for this slot, so one flag hides the lot. */
  holder: Group;
  model: Object3D;
  proxy: Group;
  bumps: ProxyBumps;
  hand: Handedness | null;
  /** True once the glTF scene has been parented under `model`. */
  loaded: boolean;
  /** Children of `model` at the last reconcile - see syncModel(). */
  modelChildren: number;
  /**
   * The material clones registerGlow made for this slot, so re-registering
   * frees the previous set rather than leaking one per connect.
   */
  owned: Material[];
  /** Seconds since this slot connected, for the timeout report. */
  waiting: number;
  reported: boolean;
};

export type ControllerModelsOptions = {
  renderer: WebGLRenderer;
  playerRig: Object3D;
  /** Who is holding what. The only source of connect/disconnect state. */
  inputs: InputSources;
  /** `?controllers=0` - suppress the models entirely for an A/B on device. */
  enabled?: boolean;
  /** Raised when a controller has been connected a long time with no model. */
  onProblem?: (message: string) => void;
};

export class ControllerModels {
  private slots: Slot[] = [];
  private factory: XRControllerModelFactory;
  private enabled: boolean;
  /** Session-level show/hide, ANDed per slot with "is a controller in it". */
  private visible = true;
  private onProblem?: (message: string) => void;
  private glow: Record<Handedness, Map<string, GlowTarget>> = {
    left: new Map(),
    right: new Map(),
  };

  constructor(opts: ControllerModelsOptions) {
    this.enabled = opts.enabled ?? true;
    this.onProblem = opts.onProblem;
    this.factory = new XRControllerModelFactory().setPath(LOCAL_PATH);

    // Preflight the vendored list rather than waiting to discover at connect
    // time that it 404s. Resolves in milliseconds at page load; entering VR
    // takes seconds, and the factory only reads `path` inside its `connected`
    // handler, so the swap is always in place before it matters.
    void fetch(`${LOCAL_PATH}/profilesList.json`, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      })
      .catch(() => {
        this.factory.setPath(CDN_PATH);
      });

    for (let i = 0; i < 2; i++) {
      // Same object controller-hints.ts holds: getGripSpace() caches one Group
      // per input-source slot. Re-parenting to the rig is idempotent and makes
      // this module's correctness independent of construction order.
      const grip = opts.renderer.xr.getControllerGrip(i);
      opts.playerRig.add(grip);

      // Visibility is refreshVisibility()'s job, per slot, at the end of the
      // constructor - a holder starts hidden because a slot starts empty.
      const holder = new Group();
      const { group: proxy, bumps } = buildProxy();
      // createControllerModel registers on the object it is given, so the grip
      // has to be what is passed even though the result is parented deeper.
      const model = this.factory.createControllerModel(grip);
      holder.add(proxy, model);
      grip.add(holder);

      const slot: Slot = {
        grip,
        holder,
        model,
        proxy,
        bumps,
        hand: null,
        loaded: false,
        modelChildren: 0,
        owned: [],
        waiting: 0,
        reported: false,
      };
      this.slots.push(slot);
    }

    opts.inputs.onChange((slots) => this.applySlots(slots));
    this.refreshVisibility();
  }

  // --- slot lifecycle -----------------------------------------------------

  /**
   * Follow the slots. A controller mesh belongs in a hand holding a controller.
   *
   * This replaces a pair of grip listeners that had the same shape as the ones
   * in controller-hints.ts and the same gap: the hand branch hid the placeholder
   * and returned, leaving `loaded`, the glTF under `model` and the glow registry
   * exactly as the departing controller left them. Reading the slot state makes
   * every transition go through one teardown.
   */
  private applySlots(slots: readonly SlotState[]) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const state = slots[i];
      const hand = state?.kind === "controller" ? state.hand : null;
      if (hand === slot.hand) continue;

      this.release(slot);
      slot.hand = hand;
      if (hand) {
        slot.waiting = 0;
        slot.reported = false;
        slot.proxy.visible = true;
        // The proxy is what is on screen for the next few hundred ms, so its
        // bumps have to be lightable before the glTF resolves - otherwise the
        // legend names three buttons and none of them respond.
        this.registerProxy(slot, hand);
      }
    }
    this.refreshVisibility();
  }

  /**
   * Take a slot back to empty, and mean it.
   *
   * three's XRControllerModelFactory cannot be trusted to remove what it added.
   * It holds ONE closure variable for the loaded scene and the load is async:
   *
   *   connected  -> fetchProfile().then(load).then(() => model.add(scene))
   *   disconnected -> model.remove(scene); scene = null
   *
   * Put the controller down before the glTF resolves - which is exactly what a
   * controller-to-hands switch does against a load of a few hundred ms - and the
   * late add() lands on an already-disconnected model with the closure nulled,
   * so no future disconnect can ever remove it. Pick the controller back up and
   * a second clone arrives on top of the first. That is the duplicated,
   * overlapping controller a device tester sees; worse, registerGlow resolves
   * buttons with getObjectByName, which returns the FIRST match, so the
   * highlights light the buried copy and the visible one stays dark.
   *
   * We cannot fix three from here. We can refuse to keep more than one.
   */
  private release(slot: Slot) {
    this.clearModel(slot);
    this.disposeOwned(slot);
    if (slot.hand) this.glow[slot.hand] = new Map();
    slot.hand = null;
    slot.loaded = false;
    slot.proxy.visible = false;
  }

  private clearModel(slot: Slot) {
    // Copy first: remove() splices the live children array.
    for (const child of [...slot.model.children]) slot.model.remove(child);
    slot.modelChildren = 0;
  }

  /**
   * Free the material clones this slot last registered.
   *
   * Only the clones. An asset scene is `asset.scene.clone()`, and three's clone
   * SHARES materials with the cached original, so disposing anything reachable
   * by traversal would break every future controller loaded from the cache.
   * registerGlow's own output is the exact set we made and the only set we may
   * free.
   */
  private disposeOwned(slot: Slot) {
    for (const m of slot.owned) m.dispose();
    slot.owned = [];
  }

  /** Install a freshly-built glow map, freeing the one it replaces. */
  private adopt(slot: Slot, hand: Handedness, map: Map<string, GlowTarget>) {
    // registerGlow has already pointed the meshes at the new clones, so the
    // previous set is unreferenced by the time this runs.
    this.disposeOwned(slot);
    slot.owned = [...map.values()].flatMap((t) => t.materials);
    this.glow[hand] = map;
  }

  private refreshVisibility() {
    // Per slot, not per app: a slot holding a tracked hand has to go dark on its
    // own while the other one may still be holding a controller. setVisible()
    // drove every holder together, so it could not express that.
    for (const s of this.slots) {
      s.holder.visible = this.visible && this.enabled && !!s.hand;
    }
  }

  /**
   * Map the proxy's three bumps onto this hand's real node names.
   *
   * The colour reset is not defensive tidying. registerGlow captures each
   * material's CURRENT colour as the unlit base, and a reconnect re-registers -
   * so a bump that happened to be lit when the controller dropped would have its
   * lit colour recorded as "off" and could never go grey again. The glTF path
   * does not have this problem (emissive is additive, and the base texture is
   * untouched); the proxy's colour lerp does.
   */
  private registerProxy(slot: Slot, hand: Handedness) {
    const secondary = hand === "left" ? "y_button" : "b_button";
    slot.bumps.trigger.name = "trigger";
    slot.bumps.thumbstick.name = "thumbstick";
    slot.bumps.secondary.name = secondary;
    for (const b of [slot.bumps.trigger, slot.bumps.thumbstick, slot.bumps.secondary]) {
      (b.material as MeshBasicMaterial).color.setHex(PROXY_BUMP);
    }
    // The proxy's other two meshes are deliberately unnamed, so a lookup by name
    // cannot reach the body or the face plate.
    this.adopt(slot, hand, registerGlow(slot.proxy, ["trigger", "thumbstick", secondary]));
  }

  /**
   * Light a button, 0 to 1. Safe to call every frame and before anything has
   * loaded: an unregistered node is a no-op, and applyGlow short-circuits when
   * the value has not moved.
   */
  setGlow(hand: Handedness, node: string, intensity: number) {
    const t = this.glow[hand].get(node);
    if (t) applyGlow(t, intensity);
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.refreshVisibility();
  }

  update(dt: number) {
    if (!this.enabled) return;
    for (const slot of this.slots) {
      if (!slot.hand) continue;

      this.syncModel(slot);

      if (!slot.loaded) {
        slot.waiting += dt;
        if (slot.waiting > MODEL_TIMEOUT && !slot.reported) {
          slot.reported = true;
          this.onProblem?.(
            "Controller model did not load - showing a placeholder. " +
              "The button highlights are on the placeholder instead.",
          );
        }
      }
    }
  }

  /**
   * Reconcile what the factory has put under this slot's model.
   *
   * The factory offers no "loaded" signal and no per-controller callback, so the
   * arrival of a child IS the signal. This used to be a bare
   * `children.length > 0` test, which is true of a stale orphan as readily as of
   * the live asset - so after the race described on release() it would latch
   * onto the leftover on the first frame after reconnect and register the glow
   * against a mesh buried under the one actually being drawn.
   *
   * Comparing against the remembered count instead makes a SECOND arrival
   * visible as an event, and the factory only ever appends, so the newest child
   * is the live one and anything before it is an orphan. One integer compare per
   * controller per frame buys the invariant that a slot draws exactly one model.
   */
  private syncModel(slot: Slot) {
    const n = slot.model.children.length;
    if (n === slot.modelChildren) return;

    if (n > 1) {
      for (const stale of slot.model.children.slice(0, n - 1)) slot.model.remove(stale);
    }
    slot.modelChildren = slot.model.children.length;

    if (slot.modelChildren === 0) {
      // The factory dropped the asset without the slot changing hands. Fall back
      // to the placeholder rather than leaving an empty holder and three button
      // names with nothing to light.
      slot.loaded = false;
      slot.proxy.visible = true;
      if (slot.hand) this.registerProxy(slot, slot.hand);
      return;
    }

    slot.loaded = true;
    slot.proxy.visible = false;
    if (slot.hand) {
      this.adopt(slot, slot.hand, registerGlow(slot.model, BUTTON_NODES[slot.hand]));
    }
  }

  /**
   * Stand in for the factory parenting a loaded asset, so the prune can be
   * asserted without a headset.
   *
   * The real arrival needs a controller `connected` event on the grip, which no
   * headless browser produces - and the defect being guarded against is
   * precisely an EXTRA arrival, which even a real device only manages on a race
   * between an async glTF load and a controller being put down. So the check
   * drives the one input syncModel actually reads: a child appearing under
   * `model`. It is deliberately a proxy group rather than a bare Object3D, so
   * the glow re-registration on the far side of the prune is exercised too.
   */
  simulateAssetArrival(index: number) {
    const slot = this.slots[index];
    if (!slot) return;
    const { group, bumps } = buildProxy();
    bumps.trigger.name = "trigger";
    bumps.thumbstick.name = "thumbstick";
    bumps.secondary.name = slot.hand === "left" ? "y_button" : "b_button";
    slot.model.add(group);
  }

  /**
   * What the headless handover check reads back.
   *
   * `modelChildren` is the one that matters: it is the assertion that three's
   * factory race cannot put two overlapping controllers in one hand again.
   */
  slotStates() {
    return this.slots.map((s) => ({
      hand: s.hand,
      holderVisible: s.holder.visible,
      proxyVisible: s.proxy.visible,
      loaded: s.loaded,
      modelChildren: s.model.children.length,
      glowNodes: s.hand ? this.glow[s.hand].size : 0,
    }));
  }
}

/**
 * What the headless check can see of all this without an XR session.
 *
 * Everything above only runs once a real controller connects, which no headless
 * browser will ever do - so the parts that CAN silently rot without a headset are
 * pulled out here and driven by scripts/vr_check.mjs through the ?dev=1 seam:
 * does the vendored path resolve, does the asset still carry the node names the
 * legend names, does every one of them resolve to real geometry, and - the one
 * that matters - does registerGlow actually give each button its own material
 * instead of lighting the whole controller through the shared one.
 *
 * It deliberately uses the same LOCAL_PATH, the same BUTTON_NODES and the same
 * registerGlow()/applyGlow() as the runtime, so a check that passes is evidence
 * about the real path rather than about a parallel implementation of it.
 */
export type ControllerProbe = {
  /** Profile ids in the vendored profilesList.json. */
  profiles: string[];
  /** The id whose asset was loaded. */
  profileId: string | null;
  /** BUTTON_NODES entries the asset does not carry. */
  missingNodes: string[];
  /** Named nodes that resolved but carry no drawable geometry. */
  emptyNodes: string[];
  /** Distinct material instances across the lit buttons - must equal their count. */
  distinctMaterials: number;
  glowNodes: number;
  /** Emissive intensity of one button at glow 0 and glow 1. */
  glowOff: number;
  glowOn: number;
  /** Did lighting one button leave the shared body mesh alone? */
  bodyUnlit: boolean;
  /** Meshes in the placeholder, so an emptied proxy fails rather than vanishes. */
  proxyMeshes: number;
  /** The placeholder's lightable bumps, by the node name each stands in for. */
  proxyBumps: string[];
  /** Distinct material types in the asset. Lit ones need lights in the scene. */
  materials: string[];
  error: string | null;
};

export async function probeControllerAssets(
  hand: Handedness = "right",
): Promise<ControllerProbe> {
  let proxyMeshes = 0;
  const { group: proxy, bumps } = buildProxy();
  proxy.traverse((o) => {
    if ((o as Mesh).isMesh) proxyMeshes++;
  });
  // Exercise the proxy's own glow path, which is what runs when no profile
  // matches the headset - the case with no glTF to fall back on.
  const secondary = hand === "left" ? "y_button" : "b_button";
  bumps.trigger.name = "trigger";
  bumps.thumbstick.name = "thumbstick";
  bumps.secondary.name = secondary;
  const proxyGlow = registerGlow(proxy, ["trigger", "thumbstick", secondary]);

  const out: ControllerProbe = {
    profiles: [],
    profileId: null,
    missingNodes: [],
    emptyNodes: [],
    distinctMaterials: 0,
    glowNodes: 0,
    glowOff: 0,
    glowOn: 0,
    bodyUnlit: false,
    proxyMeshes,
    proxyBumps: [...proxyGlow.keys()],
    materials: [],
    error: null,
  };

  try {
    const listRes = await fetch(`${LOCAL_PATH}/profilesList.json`);
    if (!listRes.ok) throw new Error(`profilesList.json: HTTP ${listRes.status}`);
    const list = (await listRes.json()) as Record<string, { path: string }>;
    out.profiles = Object.keys(list);
    const id = out.profiles[0];
    if (!id) throw new Error("profilesList.json is empty");
    out.profileId = id;

    const profRes = await fetch(`${LOCAL_PATH}/${list[id].path}`);
    if (!profRes.ok) throw new Error(`${list[id].path}: HTTP ${profRes.status}`);
    const profile = (await profRes.json()) as {
      layouts: Record<string, { assetPath: string }>;
    };
    const assetPath = profile.layouts[hand]?.assetPath;
    if (!assetPath) throw new Error(`profile has no ${hand} layout`);

    const gltf = await new GLTFLoader().loadAsync(`${LOCAL_PATH}/${id}/${assetPath}`);

    const mats = new Set<string>();
    gltf.scene.traverse((o) => {
      const m = (o as Mesh).material;
      if (m) for (const one of Array.isArray(m) ? m : [m]) mats.add(one.type);
    });
    out.materials = [...mats];

    const names = BUTTON_NODES[hand];
    out.missingNodes = names.filter((n) => !gltf.scene.getObjectByName(n));
    out.emptyNodes = names.filter((n) => {
      const node = gltf.scene.getObjectByName(n);
      if (!node) return false;
      let verts = 0;
      node.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) verts += mesh.geometry?.getAttribute("position")?.count ?? 0;
      });
      return verts === 0;
    });

    // The body shares material index 0 with every button, so it is the witness:
    // if the clone did not happen, lighting one button lights this too.
    const body = gltf.scene.getObjectByName("controller_mesh") as Mesh | undefined;
    const bodyMat = body ? (Array.isArray(body.material) ? body.material[0] : body.material) : null;

    const reg = registerGlow(gltf.scene, names);
    out.glowNodes = reg.size;
    out.distinctMaterials = new Set([...reg.values()].flatMap((t) => t.materials)).size;

    const one = reg.get("thumbstick");
    if (one) {
      applyGlow(one, 0);
      out.glowOff = (one.materials[0] as Emissive).emissiveIntensity ?? 0;
      applyGlow(one, 1);
      out.glowOn = (one.materials[0] as Emissive).emissiveIntensity ?? 0;
    }
    out.bodyUnlit =
      !!bodyMat && (!isEmissive(bodyMat) || bodyMat.emissiveIntensity * bodyMat.emissive.r === 0);
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }
  return out;
}
