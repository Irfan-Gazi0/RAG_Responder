/**
 * Standalone WebXR Gaussian-splat viewer for the EV scans.
 *
 * Deliberately separate from portal/ (the IWSDK 360-video portal): this uses
 * plain three + Spark, so there is no super-three aliasing and no duplicate
 * Three.js hazard. It ships to CloudFront under /splat-vr/ and is linked from
 * the Streamlit "3D Views of EVs" tab - never iframed, because Streamlit's
 * components.iframe() withholds `xr-spatial-tracking` and VR cannot start.
 */
import {
  Color,
  Euler,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { SparkControls, SparkRenderer, SparkXr, SplatMesh } from "@sparkjsdev/spark";
import { DEFAULT_MODEL_KEY, findModel, MODELS, type ModelConfig } from "./models";
import { ControllerHints } from "./controller-hints";
import { Ground } from "./ground";
import { HelpPanel } from "./help-panel";
import { HandInput } from "./hand-input";
import { HotspotCard } from "./hotspot-card";
import { Hotspots } from "./hotspots";
import { Teleport } from "./teleport";
import { Tracking } from "./tracking";
import {
  flushComfort,
  loadComfort,
  saveComfort,
  VrInput,
  type ComfortSettings,
} from "./vr-input";

const params = new URLSearchParams(location.search);
const DEV = params.get("dev") === "1";
/**
 * Show the tracking readout unconditionally. Without this the panel stays quiet
 * unless something is detectably wrong, which is right for a normal session but
 * useless when the question is "is 6DoF working at all?" and the answer might be
 * yes. See tracking.ts.
 */
const DIAG = params.get("diag") === "1";

const statusEl = document.getElementById("status") as HTMLDivElement;
const uiEl = document.getElementById("ui") as HTMLDivElement;
const devEl = document.getElementById("dev") as HTMLDivElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function el<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

// --- renderer -------------------------------------------------------------
// antialias: false is Spark's explicit recommendation - MSAA does nothing for
// splat rendering and costs a lot of fill rate, which is what a Quest has least of.
const canvas = el<HTMLCanvasElement>("canvas");
const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

const scene = new Scene();
scene.background = new Color(0x0f172a);

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 1.6, 6);

// SparkXr.updateControllers() moves `camera.parent`, so the camera MUST live
// inside a rig - without one it dereferences null and locomotion throws on the
// first thumbstick input. This rig is also what "walking" actually translates.
const playerRig = new Group();
playerRig.add(camera);
scene.add(playerRig);

// maxStdDev is how far out each Gaussian is still drawn. Spark's own VR guidance
// is to drop it from the default sqrt(8) to sqrt(5): perceptually near-identical,
// but it shrinks every splat's fragment footprint, and fill rate is exactly what
// a Quest runs out of first. This is what pays for the framebuffer bump below.
const spark = new SparkRenderer({ renderer, maxStdDev: Math.sqrt(5) });
scene.add(spark);

// Ground. Not decoration: a fixed ground reference is the main thing that keeps
// smooth stick locomotion from inducing sim sickness, and it shows the user
// where the calibrated floor actually is. Tinted to match the scan's own
// captured floor so the two blend rather than meeting at a seam - see ground.ts.
const ground = new Ground(findModel(params.get("model") ?? DEFAULT_MODEL_KEY).groundColor);
scene.add(ground.mesh);

// Kept as an opt-in alignment aid (?grid=1): useful when checking that a scan is
// actually centred and square-on, distracting the rest of the time.
const grid = new GridHelper(24, 24, 0x475569, 0x1e293b);
grid.visible = params.get("grid") === "1";
scene.add(grid);

// --- model loading --------------------------------------------------------
// carRig carries only scale + position (both derived by fitToGround). All
// rotation lives on the SplatMesh itself, so the bounding box computed in
// carRig-local space stays axis-aligned with the world and the "sit on y=0"
// math holds.
const carRig = new Group();
scene.add(carRig);

// Splat files store the scene Y-down relative to three's convention, so every
// scan needs this 180-degree flip about X as its baseline before any per-model
// calibration is applied on top of it.
const FLIP_X = new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0));

let currentSplat: SplatMesh | null = null;
let currentConfig: ModelConfig = findModel(params.get("model") ?? DEFAULT_MODEL_KEY);

/** Live values driven by the ?dev=1 sliders; seeded from the model registry. */
let overrides: Pick<ModelConfig, "rotation" | "scaleMultiplier" | "yOffset"> = {
  rotation: [0, 0, 0],
  scaleMultiplier: 1,
  yOffset: 0,
};

/**
 * Stand the scan upright on the floor at real-world scale.
 *
 * getBoundingBox() walks the raw splat centers in object space - it ignores the
 * mesh transform and throws before the mesh is initialized - so we apply the
 * orientation to the box ourselves, then derive scale and position from it:
 *   - scale so the longest horizontal extent matches the real vehicle length
 *   - centre on the origin in X/Z
 *   - drop it so the lowest splat rests on y = 0
 */
function fitToGround(splat: SplatMesh) {
  const [rx, ry, rz] = overrides.rotation;
  const calibration = new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(rx),
      MathUtils.degToRad(ry),
      MathUtils.degToRad(rz),
      "XYZ",
    ),
  );
  // calibration applied on top of the baseline flip.
  splat.quaternion.copy(calibration).multiply(FLIP_X);
  splat.updateMatrix();

  // centers-only bounds: faint splats have huge radii and would otherwise
  // inflate the box and shrink the car.
  const box = splat.getBoundingBox(true).applyMatrix4(splat.matrix);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  const footprint = Math.max(size.x, size.z);
  const scale =
    (footprint > 1e-6 ? currentConfig.lengthMeters / footprint : 1) *
    overrides.scaleMultiplier;

  carRig.scale.setScalar(scale);
  carRig.position.set(
    -center.x * scale,
    -box.min.y * scale + overrides.yOffset,
    -center.z * scale,
  );

  // Expose the fitted world-space dimensions so a headless render check can
  // assert the car is actually the size it claims to be, rather than eyeballing
  // a screenshot. Read via page.evaluate(() => window.__diag).
  //
  // These are BOUNDING BOX dimensions, and the box includes however much
  // surrounding ground each crop captured - bboxLengthM reads ~7.5 m for a 4.79 m
  // car, which looks like a bug and is not one. The car's own length is only
  // recoverable by measuring the bodywork in a render (scripts/render_check.mjs);
  // the names carry the bbox prefix so nobody reads these as vehicle dimensions.
  (window as unknown as { __diag: unknown }).__diag = {
    key: currentConfig.key,
    bboxLengthM: +(size.x * scale).toFixed(3),
    bboxWidthM: +(size.z * scale).toFixed(3),
    bboxHeightM: +(size.y * scale).toFixed(3),
    targetLengthM: currentConfig.lengthMeters,
    scale: +scale.toFixed(4),
    groundY: +(carRig.position.y + box.min.y * scale).toFixed(3),
  };

  // Hazard markers are authored in a canonical vehicle frame (metres from the
  // vehicle centre, +X toward the nose) and mapped onto whatever pose this scan
  // ended up in. Re-placing them here rather than once at load is what keeps
  // them attached when a scan is re-calibrated - including live, from the dev
  // sliders above.
  hotspots.place(currentConfig.vehicleYaw, currentConfig.centerOffset);

  if (DEV) updateDevOutput(size, scale);
}

