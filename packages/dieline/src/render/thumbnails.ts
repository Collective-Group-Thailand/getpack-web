import { allFaces } from "../faces";
import type { Vec3 } from "../fold";
import { dielineLines } from "../lines";
import { foldModel, slabPoint } from "../model/thickness";
import type { SurfaceMesh } from "../model/pouch";
import { facePolygons, triangulate } from "../offset";
import { flattenContour, flattenEdge } from "../path";
import type { Dieline, EdgeRole, HingeMap, MaterialSpec, Pt } from "../types";
import { Raster, type Image, type Rgb } from "./raster";

/**
 * Style thumbnails (U3.3 §3), drawn by the engine's own rasteriser: the flat dieline, and the
 * folded box in our own lighting preset on neutral board — kraft or white, never artwork, scenes or
 * any third-party asset.
 */

export type BoardTone = "kraft" | "white";

/** Neutral boards and getpack's warm paper background (D-180), as RGB. */
export const TONES: Record<BoardTone, Rgb> = { kraft: [186, 146, 99], white: [242, 239, 232] };
const BACKGROUND: Rgb = [250, 247, 242];
const INK: Rgb = [42, 38, 34];
const CREASE: Rgb = [140, 131, 120];
const GLUE: Rgb = [214, 160, 64];

/**
 * "getpack studio": a warm key light from the upper left front, a cool fill from the right, a little
 * rim from behind, and ambient. Values chosen for legible folds on plain board.
 */
export const STUDIO_LIGHTS: { dir: Vec3; strength: number }[] = [
  { dir: [-0.45, 0.65, 0.6], strength: 0.55 },
  { dir: [0.7, 0.1, 0.5], strength: 0.2 },
  { dir: [0.2, 0.4, -0.9], strength: 0.12 },
];
export const AMBIENT = 0.38;

/** The thumbnail view: turned and tilted like the designer's 3D tab opens (radians). */
export const VIEW = { tilt: 0.35, turn: -0.6 };

