/**
 * In-VR controls panel, with a minimised state.
 *
 * A first-time user in a headset has no way to discover the bindings - there is
 * no manual, and the DOM UI is hidden the moment the XR session starts. So the
 * panel opens maximised on the first VR entry and remembers its state after
 * that: obvious when you need it, out of the way when you do not.
 *
 * Drawn to a 2D canvas rather than built from meshes or a UI toolkit. Text is
 * the entire content, canvas gives crisp glyphs at any size for one texture and
 * one draw call, and it keeps this file dependency-free.
 *
 * It is world-locked, not head-locked. A panel welded to your face is the
 * classic VR comfort mistake - it never leaves your view and it fights every
 * head movement. This one is placed in front of you when opened and then stays
 * put, so you can simply look away from it.
 *
 * Two comfort toggles live on the panel as well as in the desktop UI, because
 * "turning makes me queasy" is a thing you discover while in the headset, and
 * having to take it off to fix that is exactly the wrong answer.
 */
import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import type { ComfortSettings } from "./vr-input";

const FULL_W = 1024;
const FULL_H = 720;
const MINI_W = 640;
const MINI_H = 88;

/** Panel width in metres; height follows the canvas aspect. */
const FULL_METRES = 1.15;
const MINI_METRES = 0.62;

/** Where the panel is placed relative to the viewer when it opens. */
const PLACE_DISTANCE = 1.6;
const PLACE_HEIGHT = 1.35;

type Rect = { x: number; y: number; w: number; h: number };
export type PanelAction = "minimize" | "expand" | "toggleTurn" | "toggleVignette";

type Hit = { action: PanelAction };