/**
 * Monotonic token so an out-of-order load cannot clobber a newer one. Switching
 * scans quickly used to leave the previous car on screen (or nothing at all):
 * the outgoing mesh was disposed and the incoming one added to the scene before
 * it had finished decoding, so whichever async load resolved last won.
 */
let loadToken = 0;

function loadModel(cfg: ModelConfig) {
  const token = ++loadToken;
  currentConfig = cfg;
  overrides = {
    rotation: [...cfg.rotation] as [number, number, number],
    scaleMultiplier: cfg.scaleMultiplier,
    yOffset: cfg.yOffset,
  };
  if (DEV) syncSlidersFromOverrides();

  setStatus(`Loading ${cfg.label}...`);

  // Both scans of a vehicle share one hazard set, so swapping hood-open for
  // hood-closed rebuilds nothing. A card left open belongs to the outgoing scan,
  // though, so it goes.
  hotspotCard.hide();
  hotspots.setVehicle(cfg.vehicle);
  if (DEV) syncHotspotPane();

  // Keep the outgoing scan visible until the incoming one is decoded, then swap
  // in one step and dispose the old mesh. Adding an uninitialized SplatMesh to
  // the scene is what confused the renderer before.
  const mesh = new SplatMesh({
    url: `./models/${cfg.key}.spz`,
    onProgress: (event: ProgressEvent) => {
      if (token !== loadToken) return;
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setStatus(`Loading ${cfg.label}... ${pct}%`);
      }
    },
    onLoad: (mesh: SplatMesh) => {
      if (token !== loadToken) {
        // A newer selection already won; drop this one's GPU resources.
        mesh.dispose();
        return;
      }
      const previous = currentSplat;
      currentSplat = mesh;
      carRig.add(mesh);
      fitToGround(mesh);
      // Each scan was shot on a slightly different floor, so retint with it.
      ground.setColor(cfg.groundColor);
      if (previous) {
        carRig.remove(previous);
        previous.dispose();
      }
      setStatus(`${cfg.label} - ready.`);
      reportError(null);
    },
  });

  // SplatMesh has no onError option - a failed fetch or a bad SPZ surfaces on
  // the `initialized` promise instead. Nothing was awaiting it, so a 404 or a
  // v4 file (Spark throws "Unsupported SPZ version" for anything above 3) left
  // the viewer sitting on "Loading..." forever with no way to tell that from a
  // slow download. In a headset there was no signal at all.
  void mesh.initialized.catch((err: unknown) => {
    if (token !== loadToken) return; // superseded; its failure is irrelevant
    const detail = err instanceof Error ? err.message : String(err);
    reportError(`Could not load ${cfg.label}: ${detail}`);
    mesh.dispose();
  });
}

/** Route a failure to both the desktop status bar and the in-VR panel. */
function reportError(message: string | null) {
  if (message) setStatus(message, true);
  helpPanel.setError(message);
}

// --- model picker ---------------------------------------------------------
for (const m of MODELS) {
  const opt = document.createElement("option");
  opt.value = m.key;
  opt.textContent = m.label;
  modelSelect.appendChild(opt);
}
modelSelect.value = currentConfig.key;
modelSelect.addEventListener("change", () => {
  loadModel(findModel(modelSelect.value));
});

// --- desktop controls -----------------------------------------------------
// Drag to look, scroll to zoom, WASD to move. Not used while an XR session
// owns the camera pose.
const controls = new SparkControls({ canvas });

// --- WebXR ----------------------------------------------------------------
// SparkXr renders its own Enter VR button and owns session lifecycle, reference
// space and hand tracking. Controller bindings are NOT Spark's defaults: see
// vr-input.ts for why all four getters are overridden.
let comfort: ComfortSettings = loadComfort();
/**
 * ?hazards=0 forces the markers off for THIS PAGE LOAD ONLY.
 *
 * scripts/render_check.mjs uses it: that check measures the vehicle's on-screen
 * length by segmenting white bodywork, and a marker painted near the nose or
 * tail would be measured as part of the car.
 *
 * Deliberately NOT folded into `comfort`. applyComfort() persists that object,
 * so folding it in meant one visit to the render-check URL followed by touching
 * any comfort control wrote hotspots:false to localStorage - hazards off for
 * good, with nothing in the UI explaining why.
 */
const HAZARDS_FORCED_OFF = params.get("hazards") === "0";

/** Stored preference, minus the URL override. The only thing that should reach
 * the marker layer. */
function hazardsVisible(): boolean {
  return comfort.hotspots && !HAZARDS_FORCED_OFF;
}

const vrInput = new VrInput({ renderer, playerRig, camera, settings: comfort });
const helpPanel = new HelpPanel(comfort);
// Parented to the rig so the panel travels with the user rather than being left
// behind the moment they walk to the far side of the car.
playerRig.add(helpPanel.group);

// Per-button callouts pinned to the controllers themselves. Complements the
// panel: the panel is the reference list, these are the in-place labels.
// Attaches its own grip spaces to the rig.
const hints = new ControllerHints(renderer, playerRig, comfort);
vrInput.onUse((hand, control) => hints.markUsed(hand, control));