export interface ThumbnailOptions {
  /** Output size in pixels (square). */
  size?: number;
  /** Supersampling factor for anti-aliasing. */
  supersample?: number;
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const LIGHTS = STUDIO_LIGHTS.map((l) => ({ dir: norm(l.dir), strength: l.strength }));

function view(p: Vec3): Vec3 {
  // Euler XYZ as three.js applies a group's rotation [tilt, turn, 0]: Rx · Ry · p.
  const cy = Math.cos(VIEW.turn);
  const sy = Math.sin(VIEW.turn);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const cx = Math.cos(VIEW.tilt);
  const sx = Math.sin(VIEW.tilt);
  return [x1, p[1] * cx - z1 * sx, p[1] * sx + z1 * cx];
}

const shade = (base: Rgb, n: Vec3, factor = 1): Rgb => {
  const f = n[2] < 0 ? ([-n[0], -n[1], -n[2]] as Vec3) : n;
  let s = AMBIENT;
  for (const l of LIGHTS) s += l.strength * Math.max(0, f[0] * l.dir[0] + f[1] * l.dir[1] + f[2] * l.dir[2]);
  return base.map((c) => Math.max(0, Math.min(255, Math.round(c * s * factor)))) as Rgb;
};

function draw(tris: { p: [Vec3, Vec3, Vec3]; colour: Rgb; inner?: boolean }[], opts: ThumbnailOptions): Image {
  const size = opts.size ?? 320;
  const k = opts.supersample ?? 2;
  const px = size * k;
  const viewed = tris.map((t) => ({ ...t, v: t.p.map(view) as [Vec3, Vec3, Vec3] }));
  const xs = viewed.flatMap((t) => t.v.map((p) => p[0]));
  const ys = viewed.flatMap((t) => t.v.map((p) => p[1]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = (px * 0.84) / Math.max(x1 - x0, y1 - y0, 1e-9);
  const ox = px / 2 - ((x0 + x1) / 2) * scale;
  const oy = px / 2 + ((y0 + y1) / 2) * scale;
  const raster = new Raster(px, px, BACKGROUND);
  for (const t of viewed) {
    const [a, b, c] = t.v;
    const n = norm([
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ]);
    const s = (p: Vec3): [number, number, number] => [ox + p[0] * scale, oy - p[1] * scale, -p[2]];
    raster.triangle(s(a), s(b), s(c), shade(t.colour, n, t.inner ? 0.86 : 1));
  }
  return raster.downsample(k);
}

/** The folded box, thick, on plain board. */
export function render3D(
  d: Dieline,
  hinges: HingeMap,
  material: MaterialSpec,
  tone: BoardTone,
  opts: ThumbnailOptions = {},
): Image {
  const model = foldModel(d, hinges, material);
  const byId = new Map(model.faces.map((f) => [f.id, f]));
  const base = TONES[tone];
  const tris: { p: [Vec3, Vec3, Vec3]; colour: Rgb; inner?: boolean }[] = [];
  for (const face of allFaces(d)) {
    const m = byId.get(face.id)!;
    for (const tri of triangulate(facePolygons(face))) {
      if (tri.length !== 3) continue;
      const [a, b, c] = tri as [Pt, Pt, Pt];
      tris.push({ p: [slabPoint(m, a, m.hi), slabPoint(m, b, m.hi), slabPoint(m, c, m.hi)], colour: base });
      tris.push({
        p: [slabPoint(m, a, m.lo), slabPoint(m, c, m.lo), slabPoint(m, b, m.lo)],
        colour: base,
        inner: true,
      });
    }
    for (const loop of [face.outline, ...face.holes].map((c) => flattenContour(c, 0.5)))
      loop.forEach((a, i) => {
        const b = loop[(i + 1) % loop.length];
        const q = [slabPoint(m, a, m.lo), slabPoint(m, b, m.lo), slabPoint(m, b, m.hi), slabPoint(m, a, m.hi)];
        tris.push(
          { p: [q[0], q[1], q[2]], colour: base, inner: true },
          { p: [q[0], q[2], q[3]], colour: base, inner: true },
        );
      });
  }
  return draw(tris, opts);
}

/** A filled pouch (`inflatedPouch`), on plain film. */
export function renderSurface(mesh: SurfaceMesh, tone: BoardTone, opts: ThumbnailOptions = {}): Image {
  const tris = mesh.triangles.map(([a, b, c]) => ({
    p: [mesh.positions[a], mesh.positions[b], mesh.positions[c]] as [Vec3, Vec3, Vec3],
    colour: TONES[tone],
  }));
  return draw(tris, opts);
}

const LINE: Partial<Record<EdgeRole, { colour: Rgb; width: number; dash?: [number, number] }>> = {
  cut: { colour: INK, width: 1.6 },
  crease: { colour: CREASE, width: 1.2, dash: [6, 4] },
  perforation: { colour: INK, width: 1.2, dash: [2, 3] },
  half_cut: { colour: CREASE, width: 1.2, dash: [8, 3] },
  glue_area: { colour: GLUE, width: 1 },
};

/** The flat dieline: faces on plain board, cuts in ink, creases dashed, glue areas amber. */
export function render2D(d: Dieline, tone: BoardTone, opts: ThumbnailOptions = {}): Image {
  const size = opts.size ?? 320;
  const k = opts.supersample ?? 2;
  const px = size * k;
  const scale = (px * 0.9) / Math.max(d.width, d.height, 1e-9);
  const ox = (px - d.width * scale) / 2;
  const oy = (px - d.height * scale) / 2;
  const at = (p: Pt): [number, number, number] => [ox + p[0] * scale, oy + p[1] * scale, 0];
  const raster = new Raster(px, px, BACKGROUND);
  for (const face of allFaces(d))
    for (const tri of triangulate(facePolygons(face)))
      if (tri.length === 3) raster.triangle(at(tri[0]), at(tri[1]), at(tri[2]), TONES[tone]);
  const lines = dielineLines(d);
  for (const role of ["glue_area", "crease", "half_cut", "perforation", "cut"] as EdgeRole[]) {
    const style = LINE[role];
    if (!style) continue;
    for (const l of lines.filter((x) => x.role === role)) {
      // `flattenEdge` leaves out the end point, so edges chain without repeats.
      const pts = [...flattenEdge(l.edge, 0.3), l.edge.to];
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [at(pts[i - 1]), at(pts[i])];
        raster.line(
          a[0],
          a[1],
          b[0],
          b[1],
          style.width * k,
          style.colour,
          style.dash?.map((x) => x * k) as [number, number],
        );
      }
    }
  }
  return raster.downsample(k);
}
