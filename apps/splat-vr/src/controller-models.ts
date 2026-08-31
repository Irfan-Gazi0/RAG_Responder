/**
 * The controllers you are actually holding, rendered in the scene.
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
 * It also makes the guidance honest. controller-hints.ts anchors its rings at
 * offsets that its own comment describes as "eyeballed to the hardware, not
 * measured off a model" - because there was no model to measure. There is one
 * now, and the glTF carries NAMED BUTTON NODES (`trigger`, `thumbstick`,
 * `a_button`/`x_button`, `b_button`/`y_button`, `squeeze`, `thumbrest`), so
 * `measureAnchors()` below turns those guesses into measurements.
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
 *    now adds a hemisphere + key light; they touch nothing else in the scene,
 *    because the controller glTFs are the only lit materials in it.
 *
 * Parented to the GRIP space, not the target ray: the grip is the pose of the
 * held device itself, and the profile's asset is authored in exactly that frame.
 * The grip spaces are the same objects controller-hints.ts uses - three caches
 * one per input-source slot - so both modules see the identical Object3D.
 */
import {
  Box3,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
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
 * The glTF nodes the callouts anchor to, and where to find each one's press
 * extents.
 *
 * `node` holds the button's mesh. `extents` is the prefix of the
 * `<extents>_pressed_min` / `_pressed_max` pair that the profile's visual
 * response interpolates between - which, for a button that presses straight in,
 * is a free and exact surface normal (see measureAnchors). The prefix is spelled
 * out rather than derived because it is `xr_standard_thumbstick` for the stick
 * and a bare `a_button` for the face buttons, and guessing that from the node
 * name is the kind of rule that silently stops matching on the next asset
 * refresh.
 *
 * Both hands are listed because the face buttons differ (A/B right, X/Y left)
 * while trigger, squeeze and thumbstick share their names.
 *
 * NO `thumbrest`: the profile declares the component and the asset carries
 * `thumbrest_pressed_*`, but there is no bare `thumbrest` node to anchor to. A
 * name absent from the asset yields no measurement and the caller keeps its
 * authored fallback - and the headless check asserts this list is fully
 * satisfied, so a permanently-missing entry would mask a genuinely renamed one.
 */
export type ButtonNode = { node: string; extents: string };

export const BUTTON_NODES: Record<Handedness, readonly ButtonNode[]> = {
  right: [
    { node: "trigger", extents: "xr_standard_trigger" },
    { node: "squeeze", extents: "xr_standard_squeeze" },
    { node: "thumbstick", extents: "xr_standard_thumbstick" },
    { node: "a_button", extents: "a_button" },
    { node: "b_button", extents: "b_button" },
  ],
  left: [
    { node: "trigger", extents: "xr_standard_trigger" },
    { node: "squeeze", extents: "xr_standard_squeeze" },
    { node: "thumbstick", extents: "xr_standard_thumbstick" },
    { node: "x_button", extents: "x_button" },
    { node: "y_button", extents: "y_button" },
  ],
};

/** Where a button is, and which way it faces - both in grip-local metres. */
export type ButtonAnchor = {
  position: Vector3;
  /** Outward surface normal, or null when the asset cannot supply one. */
  normal: Vector3 | null;
};

/**
 * Measure the buttons off a loaded controller model, in GRIP-LOCAL metres - the
 * frame controller-hints authors its fallback offsets in.
 *
 * POSITION IS THE BOUNDING-BOX CENTRE, NOT THE NODE ORIGIN. Every button here is
 * a separate mesh hung under an animation pivot
 * (`root > xr_standard_trigger_pressed_value > trigger`), and the pivots are
 * placed so the child's local transform cancels back to near the model origin -
 * the real position lives in the mesh's vertex data. Reading the matrixWorld
 * translation returns very nearly the SAME point for the trigger, the thumbstick
 * and the face button, stacking all three callout rings in the middle of the
 * controller. That failure looks entirely plausible in a number dump - every
 * value lands a couple of centimetres from the eyeballed fallback, so a
 * "close to the authored guess" assertion passes it happily - which is why
 * vr_check also asserts the anchors are mutually DISTINCT.
 *
 * NORMAL COMES FROM THE PRESS EXTENTS. `<extents>_pressed_min` minus
 * `_pressed_max` is the vector the cap travels when pressed, so its negation is
 * the outward surface normal, exact and free. It agrees to within a degree with
 * a plane fitted through the three top-face buttons, and it says the top face is
 * tilted about 37 degrees forward of grip +Y - which the hand-authored ringPitch
 * of -PI/2 (straight up) had no way of knowing. Buttons animated by ROTATION
 * rather than translation - the trigger and the squeeze, both hinged levers -
 * ship identical min and max, so they yield no normal and keep their authored
 * pitch.
 *
 * Pose-independent despite going through world space: Box3.setFromObject
 * refreshes the whole chain including `grip`, and grip.matrixWorld then cancels
 * exactly between the two sides of the conversion. Correct whether or not a
 * frame has been presented, which is what lets the headless check drive it
 * against a detached grip.
 */
export function measureAnchors(
  model: Object3D,
  grip: Object3D,
  nodes: readonly ButtonNode[],
): Map<string, ButtonAnchor> {
  const out = new Map<string, ButtonAnchor>();
  const box = new Box3();

  /** A node's position expressed in grip-local metres. */
  const local = (o: Object3D) => {
    o.updateWorldMatrix(true, false);
    return grip.worldToLocal(new Vector3().setFromMatrixPosition(o.matrixWorld));
  };

  for (const spec of nodes) {
    const node = model.getObjectByName(spec.node);
    if (!node) continue;

    box.setFromObject(node);
    // An empty pivot with no geometry under it yields an inverted box; fall back
    // to its origin rather than emitting an Infinity.
    const position = box.isEmpty()
      ? local(node)
      : grip.worldToLocal(box.getCenter(new Vector3()));

    let normal: Vector3 | null = null;
    const min = model.getObjectByName(`${spec.extents}_pressed_min`);
    const max = model.getObjectByName(`${spec.extents}_pressed_max`);
    if (min && max) {
      // Both sides converted before subtracting, so the direction picks up the
      // grip's rotation without anyone having to extract a basis by hand.
      const travel = local(min).sub(local(max));
      // A hinged button ships min === max; 0.1 mm is well under the ~0.9 mm of
      // real travel and well over float noise.
      if (travel.lengthSq() > 1e-8) normal = travel.normalize();
    }

    out.set(spec.node, { position, normal });
  }
  return out;
}

/**
 * The stand-in shown until a glTF arrives, and kept if none ever does.
 *
 * Unlit on purpose: it has to be legible on the frame the controller connects,
 * before anything has had a chance to load, and MeshBasicMaterial cannot be
 * defeated by a lighting mistake. Roughly Touch-shaped in grip space - +Y out of
 * the top face where the thumbstick sits, -Z along the pointing direction - so
 * the hint rings land somewhere plausible on it rather than in free air.
 */
function buildProxy(): Group {
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

  return g;
}

type Slot = {
  grip: Group;
  /** Everything visual for this slot, so one flag hides the lot. */
  holder: Group;
  model: Object3D;
  proxy: Group;
  hand: Handedness | null;
  /** True once the glTF scene has been parented under `model`. */
  loaded: boolean;
  /** Seconds since this slot connected, for the timeout report. */
  waiting: number;
  reported: boolean;
};

export type ControllerModelsOptions = {
  renderer: WebGLRenderer;
  playerRig: Object3D;
  /** `?controllers=0` - suppress the models entirely for an A/B on device. */
  enabled?: boolean;
  /** Raised when a controller has been connected a long time with no model. */
  onProblem?: (message: string) => void;
};

export class ControllerModels {
  private slots: Slot[] = [];
  private factory: XRControllerModelFactory;
  private enabled: boolean;
  private onProblem?: (message: string) => void;
  private readyCbs: ((hand: Handedness, model: Object3D) => void)[] = [];
  private anchors: Record<Handedness, Map<string, ButtonAnchor>> = {
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

      const holder = new Group();
      holder.visible = this.enabled;
      const proxy = buildProxy();
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
        hand: null,
        loaded: false,
        waiting: 0,
        reported: false,
      };
      this.slots.push(slot);

      grip.addEventListener("connected", (event) => {
        const src = (event as unknown as { data?: XRInputSource }).data;
        // A tracked hand has a grip space too. hand-input.ts draws those; a
        // controller mesh floating inside someone's palm would be worse than
        // nothing.
        if (!src || src.hand) {
          slot.hand = null;
          slot.proxy.visible = false;
          return;
        }
        slot.hand = src.handedness === "left" || src.handedness === "right" ? src.handedness : null;
        slot.waiting = 0;
        slot.reported = false;
        slot.proxy.visible = !slot.loaded;
      });

      grip.addEventListener("disconnected", () => {
        // The factory drops the glTF from `model` on this same event, so the
        // proxy has to come back or the next connect shows an empty holder.
        slot.hand = null;
        slot.loaded = false;
        slot.proxy.visible = false;
      });
    }
  }

  /** Fired once per hand, the frame its glTF becomes measurable. */
  onReady(cb: (hand: Handedness, model: Object3D) => void) {
    this.readyCbs.push(cb);
  }

  /** A measured button in grip-local metres, or null if unavailable. */
  buttonAnchor(hand: Handedness, node: string): ButtonAnchor | null {
    const a = this.anchors[hand].get(node);
    if (!a) return null;
    return { position: a.position.clone(), normal: a.normal?.clone() ?? null };
  }

  setVisible(v: boolean) {
    for (const s of this.slots) s.holder.visible = v && this.enabled;
  }

  update(dt: number) {
    if (!this.enabled) return;
    for (const slot of this.slots) {
      if (!slot.hand) continue;

      if (!slot.loaded) {
        // The factory offers no "loaded" signal and no per-controller callback,
        // so detect the glTF by its arrival under the model. One property read
        // per controller per frame, and only until it lands.
        if (slot.model.children.length > 0) {
          slot.loaded = true;
          slot.proxy.visible = false;
          const names = BUTTON_NODES[slot.hand];
          this.anchors[slot.hand] = measureAnchors(slot.model, slot.grip, names);
          for (const cb of this.readyCbs) cb(slot.hand, slot.model);
        } else {
          slot.waiting += dt;
          if (slot.waiting > MODEL_TIMEOUT && !slot.reported) {
            slot.reported = true;
            this.onProblem?.(
              "Controller model did not load - showing a placeholder. " +
                "Button callouts are using their authored positions.",
            );
          }
        }
      }
    }
  }
}