// Teleport arc lives in world space (scene, not the rig) - it is aiming at a
// fixed point on the floor and must not be dragged around by the player.
const teleport = new Teleport(scene, playerRig, camera);

// Hand tracking. Constructing this is what calls renderer.xr.getHand(i) at all -
// three does not populate joint poses or emit pinch events for a hand space
// nobody has asked for. `enableHands: true` on SparkXr below is still required:
// it is what puts "hand-tracking" in the session's optionalFeatures.
const handInput = new HandInput({
  renderer,
  playerRig,
  palmSign: numParam("palmsign", -1, -1, 1) < 0 ? -1 : 1,
});

// Hazard markers live in WORLD space, not under carRig: carRig carries the
// fit-to-ground scale (2.4x to 5.5x depending on the scan), which would give
// each vehicle differently-sized beacons. fitToGround re-places them instead.
const hotspots = new Hotspots();
scene.add(hotspots.group);

// The card is world-space too, so it stays put beside the part it describes
// while you walk around to look at it from another angle.
const hotspotCard = new HotspotCard();
scene.add(hotspotCard.group);

// Tracking diagnostics. See tracking.ts for why this exists rather than a rig
// refactor: the rig was never the problem.
const tracking = new Tracking(renderer, camera, playerRig);

vrInput.onTeleport((e) => {
  if (e.phase === "cancel") {
    teleport.cancel();
    return;
  }
  if (e.phase === "commit") {
    // Deliberately does NOT need the controller resolved. If it dropped out
    // between aim and release, the arc is still on screen and the last landing
    // is still valid - bailing here would leave it hanging there with no way to
    // clear it. commit() hides the arc either way.
    if (teleport.commit()) {
      // Confirms the jump landed; the blink hides the motion, so without this
      // there is no feedback at all that the release registered.
      vrInput.pulse(e.hand, 0.5, 40);
    }
    return;
  }
  const ctrl = vrInput.controllerFor(e.hand);
  if (ctrl) teleport.aim(ctrl, e.x, e.y);
});

/**
 * Put the user back at the default viewing spot off the car's nose.
 *
 * Meta's guidance is that any app which moves the player should offer a way
 * back to a known-good pose; without one, a user who teleports somewhere odd
 * (or whose play space drifts) has to exit the session to recover.
 */
function recentre() {
  // The y here is not incidental: it also cancels any rise/duck offset, so
  // "recentre" gets you back to standing on the floor and not just back to the
  // right spot on it.
  playerRig.position.set(0, 0, 4.5);
  playerRig.quaternion.identity();
}

/** Single place that keeps input, panel and DOM in agreement. */
function applyComfort(patch: Partial<ComfortSettings>) {
  comfort = { ...comfort, ...patch };
  vrInput.settings = comfort;
  saveComfort(comfort);
  helpPanel.setSettings(comfort);
  hints.setSettings(comfort);
  hotspots.setEnabled(hazardsVisible());
  // Hiding the markers has to take their card with it, or a card is left
  // floating beside nothing.
  if (!hazardsVisible()) hotspotCard.hide();
  // Turning the height axis off should not strand somebody up in the air with
  // no way back down.
  if (!comfort.verticalMove) vrInput.setHeight(0);
  syncComfortInputs();
}

/**
 * One place that turns a panel hit into its effect, so the trigger ray and the
 * A/X shortcut can never drift apart. Returns whether anything was pressed.
 */
function pressPanel(controller: Object3D): boolean {
  const hit = helpPanel.hitTest(controller);
  if (!hit) return false;
  const patch = helpPanel.activate(hit);
  if (patch) applyComfort(patch);
  else if (hit === "recentre") recentre();
  // Reopening the panel re-labels the hardware, same reasoning as B/Y below.
  else if (hit === "expand") hints.show();
  const hand = vrInput.handOf(controller);
  if (hand) vrInput.pulse(hand, 0.4, 20);
  return true;
}

/**
 * Close an open card, or open the one under the pointer. Returns whether the
 * press was consumed.
 */
function pressHotspot(controller: Object3D): boolean {
  if (hotspotCard.visible) {
    if (hotspotCard.hitTest(controller) === "close") {
      hotspotCard.hide();
      pulseFor(controller, 0.3, 20);
      return true;
    }
    // A ray anywhere else on the card is still the card's - otherwise pressing
    // near a button and missing would fall through and teleport you.
    if (hotspotCard.intersects(controller)) return true;
  }
  const hit = hotspots.hitTest(controller);
  if (!hit) return false;
  const world = hotspots.worldOf(hit.id);
  if (!world) return false;
  hotspotCard.show(hit, world, camera, renderer.xr.isPresenting);
  pulseFor(controller, 0.45, 25);
  return true;
}

/** Haptics for whichever hand holds this ray. A no-op for a tracked hand. */
function pulseFor(controller: Object3D, intensity: number, ms: number) {
  const hand = vrInput.handOf(controller);
  if (hand) vrInput.pulse(hand, intensity, ms);
}

/**
 * What a select press means, in priority order: the controls panel, then an
 * open card or a hazard marker, and only then - for a tracked hand - the
 * teleport gesture.
 *
 * The order exists because with hands there is exactly ONE gesture. A pinch has
 * to press buttons and be the way you move, so "am I pointing at UI?" is what
 * separates them. Get it the wrong way round and every attempt to press a button
 * flings you across the workshop instead.
 */
function pressAt(controller: Object3D): boolean {
  return pressPanel(controller) || pressHotspot(controller);
}

vrInput.onButton((e) => {
  // Opening the full panel is the "I need help" signal, so the controller
  // labels come back with it - including the ones already faded out.
  if (e === "togglePanel") {
    if (helpPanel.toggle(camera, playerRig) === "full") hints.show();
  } else if (e === "accept") {
    // A/X presses whatever the pointer is already resting on, so the panel is
    // usable without having to hold the ray perfectly steady on a trigger pull.
    for (const c of vrInput.controllers) {
      if (pressAt(c)) break;
    }
  }
});

// A tracked hand has no B/Y, so a palm turned toward the face stands in for it -
// the same gesture the Quest shell uses for its own menu, and therefore the one
// a user is most likely to try without being told.
handInput.onEvent((e) => {
  if (e === "togglePanel" && helpPanel.toggle(camera, playerRig) === "full") {
    hints.show();
  }
});

