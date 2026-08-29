/**
 * Shared 2D-canvas helpers for the in-VR surfaces.
 *
 * There are now three of them - the controls panel, the on-controller hint
 * callouts, and the hazard info cards - and all three want the same thing: a
 * canvas painted with text, uploaded as a texture, hung on a quad that draws
 * over the splats. The recipe has a few non-obvious invariants that are easy to
 * get subtly wrong in a fourth copy, so it lives here once:
 *
 *   - `colorSpace = SRGBColorSpace`. A 2D canvas is an sRGB buffer; without this
 *     three treats the upload as linear and everything paints washed out.
 *   - `minFilter = LinearFilter`, i.e. no mipmaps. Mipmapped text is mush at the
 *     glancing angles you actually read a world-locked panel from.
 *   - `MeshBasicMaterial`. The scene has no lights at all - a lit material
 *     renders black.
 *   - `depthTest: false` plus an explicit `renderOrder`. The scans are dense
 *     point clouds and would otherwise chew holes in every label.
 *
 * Colours stay CSS strings rather than THREE.Color. That is not laziness: a
 * canvas is sRGB but Color stores linear-sRGB components, so `color.r * 255`
 * paints roughly 4.8x too dark (ground.ts has the full story and the `css()`
 * conversion for the one place that genuinely needs it).
 */
import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";

/** A rectangle in canvas pixels. Hit regions and drawn boxes share the type. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * The one palette for every in-VR surface. Shared so the panel, the hints and
 * the hazard cards read as parts of the same tool rather than three designs.
 */
export const C = {
  panel: "#111c2f",
  panelEdge: "#2b3d57",
  header: "#18263d",
  accent: "#7dd3fc",
  text: "#e2e8f0",
  dim: "#94a3b8",
  key: "#0b1220",
  btn: "#22364f",
  btnOn: "#155e75",
  /** Hazard severities. Deliberately the traffic-light set responders expect. */
  danger: "#f87171",
  dangerFill: "#3f1d1d",
  caution: "#fbbf24",
  cautionFill: "#3b2f11",
  info: "#7dd3fc",
  infoFill: "#12304a",
  /** Marks a marker position nobody has confirmed against the real vehicle. */
  unverified: "#a78bfa",
};

export type CanvasSurface = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: CanvasTexture;
  mesh: Mesh;
  w: number;
  h: number;
};

/**
 * Canvas -> texture -> quad. `metres` is the width; the height follows the
 * canvas aspect so the pixel grid is never stretched.
 */
export function makeCanvasSurface(
  w: number,
  h: number,
  metres: number,
  renderOrder: number,
): CanvasSurface {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(metres, (metres * h) / w),
    new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  mesh.renderOrder = renderOrder;
  return { canvas, ctx: canvas.getContext("2d")!, tex, mesh, w, h };
}

export function roundRect(
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

/**
 * Shrink the font until the string fits, down to a floor. Labels here are built
 * from settings ("Turn: Snap 45 deg") and vehicle data, so their length is not
 * known when the layout is chosen; without this the long ones simply paint past
 * their button edge.
 */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight = "600",
): void {
  let size = startPx;
  ctx.font = `${weight} ${size}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > minPx) {
    size -= 1;
    ctx.font = `${weight} ${size}px sans-serif`;
  }
}

/**
 * Greedy word wrap. Returns the lines rather than drawing them, so callers can
 * measure the block first - a hazard card has to know its own height before it
 * can centre anything under it.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Does a canvas-pixel point fall inside any registered hit region? */
export function hitAt<T extends Rect>(hits: T[], px: number, py: number): T | null {
  for (const r of hits) {
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
  }
  return null;
}
