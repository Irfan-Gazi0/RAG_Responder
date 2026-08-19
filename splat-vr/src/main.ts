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

// Ground plane. Not decoration: a fixed ground reference is the main thing that
// keeps smooth stick locomotion from inducing sim sickness, and it shows the
// user where the calibrated floor actually is.
const grid = new GridHelper(24, 24, 0x475569, 0x1e293b);
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
  (window as unknown as { __diag: unknown }).__diag = {
    key: currentConfig.key,
    lengthM: +(size.x * scale).toFixed(3),
    widthM: +(size.z * scale).toFixed(3),
    heightM: +(size.y * scale).toFixed(3),
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
// space, hand tracking and thumbstick locomotion.
const sparkXr = new SparkXr({
  renderer,
  mode: "vr",
  button: true,
  // local-floor puts y=0 at the user's real floor, so the grid and the car's
  // wheels line up with the room they are standing in.
  referenceSpaceType: "local-floor",
  enableHands: true,
  controllers: {
    // Deliberately conservative: fast smooth locomotion is the main trigger for
    // sim sickness, and this is a walk-around-a-car scene, not a traversal game.
    moveSpeed: 1.2,
    rotateSpeed: 2.5,
    moveHeading: true,
  },
  onEnterXr: () => {
    uiEl.style.display = "none";
    devEl.style.display = "none";
    statusEl.style.display = "none";
    // Start a comfortable distance off the car's nose rather than wherever the
    // desktop camera happened to have drifted to.
    playerRig.position.set(0, 0, 4.5);
    playerRig.quaternion.identity();
  },
  onExitXr: () => {
    uiEl.style.display = "";
    statusEl.style.display = "";
    if (DEV) devEl.style.display = "block";
    playerRig.position.set(0, 0, 0);
    playerRig.quaternion.identity();
  },
  onReady: (supported: boolean) => {
    if (!supported) {
      setStatus("WebXR not available in this browser - desktop view only.");
    }
  },
});

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
renderer.setAnimationLoop(() => {
  if (renderer.xr.isPresenting) {
    // Thumbstick walk/turn. Moves camera.parent (playerRig), pivoting turns
    // around the user's actual head position.
    sparkXr.updateControllers(camera);
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