/**
 * Hand teleport state: which ray is mid-pinch, if any.
 *
 * Only ever set for a hand. A controller's trigger stays a pure select, because
 * its teleport is on the thumbstick where users expect it, and making the
 * trigger throw an arc as well would make every panel press ambiguous.
 */
let pinchAiming: Object3D | null = null;
/**
 * Launch strength for a hand-thrown arc. A stick reports how far it is pushed
 * and scales the throw with it; a pinch is binary, so range is steered entirely
 * by wrist pitch. Mid-range, so both a short hop and the far side of the floor
 * disc are reachable by tilting.
 */
const HAND_TELEPORT_PUSH = 0.55;

for (const ctrl of vrInput.controllers) {
  ctrl.addEventListener("selectstart", () => {
    if (pressAt(ctrl)) return;
    // Nothing under the ray: for a hand this is the start of a teleport throw.
    if (vrInput.isHandController(ctrl)) {
      pinchAiming = ctrl;
      teleport.aim(ctrl, 0, HAND_TELEPORT_PUSH);
    }
  });
  ctrl.addEventListener("selectend", () => {
    if (pinchAiming !== ctrl) return;
    pinchAiming = null;
    teleport.commit();
  });
  // Tracking loss mid-throw would otherwise leave the arc hanging in the air
  // with no way to clear it - the release event never arrives.
  ctrl.addEventListener("disconnected", () => {
    if (pinchAiming === ctrl) {
      pinchAiming = null;
      teleport.cancel();
    }
  });
}

/**
 * Desktop review path: click a marker with the mouse.
 *
 * Not a convenience. It is the only way to check hazard placement and card copy
 * without putting a headset on, which is what makes the seeded positions in
 * hotspots-data.ts reviewable at all.
 */
canvas.addEventListener("pointerdown", (e) => {
  if (renderer.xr.isPresenting || e.button !== 0) return;
  const probe = new Object3D();
  scene.add(probe);
  probe.position.copy(camera.getWorldPosition(new Vector3()));
  // Aim the probe down the ray through the clicked pixel; hitTest fires along
  // its -Z, so looking at the unprojected point orients it correctly.
  const ndc = new Vector3(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
    0.5,
  ).unproject(camera);
  probe.lookAt(ndc);
  probe.updateMatrixWorld(true);
  const consumed = pressHotspot(probe);
  scene.remove(probe);
  if (!consumed && hotspotCard.visible && !hotspotCard.intersects(probe)) {
    hotspotCard.hide();
  }
});

/** Show the panel automatically the first time someone enters VR. */
const SEEN_KEY = "splatvr.seenControls.v1";

/**
 * XR render scale.
 *
 * These are named constants, not inline literals, because the failure mode is
 * silent: omit either option and Spark/three fall back to a 0.5 framebuffer and
 * 1.0 foveation, which reads as "the headset is just blurry" rather than as a
 * bug. scripts/vr_check.mjs asserts they have not drifted back down.
 *
 * 0.8 sits at the conservative end of the band Meta's own WebXR performance
 * guide recommends (0.8-0.9). The scans are 100-200K splats against Spark's
 * stated 500-750K WebXR budget, so this scene has fill-rate headroom that
 * Spark's cautious 0.5 default assumes it does not.
 *
 * NOT YET MEASURED IN A HEADSET. Both are overridable from the URL
 * (?fbscale=0.6&foveation=0.9) precisely so the trade can be A/B'd on device in
 * seconds rather than through a rebuild-and-redeploy cycle. If frames drop on a
 * full lap of the car, lower fbscale first - it is the quadratic term.
 */
function numParam(name: string, fallback: number, lo: number, hi: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= lo && v <= hi ? v : fallback;
}
const XR_FRAMEBUFFER_SCALE = numParam("fbscale", 0.8, 0.25, 1.5);
const XR_FOVEATION = numParam("foveation", 0.6, 0, 1);

const sparkXr = new SparkXr({
  renderer,
  mode: "vr",
  button: true,
  frameBufferScaleFactor: XR_FRAMEBUFFER_SCALE,
  // THE SINGLE BIGGEST VISUAL FIX IN THIS VIEWER.
  //
  // SparkXr silently defaults frameBufferScaleFactor to 0.5, so every VR frame
  // was being rendered at a QUARTER of the headset's pixels and upscaled. On a
  // photoreal scan you are meant to walk up to and inspect, and a text panel you
  // are meant to read at 1.6 m, that is the whole product. Meta's own perf guide
  // treats dropping to 0.8-0.9 as a last-resort optimisation; 0.5 is well past
  // it. 0.9 keeps a little headroom without the mush.
  //
  // three defaults foveation to 1.0 - maximum - which degrades the periphery
  // hard and compounded the half-res framebuffer. 0.6 is around Meta's
  // "medium" balance point: it still buys back peripheral fill rate, which is
  // what funds the resolution increase above, without smearing anything you
  // turn your head towards.
  fixedFoveation: XR_FOVEATION,
  // local-floor puts y=0 at the user's real floor, so the ground and the car's
  // wheels line up with the room they are standing in.
  referenceSpaceType: "local-floor",
  enableHands: true,
  controllers: vrInput.sparkConfig(),
  onEnterXr: () => {
    uiEl.style.display = "none";
    devEl.style.display = "none";
    statusEl.style.display = "none";
    // Any comfort change made on the desktop panel seconds before hitting Enter
    // VR is still sitting in the debounce timer; a headset session can suspend
    // the page's timers, so commit it now rather than risk losing it.
    flushComfort();
    // Start a comfortable distance off the car's nose rather than wherever the
    // desktop camera happened to have drifted to.
    recentre();
    vrInput.setVisible(true);
    handInput.setVisible(true);
    // Start measuring head travel from zero for this session - it is the number
    // that decides whether the reported "the headset does not move" is the
    // runtime or this app. See tracking.ts.
    tracking.begin();

    // First-timers get the full panel; after that it opens minimised so it is
    // present but not in the way.
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private browsing */
    }
    helpPanel.show(camera, playerRig);
    if (seen) helpPanel.toggle(camera, playerRig); // -> minimised
    // Shown on every entry, not just the first: they retire themselves as soon
    // as you touch the control, so a returning user pays almost nothing for them.
    hints.show();
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private browsing */
    }
  },
  onExitXr: () => {
    uiEl.style.display = "";
    statusEl.style.display = "";
    if (DEV) devEl.style.display = "block";
    playerRig.position.set(0, 0, 0);
    playerRig.quaternion.identity();
    // three overwrites camera.position/quaternion from the XR head pose on
    // every presented frame (WebXRManager decomposes the view matrix into
    // them), and never puts them back. Resetting only the rig therefore dropped
    // the user back to a desktop view stuck at the last head pose - off-centre,
    // at head height, and pitched or rolled however they were looking. Restore
    // the framing pose explicitly; SparkControls carries on from whatever it
    // finds here.
    camera.position.set(0, 1.6, 6);
    camera.quaternion.identity();
    vrInput.setVisible(false);
    handInput.setVisible(false);
    helpPanel.hide();
    hints.hide();
    teleport.reset();
    hotspotCard.hide();
    pinchAiming = null;
    tracking.end();
    // The floor fades out while you are ducked under it; leaving the session
    // there would drop you back to a desktop view with no ground at all.
    ground.setSubfloorFade(1);
  },
  onReady: (supported: boolean) => {
    if (!supported) {
      setStatus("WebXR not available in this browser - desktop view only.");
    }
  },
});