/**
 * What the headless check can see of all this without an XR session.
 *
 * Everything above only runs once a real controller connects, which no headless
 * browser will ever do - so the parts that CAN silently rot without a headset
 * are pulled out here and driven by scripts/vr_check.mjs through the ?dev=1
 * seam: does the vendored path resolve, does the asset still carry the node
 * names the hints anchor to, and does the world->grip-local conversion produce
 * numbers anywhere near the offsets that were eyeballed off the hardware.
 *
 * It deliberately uses the same LOCAL_PATH, the same BUTTON_NODES and the same
 * measureAnchors() as the runtime, so a check that passes is evidence about the
 * real path rather than about a parallel implementation of it.
 */
export type ControllerProbe = {
  /** Profile ids in the vendored profilesList.json. */
  profiles: string[];
  /** The id whose asset was loaded. */
  profileId: string | null;
  /** BUTTON_NODES entries the asset does not carry. */
  missingNodes: string[];
  /** Measured grip-local positions, metres, by node name. */
  anchors: Record<string, [number, number, number]>;
  /** Measured outward normals, grip-local, by node name. Absent when derived
   *  from a hinged button whose press extents do not translate. */
  normals: Record<string, [number, number, number]>;
  /** Meshes in the placeholder, so an emptied proxy fails rather than vanishes. */
  proxyMeshes: number;
  /** Distinct material types in the asset. Lit ones need lights in the scene. */
  materials: string[];
  error: string | null;
};