const C = {
  panel: "#111c2f",
  panelEdge: "#2b3d57",
  header: "#18263d",
  accent: "#7dd3fc",
  text: "#e2e8f0",
  dim: "#94a3b8",
  key: "#0b1220",
  btn: "#22364f",
  btnOn: "#155e75",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The bindings, exactly as implemented in vr-input.ts. */
const ROWS: [string, string][] = [
  ["Left Stick", "Walk and strafe"],
  ["Right Stick", "Turn"],
  ["Trigger", "Select / press buttons"],
  ["Grip", "Not used in this scene"],
  ["A / X", "Accept"],
  ["B / Y", "Show or hide this panel"],
];

export class HelpPanel {
  readonly group = new Group();

  private fullMesh: Mesh;
  private miniMesh: Mesh;
  private fullCtx: CanvasRenderingContext2D;
  private miniCtx: CanvasRenderingContext2D;
  private fullTex: CanvasTexture;
  private miniTex: CanvasTexture;

  private fullHits: (Rect & Hit)[] = [];
  private miniHits: (Rect & Hit)[] = [];

  private minimized = false;
  private raycaster = new Raycaster();

  constructor(private settings: ComfortSettings) {
    const mk = (w: number, h: number, metres: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter; // no mipmaps: text stays sharp head-on
      const mesh = new Mesh(
        new PlaneGeometry(metres, (metres * h) / w),
        new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }),
      );
      mesh.renderOrder = 900;
      return { ctx: canvas.getContext("2d")!, tex, mesh };
    };

    const full = mk(FULL_W, FULL_H, FULL_METRES);
    const mini = mk(MINI_W, MINI_H, MINI_METRES);
    this.fullCtx = full.ctx;
    this.fullTex = full.tex;
    this.fullMesh = full.mesh;
    this.miniCtx = mini.ctx;
    this.miniTex = mini.tex;
    this.miniMesh = mini.mesh;

    this.group.add(this.fullMesh, this.miniMesh);
    this.group.visible = false;
    this.redraw();
  }

  // --- drawing ------------------------------------------------------------

  private redraw() {
    this.drawFull();
    this.drawMini();
    this.fullMesh.visible = !this.minimized;
    this.miniMesh.visible = this.minimized;
  }

  private drawFull() {
    const ctx = this.fullCtx;
    this.fullHits = [];
    ctx.clearRect(0, 0, FULL_W, FULL_H);

    ctx.fillStyle = C.panel;
    roundRect(ctx, 0, 0, FULL_W, FULL_H, 26);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 3;
    ctx.stroke();

    // header
    ctx.fillStyle = C.header;
    roundRect(ctx, 0, 0, FULL_W, 84, 26);
    ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.font = "600 40px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("CONTROLS", 36, 44);

    // minimise button
    const mb: Rect = { x: FULL_W - 92, y: 20, w: 56, h: 44 };
    ctx.fillStyle = C.btn;
    roundRect(ctx, mb.x, mb.y, mb.w, mb.h, 10);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.fillRect(mb.x + 16, mb.y + mb.h / 2 - 2, 24, 4);
    this.fullHits.push({ ...mb, action: "minimize" });

    // binding rows
    ctx.textBaseline = "middle";
    let y = 132;
    for (const [key, action] of ROWS) {
      ctx.fillStyle = C.key;
      roundRect(ctx, 36, y - 24, 300, 48, 10);
      ctx.fill();
      ctx.strokeStyle = C.panelEdge;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = C.accent;
      ctx.font = "600 27px sans-serif";
      ctx.fillText(key, 56, y);

      ctx.fillStyle = C.text;
      ctx.font = "26px sans-serif";
      ctx.fillText(action, 366, y);
      y += 62;
    }

    // comfort toggles
    y += 6;
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, y - 24);
    ctx.lineTo(FULL_W - 36, y - 24);
    ctx.stroke();

    ctx.fillStyle = C.dim;
    ctx.font = "600 23px sans-serif";
    ctx.fillText("COMFORT", 36, y + 14);

    const turnLabel =
      this.settings.turnStyle === "snap"
        ? `Turn: Snap ${this.settings.snapDegrees}°`
        : "Turn: Smooth";
    const vigLabel = `Vignette: ${this.settings.vignette ? "On" : "Off"}`;

    const b1: Rect = { x: 36, y: y + 38, w: 420, h: 62 };
    const b2: Rect = { x: 486, y: y + 38, w: 420, h: 62 };
    this.drawButton(ctx, b1, turnLabel, this.settings.turnStyle === "snap");
    this.drawButton(ctx, b2, vigLabel, this.settings.vignette);
    this.fullHits.push({ ...b1, action: "toggleTurn" });
    this.fullHits.push({ ...b2, action: "toggleVignette" });

    ctx.fillStyle = C.dim;
    ctx.font = "22px sans-serif";
    ctx.fillText(
      "Point with a controller and pull the trigger to press a button.",
      36,
      FULL_H - 54,
    );
    ctx.fillText(
      "The Meta (O) button is the system menu - hold it to recentre your view.",
      36,
      FULL_H - 22,
    );

    this.fullTex.needsUpdate = true;
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    label: string,
    on: boolean,
  ) {
    ctx.fillStyle = on ? C.btnOn : C.btn;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = on ? C.accent : C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = "600 26px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + 22, r.y + r.h / 2);
  }

  private drawMini() {
    const ctx = this.miniCtx;
    this.miniHits = [];
    ctx.clearRect(0, 0, MINI_W, MINI_H);

    ctx.fillStyle = C.header;
    roundRect(ctx, 0, 0, MINI_W, MINI_H, 18);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = C.accent;
    ctx.font = "600 30px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("CONTROLS", 28, MINI_H / 2);

    ctx.fillStyle = C.dim;
    ctx.font = "23px sans-serif";
    ctx.fillText("press B / Y, or point and pull the trigger", 210, MINI_H / 2);

    this.miniHits.push({ x: 0, y: 0, w: MINI_W, h: MINI_H, action: "expand" });
    this.miniTex.needsUpdate = true;
  }

  // --- state --------------------------------------------------------------

  get visible() {
    return this.group.visible;
  }

  setSettings(s: ComfortSettings) {
    this.settings = s;
    this.drawFull();
  }

  show(camera: PerspectiveCamera, rig: Object3D) {
    this.place(camera, rig);
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  toggle(camera: PerspectiveCamera, rig: Object3D) {
    if (this.group.visible && !this.minimized) {
      this.minimized = true;
      this.redraw();
    } else if (this.group.visible && this.minimized) {
      this.minimized = false;
      this.redraw();
      this.place(camera, rig);
    } else {
      this.minimized = false;
      this.redraw();
      this.show(camera, rig);
    }
  }

  /**
   * Drop the panel in front of the viewer at a comfortable height, facing them,
   * using yaw only - inheriting head pitch/roll would leave it visibly canted.
   */
  private place(camera: PerspectiveCamera, rig: Object3D) {
    const camPos = camera.getWorldPosition(new Vector3());
    const camQuat = camera.getWorldQuaternion(new Quaternion());

    // Yaw-only forward: if the user is looking at the floor when they open the
    // panel, it should still appear at eye level ahead of them, not on the ground.
    const fwd = new Vector3(0, 0, -1).applyQuaternion(camQuat);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();

    const target = camPos.clone().addScaledVector(fwd, PLACE_DISTANCE);
    target.y = PLACE_HEIGHT;

    // The group is parented to the rig, so convert into rig-local space.
    this.group.position.copy(rig.worldToLocal(target));

    // Face the viewer, level - lookAt at the panel's own height keeps it upright.
    const localCam = rig.worldToLocal(camPos.clone());
    this.group.lookAt(localCam.x, this.group.position.y, localCam.z);
  }

  // --- interaction --------------------------------------------------------

  /**
   * Raycast a controller at the panel. Returns the action under the pointer, or
   * null. Callers use this both for hover and for trigger presses.
   */
  hitTest(controller: Object3D): PanelAction | null {
    if (!this.group.visible) return null;
    const mesh = this.minimized ? this.miniMesh : this.fullMesh;
    const hits = this.minimized ? this.miniHits : this.fullHits;
    const w = this.minimized ? MINI_W : FULL_W;
    const h = this.minimized ? MINI_H : FULL_H;

    const origin = controller.getWorldPosition(new Vector3());
    const dir = new Vector3(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(new Quaternion()))
      .normalize();
    this.raycaster.set(origin, dir);

    const inter = this.raycaster.intersectObject(mesh, false)[0];
    if (!inter?.uv) return null;

    const uv: Vector2 = inter.uv;
    const px = uv.x * w;
    // Canvas Y runs down, UV runs up.
    const py = (1 - uv.y) * h;
    for (const r of hits) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.action;
    }
    return null;
  }

  /** Apply a press. Returns a settings patch for the caller to persist. */
  activate(action: PanelAction): Partial<ComfortSettings> | null {
    switch (action) {
      case "minimize":
        this.minimized = true;
        this.redraw();
        return null;
      case "expand":
        this.minimized = false;
        this.redraw();
        return null;
      case "toggleTurn":
        return { turnStyle: this.settings.turnStyle === "snap" ? "smooth" : "snap" };
      case "toggleVignette":
        return { vignette: !this.settings.vignette };
    }
  }
}