// --- comfort settings UI --------------------------------------------------
// Mirrored between the desktop panel and the in-VR panel: whichever surface the
// user reaches for, both stay in step (applyComfort is the single writer).
const movementStyleEl = el<HTMLSelectElement>("movementStyle");
const turnStyleEl = el<HTMLSelectElement>("turnStyle");
const snapDegreesEl = el<HTMLSelectElement>("snapDegrees");
const moveSpeedEl = el<HTMLInputElement>("moveSpeed");
const dominantHandEl = el<HTMLSelectElement>("dominantHand");
const vignetteEl = el<HTMLInputElement>("vignette");
const verticalMoveEl = el<HTMLInputElement>("verticalMove");
const hotspotsEl = el<HTMLInputElement>("hotspotsOn");
const controllerHintsEl = el<HTMLInputElement>("controllerHints");
const hapticsEl = el<HTMLInputElement>("haptics");

function syncComfortInputs() {
  movementStyleEl.value = comfort.movementStyle;
  turnStyleEl.value = comfort.turnStyle;
  snapDegreesEl.value = String(comfort.snapDegrees);
  moveSpeedEl.value = String(comfort.moveSpeed);
  dominantHandEl.value = comfort.dominantHand;
  vignetteEl.checked = comfort.vignette;
  verticalMoveEl.checked = comfort.verticalMove;
  hotspotsEl.checked = comfort.hotspots;
  // The checkbox reflects the stored preference, but ?hazards=0 outranks it for
  // this load - disable it rather than let it claim markers are on when the
  // scene is empty.
  hotspotsEl.disabled = HAZARDS_FORCED_OFF;
  controllerHintsEl.checked = comfort.controllerHints;
  hapticsEl.checked = comfort.haptics;
  el("moveSpeedv").textContent = `${comfort.moveSpeed.toFixed(1)} m/s`;
  // Snap angle is meaningless while smooth turning is selected.
  snapDegreesEl.disabled = comfort.turnStyle !== "snap";
}

movementStyleEl.addEventListener("change", () =>
  applyComfort({
    movementStyle: movementStyleEl.value as ComfortSettings["movementStyle"],
  }),
);
turnStyleEl.addEventListener("change", () =>
  applyComfort({ turnStyle: turnStyleEl.value as ComfortSettings["turnStyle"] }),
);
snapDegreesEl.addEventListener("change", () =>
  applyComfort({ snapDegrees: Number(snapDegreesEl.value) }),
);
moveSpeedEl.addEventListener("input", () =>
  applyComfort({ moveSpeed: Number(moveSpeedEl.value) }),
);
dominantHandEl.addEventListener("change", () =>
  applyComfort({ dominantHand: dominantHandEl.value as ComfortSettings["dominantHand"] }),
);
vignetteEl.addEventListener("change", () =>
  applyComfort({ vignette: vignetteEl.checked }),
);
verticalMoveEl.addEventListener("change", () =>
  applyComfort({ verticalMove: verticalMoveEl.checked }),
);
hotspotsEl.addEventListener("change", () =>
  applyComfort({ hotspots: hotspotsEl.checked }),
);
controllerHintsEl.addEventListener("change", () =>
  applyComfort({ controllerHints: controllerHintsEl.checked }),
);
hapticsEl.addEventListener("change", () =>
  applyComfort({ haptics: hapticsEl.checked }),
);

syncComfortInputs();
// applyComfort is the only writer, and it has not run yet - push the stored
// hazard preference into the marker layer once at startup.
hotspots.setEnabled(hazardsVisible());

// Raise the permissions problem before anyone puts a headset on. A page served
// inside a frame without `xr-spatial-tracking` gets poses with the translation
// stripped, which in the headset presents as "walking does nothing" and looks
// for all the world like a bug in this app. Reported on both surfaces, because
// #status is hidden for the whole XR session.
{
  const warning = Tracking.preflightWarning();
  if (warning) reportError(warning);
}

// --- dev calibration panel ------------------------------------------------
const SLIDER_IDS = ["rotX", "rotY", "rotZ", "scaleMul", "yOff"] as const;

function syncSlidersFromOverrides() {
  el<HTMLInputElement>("rotX").value = String(overrides.rotation[0]);
  el<HTMLInputElement>("rotY").value = String(overrides.rotation[1]);
  el<HTMLInputElement>("rotZ").value = String(overrides.rotation[2]);
  el<HTMLInputElement>("scaleMul").value = String(overrides.scaleMultiplier);
  el<HTMLInputElement>("yOff").value = String(overrides.yOffset);
  refreshSliderLabels();
}

function refreshSliderLabels() {
  el("rotXv").textContent = `${overrides.rotation[0]}°`;
  el("rotYv").textContent = `${overrides.rotation[1]}°`;
  el("rotZv").textContent = `${overrides.rotation[2]}°`;
  el("scaleMulv").textContent = overrides.scaleMultiplier.toFixed(2);
  el("yOffv").textContent = `${overrides.yOffset.toFixed(2)} m`;
}

