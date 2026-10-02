import type { Vec3 } from "../fold";
import { num, str } from "../params";
import type { ParamValues } from "../types";

/**
 * A filled pouch as an inflated surface (U3.3): flexible film has no folds to model, so the front
 * and back webs bulge out from their seals as a smooth cushion. An approximation for previews and
 * thumbnails, not a fill-volume calculation. Laid in the 3D frame: width along X, height along Y,
 * the bulge along ±Z; the seal bands stay flat.
 */
export interface SurfaceMesh {
  positions: Vec3[];
  /** Triangles as vertex indices, wound counter-clockwise from outside. */
  triangles: [number, number, number][];
}

/** How far each web bulges, mm: an eighth of the smaller side, plus half the gusset or base. */
export function pouchBulge(v: ParamValues): number {
  const w = num(v, "width", 120);
  const l = num(v, "length", 180);
  const type = str(v, "pouchType", "three_side");
  const gusset =
    type === "standing"
      ? num(v, "bottom", 40)
      : type.includes("gusset") || type === "four_side"
        ? num(v, "gusset", 40)
        : 0;
  return Math.min(w, l) / 8 + gusset / 2;
}

/** The front and back webs of a filled pouch, `n` × `n` quads each. */
export function inflatedPouch(v: ParamValues, n = 16): SurfaceMesh {
  const w = num(v, "width", 120);
  const l = num(v, "length", 180);
  const seal = Math.min(num(v, "sealWidth", 8), w / 4, l / 4);
  const h = pouchBulge(v);
  const positions: Vec3[] = [];
  const triangles: [number, number, number][] = [];
  // The bulge rises from the seals as sin² across both directions — flat at the seal, fullest mid-web.
  const lift = (x: number, y: number) => {
    const u = Math.max(0, Math.min(1, (x - seal) / (w - 2 * seal)));
    const s = Math.max(0, Math.min(1, (y - seal) / (l - 2 * seal)));
    return h * Math.sin(Math.PI * u) * Math.sin(Math.PI * s);
  };
  for (const side of [1, -1]) {
    const start = positions.length;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const x = (w * i) / n;
        const y = (l * j) / n;
        positions.push([x - w / 2, y - l / 2, side * lift(x, y)]);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = start + j * (n + 1) + i;
        const b = a + 1;
        const c = a + n + 1;
        const d = c + 1;
        if (side > 0) triangles.push([a, b, d], [a, d, c]);
        else triangles.push([a, d, b], [a, c, d]);
      }
  }
  return { positions, triangles };
}