export async function probeControllerAssets(
  hand: Handedness = "right",
): Promise<ControllerProbe> {
  let proxyMeshes = 0;
  buildProxy().traverse((o) => {
    if ((o as Mesh).isMesh) proxyMeshes++;
  });
  const out: ControllerProbe = {
    profiles: [],
    profileId: null,
    missingNodes: [],
    anchors: {},
    normals: {},
    proxyMeshes,
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

    // A stand-in for the grip space, at a pose that is NOT the identity: the
    // conversion is supposed to cancel the grip's world matrix exactly, and a
    // grip parked at the origin would let a frame mix-up pass unnoticed.
    const grip = new Group();
    grip.position.set(0.31, 1.24, -0.47);
    grip.rotation.set(0.4, -0.9, 0.25);
    grip.add(gltf.scene);
    grip.updateMatrixWorld(true);

    const mats = new Set<string>();
    gltf.scene.traverse((o) => {
      const m = (o as Mesh).material;
      if (m) for (const one of Array.isArray(m) ? m : [m]) mats.add(one.type);
    });
    out.materials = [...mats];

    const names = BUTTON_NODES[hand];
    out.missingNodes = names.filter((n) => !gltf.scene.getObjectByName(n.node)).map((n) => n.node);
    for (const [name, a] of measureAnchors(gltf.scene, grip, names)) {
      out.anchors[name] = [a.position.x, a.position.y, a.position.z];
      if (a.normal) out.normals[name] = [a.normal.x, a.normal.y, a.normal.z];
    }
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }
  return out;
}