function updateDevOutput(size: Vector3, scale: number) {
  const fitted = Math.max(size.x, size.z) * scale;
  el<HTMLTextAreaElement>("devOut").value =
    JSON.stringify(
      {
        key: currentConfig.key,
        rotation: overrides.rotation,
        scaleMultiplier: Number(overrides.scaleMultiplier.toFixed(3)),
        yOffset: Number(overrides.yOffset.toFixed(3)),
      },
      null,
      2,
    ) + `\n// fitted: ${fitted.toFixed(2)} m (target ${currentConfig.lengthMeters} m)`;
}

/** The hotspot being edited in the dev pane. */
const hotspotSelectEl = el<HTMLSelectElement>("hsSelect");

/**
 * Stand a probe off a canvas quad and fire a ray back at a known point on it.
 *
 * Both the controls panel and the hazard card map a ray to a canvas pixel and
 * then to an action, and both are worth testing at that level rather than by
 * eye. Shared so the two checks cannot drift: the plane faces +Z and every
 * hitTest fires along the probe's -Z, so copying the surface's orientation and
 * stepping out along its normal aims back at exactly the requested pixel.
 */
function probeSurface<T>(
  mesh: Mesh,
  u: number,
  v: number,
  test: (probe: Object3D) => T,
): T {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry as PlaneGeometry;
  const { width, height } = geo.parameters;
  const world = new Vector3((u - 0.5) * width, (0.5 - v) * height, 0).applyMatrix4(
    mesh.matrixWorld,
  );
  const quat = mesh.getWorldQuaternion(new Quaternion());
  const normal = new Vector3(0, 0, 1).applyQuaternion(quat);
  const probe = new Object3D();
  scene.add(probe);
  probe.position.copy(world).addScaledVector(normal, 1);
  probe.quaternion.copy(quat);
  probe.updateMatrixWorld(true);
  const result = test(probe);
  scene.remove(probe);
  return result;
}

