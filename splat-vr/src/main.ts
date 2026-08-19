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
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { SparkControls, SparkRenderer, SparkXr, SplatMesh } from "@sparkjsdev/spark";
import { DEFAULT_MODEL_KEY, findModel, MODELS, type ModelConfig } from "./models";
import { Ground } from "./ground";
import { HelpPanel } from "./help-panel";
import { loadComfort, saveComfort, VrInput, type ComfortSettings } from "./vr-input";

const params = new URLSearchParams(location.search);
const DEV = params.get("dev") === "1";

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

const spark = new SparkRenderer({ renderer });
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

  // Keep the outgoing scan visible until the incoming one is decoded, then swap
  // in one step and dispose the old mesh. Adding an uninitialized SplatMesh to
  // the scene is what confused the renderer before.
  new SplatMesh({
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
    },
  });
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

const vrInput = new VrInput({ renderer, playerRig, camera, settings: comfort });
const helpPanel = new HelpPanel(comfort);
// Parented to the rig so the panel travels with the user rather than being left
// behind the moment they walk to the far side of the car.
playerRig.add(helpPanel.group);

/** Single place that keeps input, panel and DOM in agreement. */
function applyComfort(patch: Partial<ComfortSettings>) {
  comfort = { ...comfort, ...patch };
  vrInput.settings = comfort;
  saveComfort(comfort);
  helpPanel.setSettings(comfort);
  syncComfortInputs();
}

vrInput.onButton((e) => {
  if (e === "togglePanel") helpPanel.toggle(camera, playerRig);
  else if (e === "accept") {
    // A/X presses whatever the pointer is already resting on, so the panel is
    // usable without having to hold the ray perfectly steady on a trigger pull.
    for (const c of vrInput.controllers) {
      const hit = helpPanel.hitTest(c);
      if (hit) {
        const patch = helpPanel.activate(hit);
        if (patch) applyComfort(patch);
        break;
      }
    }
  }
});

// Trigger press -> press the panel button under that controller's ray.
for (const ctrl of vrInput.controllers) {
  ctrl.addEventListener("selectstart", () => {
    const hit = helpPanel.hitTest(ctrl);
    if (!hit) return;
    const patch = helpPanel.activate(hit);
    if (patch) applyComfort(patch);
  });
}

/** Show the panel automatically the first time someone enters VR. */
const SEEN_KEY = "splatvr.seenControls.v1";

const sparkXr = new SparkXr({
  renderer,
  mode: "vr",
  button: true,
  // local-floor puts y=0 at the user's real floor, so the ground and the car's
  // wheels line up with the room they are standing in.
  referenceSpaceType: "local-floor",
  enableHands: true,
  controllers: vrInput.sparkConfig(),
  onEnterXr: () => {
    uiEl.style.display = "none";
    devEl.style.display = "none";
    statusEl.style.display = "none";
    // Start a comfortable distance off the car's nose rather than wherever the
    // desktop camera happened to have drifted to.
    playerRig.position.set(0, 0, 4.5);
    playerRig.quaternion.identity();
    vrInput.setVisible(true);

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
    vrInput.setVisible(false);
    helpPanel.hide();
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
const turnStyleEl = el<HTMLSelectElement>("turnStyle");
const snapDegreesEl = el<HTMLSelectElement>("snapDegrees");
const moveSpeedEl = el<HTMLInputElement>("moveSpeed");
const dominantHandEl = el<HTMLSelectElement>("dominantHand");
const vignetteEl = el<HTMLInputElement>("vignette");

function syncComfortInputs() {
  turnStyleEl.value = comfort.turnStyle;
  snapDegreesEl.value = String(comfort.snapDegrees);
  moveSpeedEl.value = String(comfort.moveSpeed);
  dominantHandEl.value = comfort.dominantHand;
  vignetteEl.checked = comfort.vignette;
  el("moveSpeedv").textContent = `${comfort.moveSpeed.toFixed(1)} m/s`;
  // Snap angle is meaningless while smooth turning is selected.
  snapDegreesEl.disabled = comfort.turnStyle !== "snap";
}

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

syncComfortInputs();

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

if (DEV) {
  devEl.style.display = "block";

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
}

// --- loop -----------------------------------------------------------------
let lastFrame = 0;

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
    // Turning, buttons and vignette.
    vrInput.update(dt);
  } else {
    controls.update(camera);
  }
  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("error", (e) => setStatus(`Error: ${e.message}`, true));
window.addEventListener("unhandledrejection", (e) =>
  setStatus(`Error: ${(e.reason as Error)?.message ?? String(e.reason)}`, true),
);

loadModel(currentConfig);
