/**
 * Minimal typings for troika-three-text, which ships none.
 *
 * Same situation as three@0.181 needing @types/three: without this every member
 * below resolves to an error and the module is unusable from TypeScript. Only the
 * surface controller-hints.ts actually touches is declared - a fuller definition
 * would be a second, rotting copy of somebody else's API.
 *
 * `textRenderInfo` is the important one: it is troika's own laid-out metrics, and
 * reading the block bounds back out of it is how scripts/vr_check.mjs asserts the
 * legend is legible at hand distance instead of trusting a font-metric guess.
 */
declare module "troika-three-text" {
  import { Material, Mesh } from "three";

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: number | string;
    fillOpacity: number;
    anchorX: number | "left" | "center" | "right";
    anchorY: number | "top" | "middle" | "bottom" | "top-baseline";
    letterSpacing: number;
    maxWidth: number;
    material: Material;
    textRenderInfo?: {
      /** [minX, minY, maxX, maxY] of the laid-out block, in local units. */
      blockBounds: [number, number, number, number];
      /** The same, tightened to the glyphs that actually have ink. */
      visibleBounds: [number, number, number, number];
    };
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(
    options: { font?: string; characters?: string | string[] },
    callback: () => void,
  ): void;
}