if (DEV) {
  devEl.style.display = "block";

  // Test seam, ?dev=1 only. The VR interaction code cannot be reached from a
  // headless browser - there are no controllers and no session - so the pieces
  // whose maths can silently go wrong (the teleport arc, the panel's UV-to-hit
  // mapping) are driven through here by scripts/vr_check.mjs instead. Same
  // rationale as window.__diag: assert behaviour, do not eyeball a screenshot.
  (window as unknown as { __vr: unknown }).__vr = {
    xrRender: () => ({
      framebufferScale: XR_FRAMEBUFFER_SCALE,
      configuredFoveation: XR_FOVEATION,
      // Real readback: three stores whatever SparkXr passed to setFoveation.
      foveation: renderer.xr.getFoveation(),
    }),
    comfort: () => comfort,
    apply: (patch: Partial<ComfortSettings>) => applyComfort(patch),
    rig: () => playerRig.position.toArray(),
    recentre,
    /**
     * The rig wiring itself. The reported 6DoF loss makes this worth asserting
     * permanently rather than re-deriving by reading main.ts: if the camera ever
     * stops being a child of the rig, Spark's locomotion writes to whatever
     * `camera.parent` is instead and head tracking really would be fighting it.
     */
    wiring: () => ({
      cameraInRig: camera.parent === playerRig,
      rigInScene: playerRig.parent === scene,
      // Nothing but the rig may carry the player. A stray transform on an
      // ancestor would offset every pose.
      rigParentIsIdentity:
        playerRig.parent?.position.lengthSq() === 0 &&
        playerRig.parent?.quaternion.w === 1,
    }),
    tracking: () => tracking.report(),
    /** Rise/duck: drive the axis directly and read the clamped result back. */
    height: () => playerRig.position.y,
    setHeight: (y: number) => {
      vrInput.setHeight(y);
      return playerRig.position.y;
    },
    heightRange: () => [...VrInput.HEIGHT_RANGE],
    /**
     * Drive the subfloor fade directly. It normally runs only from the XR
     * branch of the loop, and there is no XR session in a headless browser -
     * but "does the floor stop being a ceiling when you duck under it" is
     * exactly the kind of thing worth asserting rather than trusting.
     */
    fadeGround: (headY: number) => ground.setSubfloorFade(headY),
    groundOpacity: () =>
      (ground.mesh.material as { opacity: number }).opacity,
    inputMode: () => vrInput.inputMode,
    effectiveMovementStyle: () => vrInput.effectiveMovementStyle,
    /**
     * The ?hazards=0 override and the stored preference, separately.
     * scripts/vr_check.mjs asserts the override never reaches storage: folding
     * it into `comfort` meant one visit to the render-check URL turned the
     * markers off permanently.
     */
    hazards: () => ({
      forcedOff: HAZARDS_FORCED_OFF,
      stored: comfort.hotspots,
      visible: hazardsVisible(),
    }),
    /**
     * Hazard markers. Positions come back in world metres so a check can assert
     * they land on the vehicle rather than beside it.
     */
    hotspots: () =>
      hotspots.ids.map((id) => {
        const h = hotspots.byId(id)!;
        return {
          id,
          severity: h.severity,
          verified: h.verified,
          pos: h.pos,
          world: hotspots.worldOf(id)!.toArray(),
        };
      }),
    /** Fire a ray from an arbitrary pose at the markers. */
    hotspotAt(pos: [number, number, number], quat: [number, number, number, number]) {
      const probe = new Object3D();
      scene.add(probe);
      probe.position.fromArray(pos);
      probe.quaternion.fromArray(quat);
      probe.updateMatrixWorld(true);
      const hit = hotspots.hitTest(probe);
      scene.remove(probe);
      return hit?.id ?? null;
    },
    /** Open a card the way a press would, without needing a controller. */
    openCard(id: string) {
      const h = hotspots.byId(id);
      const world = hotspots.worldOf(id);
      if (!h || !world) return false;
      camera.updateWorldMatrix(true, false);
      hotspotCard.show(h, world, camera, renderer.xr.isPresenting);
      return true;
    },
    card: () => ({
      visible: hotspotCard.visible,
      id: hotspotCard.hotspot?.id ?? null,
    }),
    closeCard: () => hotspotCard.hide(),
    /** Hit-test the open card at normalized canvas coordinates. */
    cardHitUV(u: number, v: number) {
      const hit = probeSurface(hotspotCard.mesh, u, v, (probe) =>
        hotspotCard.hitTest(probe),
      );
      return hit;
    },
    /**
     * The panel's painted hit rectangles, normalized. The headless check used to
     * hard-code the grid's margins and pitches; reading them back means the
     * check survives a re-layout, which has just happened.
     */
    panelRects: () => {
      const { w, h } = helpPanel.surfaceSize;
      return helpPanel.hitRegions.map((r) => ({
        action: r.action,
        u: (r.x + r.w / 2) / w,
        v: (r.y + r.h / 2) / h,
      }));
    },
    /** Aim the arc from an arbitrary pose and report where it landed. */
    aimFrom(
      pos: [number, number, number],
      quat: [number, number, number, number],
      lateral = 0,
      push = 1,
    ) {
      const probe = new Object3D();
      scene.add(probe);
      probe.position.fromArray(pos);
      probe.quaternion.fromArray(quat);
      probe.updateMatrixWorld(true);
      teleport.aim(probe, lateral, push);
      scene.remove(probe);
      return teleport.landing;
    },
    commitTeleport: () => teleport.commit(),
    /** Step the blink state machine without waiting for real frames. */
    stepTeleport: (dt: number) => teleport.update(dt),
    /** Place the panel, then hit-test a ray from an arbitrary pose. */
    panelHit(pos: [number, number, number], quat: [number, number, number, number]) {
      const probe = new Object3D();
      scene.add(probe);
      probe.position.fromArray(pos);
      probe.quaternion.fromArray(quat);
      probe.updateMatrixWorld(true);
      const hit = helpPanel.hitTest(probe);
      scene.remove(probe);
      return hit;
    },
    showPanel: () => {
      // updateWorldMatrix(true, ...) refreshes ANCESTORS; updateMatrixWorld
      // only refreshes downward and would place the panel off a stale rig.
      camera.updateWorldMatrix(true, false);
      helpPanel.show(camera, playerRig);
    },
    /**
     * Does the panel's front actually point at the viewer?
     *
     * probeSurface-based checks cannot answer this: they step out along the
     * panel's OWN normal, so they hit the front face whichever way it is
     * turned, and a panel rotated 180 degrees away passes every one of them.
     * That is how the panel shipped facing backwards on every VR entry. This
     * returns the dot product of the panel's +Z with the direction to the head:
     * +1 is square-on, negative means the user is behind it and - the surface
     * being front-sided - sees nothing at all.
     */
    panelFacing: () => {
      const m = helpPanel.surface;
      m.updateWorldMatrix(true, false);
      const panelWorld = m.getWorldPosition(new Vector3());
      const normal = new Vector3(0, 0, 1).applyQuaternion(
        m.getWorldQuaternion(new Quaternion()),
      );
      const toHead = camera
        .getWorldPosition(new Vector3())
        .sub(panelWorld)
        .normalize();
      return normal.dot(toHead);
    },
    /**
     * Hit-test the panel at normalized canvas coordinates (0,0 = top-left).
     * The probe is built here, where the panel's real pose and size are known,
     * so the check does not have to re-derive them.
     */
    panelHitUV(u: number, v: number) {
      return probeSurface(helpPanel.surface, u, v, (probe) =>
        helpPanel.hitTest(probe),
      );
    },
  };

  const onSlide = () => {
    overrides.rotation = [
      Number(el<HTMLInputElement>("rotX").value),
      Number(el<HTMLInputElement>("rotY").value),
      Number(el<HTMLInputElement>("rotZ").value),
    ];
    overrides.scaleMultiplier = Number(el<HTMLInputElement>("scaleMul").value);
    overrides.yOffset = Number(el<HTMLInputElement>("yOff").value);
    refreshSliderLabels();
    if (currentSplat) fitToGround(currentSplat);
  };

  for (const id of SLIDER_IDS) {
    el<HTMLInputElement>(id).addEventListener("input", onSlide);
  }

  el("copyBtn").addEventListener("click", () => {
    void navigator.clipboard.writeText(el<HTMLTextAreaElement>("devOut").value);
    setStatus("Calibration JSON copied - paste it into src/models.ts");
  });

  el("resetBtn").addEventListener("click", () => {
    overrides = { rotation: [0, 0, 0], scaleMultiplier: 1, yOffset: 0 };
    syncSlidersFromOverrides();
    if (currentSplat) fitToGround(currentSplat);
  });

  syncSlidersFromOverrides();

  // --- hotspot placement pane ---------------------------------------------
  // Same loop that produced the models.ts calibration: nudge, look, copy the
  // JSON. It exists because the ERG gives component locations as diagrams, so
  // the seeded coordinates in hotspots-data.ts are an estimate and the only way
  // to turn them into facts is for a person to look at the scan and agree.
  for (const id of ["hsX", "hsY", "hsZ"] as const) {
    el<HTMLInputElement>(id).addEventListener("input", onHotspotSlide);
  }
  hotspotSelectEl.addEventListener("change", syncHotspotPane);
  el("hsCopy").addEventListener("click", () => {
    void navigator.clipboard.writeText(el<HTMLTextAreaElement>("hsOut").value);
    setStatus("Hotspot JSON copied - paste it into src/hotspots-data.ts");
  });
  el("hsCenter").addEventListener("click", () => {
    // Nudging the vehicle centre, not the marker: if every marker is off by the
    // same amount in the same direction, it is centerOffset that is wrong and
    // moving them one at a time would bake the error into all nine.
    currentConfig.centerOffset = [
      Number(el<HTMLInputElement>("hsCx").value),
      Number(el<HTMLInputElement>("hsCz").value),
    ];
    hotspots.place(currentConfig.vehicleYaw, currentConfig.centerOffset);
    writeHotspotOutput();
  });
}

function onHotspotSlide() {
  const id = hotspotSelectEl.value;
  if (!id) return;
  const pos: [number, number, number] = [
    Number(el<HTMLInputElement>("hsX").value),
    Number(el<HTMLInputElement>("hsY").value),
    Number(el<HTMLInputElement>("hsZ").value),
  ];
  hotspots.setPosition(id, pos);
  el("hsXv").textContent = `${pos[0].toFixed(2)} m`;
  el("hsYv").textContent = `${pos[1].toFixed(2)} m`;
  el("hsZv").textContent = `${pos[2].toFixed(2)} m`;
  writeHotspotOutput();
}

