/**
 * Synthetic floor that blends into each scan's own captured ground.
 *
 * The first version used a GridHelper, which read as a videogame floor sitting
 * underneath a photoreal car - the seam where the scan's captured concrete met
 * the glowing grid lines was the most obviously "fake" thing in the scene.
 *
 * This replaces it with a disc whose base colour is sampled from the scan
 * itself (see `groundColor` in models.ts, measured off real renders rather than
 * guessed), textured with low-frequency mottling so it reads as concrete, and
 * faded out radially so it never ends in a hard circle against the background.
 * The result is that the captured ground patch under the car and the synthetic
 * floor beyond it are hard to tell apart.
 *
 * It still has to earn its keep as a comfort feature: a static, textured ground
 * reference is the main thing that stops smooth stick locomotion inducing
 * sickness. Flat colour alone gives the eye nothing to hold on to while moving,
 * which is why the mottling is not just decoration.
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  BufferAttribute,
} from "three";

/** Metres. Beyond OUTER the floor is fully transparent. */
const INNER_SOLID = 7.0;
const OUTER = 16.0;
/** One texture tile per this many metres. */
const TILE_METRES = 2.4;

/**
 * Deterministic PRNG - the floor must look identical on every load and between
 * the desktop render check and the headset, otherwise a screenshot diff is
 * meaningless.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A 2D canvas is an sRGB buffer, but three's Color stores components in the
 * *working* colour space (linear-sRGB). Reading `color.r * 255` straight into a
 * canvas therefore writes a linear value as though it were sRGB and paints it
 * roughly 4.8x too dark: #443e3b comes out as rgb(14,12,11), not rgb(68,62,59).
 * That is what turned the first version of this floor near-black. Every colour
 * that reaches the canvas goes through here, and every HSL call below passes
 * SRGBColorSpace explicitly so the lightness offsets stay perceptual.
 */
const _srgb = { r: 0, g: 0, b: 0 };
function css(color: Color, alpha: number): string {
  color.getRGB(_srgb, SRGBColorSpace);
  return `rgba(${(_srgb.r * 255) | 0},${(_srgb.g * 255) | 0},${(_srgb.b * 255) | 0},${alpha})`;
}

/**
 * Concrete-ish tile: the base colour, then soft blotches and fine speckle in
 * lighter/darker variants of it. Kept low-contrast on purpose - high-frequency
 * noise shimmers badly under the headset's reprojection.
 */
function makeGroundTexture(base: Color): CanvasTexture {
  const SIZE = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(0x5eed);

  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl, SRGBColorSpace);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft blotches: large, very low contrast. Drawn wrapped so the tile is seamless.
  for (let i = 0; i < 90; i++) {
    const r = 26 + rand() * 90;
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const dl = (rand() - 0.5) * 0.09;
    const c = new Color().setHSL(
      hsl.h, hsl.s, Math.min(0.92, Math.max(0.02, hsl.l + dl)), SRGBColorSpace,
    );
    for (const [ox, oy] of [
      [0, 0], [SIZE, 0], [-SIZE, 0], [0, SIZE], [0, -SIZE],
    ]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, css(c, 0.5));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fine aggregate speckle, so there is detail at the scale of your own feet.
  for (let i = 0; i < 5200; i++) {
    const dl = (rand() - 0.5) * 0.16;
    const c = new Color().setHSL(
      hsl.h, hsl.s, Math.min(0.95, Math.max(0.01, hsl.l + dl)), SRGBColorSpace,
    );
    ctx.fillStyle = css(c, 0.18 + rand() * 0.3);
    ctx.fillRect(rand() * SIZE, rand() * SIZE, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Ground {
  readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private texture: CanvasTexture;

  constructor(color: string) {
    const base = new Color(color);
    this.texture = makeGroundTexture(base);
    this.texture.repeat.set((OUTER * 2) / TILE_METRES, (OUTER * 2) / TILE_METRES);

    // A ring rather than a circle: CircleGeometry only has a centre vertex plus a
    // rim, so per-vertex alpha could only fade linearly from the middle. A ring
    // with radial subdivisions lets the floor stay fully opaque under and around
    // the car, then fade only near the horizon.
    const geo = new RingGeometry(0.001, OUTER, 96, 32);

    // Fade via RGBA vertex colours (three supports itemSize 4 here) rather than a
    // second alpha texture - no extra sampler, and the fade follows true radius
    // instead of the texture's UV square.
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i)); // ring is built in XY, then rotated flat
      const t = (r - INNER_SOLID) / (OUTER - INNER_SOLID);
      const a = r <= INNER_SOLID ? 1 : Math.max(0, 1 - t * t); // ease out, no visible edge
      colors.set([1, 1, 1, a], i * 4);
    }
    geo.setAttribute("color", new BufferAttribute(colors, 4));
    geo.rotateX(-Math.PI / 2);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false, // never occlude splats that sit fractionally below y=0
      side: DoubleSide,
    });

    this.mesh = new Mesh(geo, this.material);
    // Just below zero: the scans' own ground sits at y=0 and z-fighting between
    // the two at grazing angles is very visible in a headset.
    this.mesh.position.y = -0.004;
    this.mesh.renderOrder = -1;
  }

  /** Re-tint when a different scan (with a different captured floor) loads. */
  setColor(color: string) {
    const tex = makeGroundTexture(new Color(color));
    tex.repeat.copy(this.texture.repeat);
    this.material.map = tex;
    this.material.needsUpdate = true;
    this.texture.dispose();
    this.texture = tex;
  }

  setVisible(v: boolean) {
    this.mesh.visible = v;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