/** Repopulate the pane after a model swap changes which hazard set is loaded. */
function syncHotspotPane() {
  const ids = hotspots.ids;
  const keep = hotspotSelectEl.value;
  hotspotSelectEl.replaceChildren();
  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    hotspotSelectEl.appendChild(opt);
  }
  hotspotSelectEl.value = ids.includes(keep) ? keep : (ids[0] ?? "");
  const h = hotspots.byId(hotspotSelectEl.value);
  if (h) {
    el<HTMLInputElement>("hsX").value = String(h.pos[0]);
    el<HTMLInputElement>("hsY").value = String(h.pos[1]);
    el<HTMLInputElement>("hsZ").value = String(h.pos[2]);
  }
  el<HTMLInputElement>("hsCx").value = String(currentConfig.centerOffset[0]);
  el<HTMLInputElement>("hsCz").value = String(currentConfig.centerOffset[1]);
  onHotspotSlide();
}

/**
 * Emit the whole hazard set, not just the edited marker.
 *
 * Placing one marker almost always shifts your opinion of its neighbours, so
 * copying a single line back would mean nine round trips through the editor.
 * `verified` is emitted as-is rather than flipped automatically: confirming a
 * position is a judgement a person makes, not a side effect of dragging a slider.
 */
function writeHotspotOutput() {
  const rows = hotspots.ids.map((id) => {
    const h = hotspots.byId(id)!;
    const [x, y, z] = h.pos;
    const row = `  { id: "${id}", pos: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}], verified: ${h.verified} },`;
    // Passenger-side twins are generated by mirroring, so there is no literal in
    // hotspots-data.ts to paste this row into. Say so rather than emitting a row
    // that silently does nothing.
    return h.mirroredFrom
      ? `${row}  // MIRRORED from ${h.mirroredFrom} - move that entry, or promote this one`
      : row;
  });
  el<HTMLTextAreaElement>("hsOut").value =
    `// ${currentConfig.vehicle} - paste positions into HOTSPOTS in hotspots-data.ts\n` +
    `${rows.join("\n")}\n` +
    `// models.ts ${currentConfig.key}: centerOffset: [${currentConfig.centerOffset[0]}, ${currentConfig.centerOffset[1]}]`;
}

// --- loop -----------------------------------------------------------------
let lastFrame = 0;
const _headProbe = new Vector3();

/**
 * Keep the in-VR panel telling the truth about the hardware and the tracking.
 *
 * Throttled rather than per-frame: both halves compare strings against what is
 * already painted, and a 1024x900 canvas re-upload is not something to risk
 * doing at 90 Hz for a label that changes when someone puts a controller down.
 *
 * Accumulates the real frame delta, not an assumed 1/90: Quest 3 runs 72, 90 or
 * 120 Hz depending on the session, so a hardcoded step made this interval wrong
 * by up to a third in either direction.
 */
let surfacesAt = 0;
const SURFACE_INTERVAL = 0.25;

function updateVrSurfaces(dt: number) {
  surfacesAt += dt;
  if (surfacesAt < SURFACE_INTERVAL) return;
  surfacesAt = 0;

  helpPanel.setMode(vrInput.inputMode);

  const r = tracking.report();
  // Nothing to say unless something is actually wrong, or the user asked. A
  // permanent wall of numbers on the controls panel is its own usability bug.
  if (!r.verdict && !DIAG) {
    helpPanel.setDiagnostics(null);
    return;
  }
  const lines: string[] = [];
  if (r.verdict) lines.push(`!${r.verdict}`);
  lines.push(
    `head travel ${(r.maxTravel * 100).toFixed(0)} cm over ${r.frames} frames` +
      `, ${r.poseFailures} lost poses`,
  );
  lines.push(
    `features: ${r.enabledFeatures.join(", ") || "(none reported)"}` +
      ` | spatial-tracking: ${
        r.spatialTrackingAllowed === null ? "unknown" : r.spatialTrackingAllowed ? "yes" : "NO"
      }${r.framed ? " | IN A FRAME" : ""}`,
  );
  helpPanel.setDiagnostics(lines);
}

renderer.setAnimationLoop((time: number) => {
  // Snap turn and the vignette ramp are both time-based, and Spark does not hand
  // out its delta, so track our own. Clamped because a backgrounded tab or a
  // headset taken off produces a huge first delta that would otherwise fling the
  // user across the scene on resume.
  const dt = lastFrame ? Math.min((time - lastFrame) / 1000, 0.1) : 0;
  lastFrame = time;

  if (renderer.xr.isPresenting) {
    // Movement only: Spark's rotate path is disabled in vr-input's config
    // because snap turn is discrete. Moves camera.parent (playerRig).
    sparkXr.updateControllers(camera);
    // Turning, rise/duck, buttons, teleport aiming and vignette.
    vrInput.update(dt);
    // After vrInput, so a hint retired this frame fades from this frame, and so
    // the blink advances on the same frame the commit was emitted.
    hints.update(dt, camera);
    handInput.update(dt, camera);
    // A hand's arc has to be re-traced every frame from the live wrist pose -
    // unlike the stick gesture, which vrInput re-emits, a held pinch produces no
    // events at all between selectstart and selectend.
    if (pinchAiming) teleport.aim(pinchAiming, 0, HAND_TELEPORT_PUSH);
    teleport.update(dt);
    // After vrInput so the hover test uses this frame's controller poses, for
    // the same reason the hint ordering above matters.
    hotspots.update(dt, camera);
    hotspots.setHover(vrInput.controllers);
    hotspotCard.face(camera, true);
    tracking.update();
    updateVrSurfaces(dt);
    // The synthetic floor is DoubleSide, so ducking below it turns it into a
    // concrete ceiling over the very undercarriage you went down to look at.
    ground.setSubfloorFade(camera.getWorldPosition(_headProbe).y);
  } else {
    controls.update(camera);
    hotspots.update(dt, camera);
    hotspotCard.face(camera, false);
  }
  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Both surfaces, not just the DOM bar: #status is display:none for the whole
// XR session, so an error raised in VR used to be completely silent.
window.addEventListener("error", (e) => reportError(`Error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) =>
  reportError(`Error: ${(e.reason as Error)?.message ?? String(e.reason)}`),
);

loadModel(currentConfig);
