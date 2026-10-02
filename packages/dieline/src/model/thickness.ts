import { allFaces } from "../faces";
import { applyMat4, foldDieline, hingesOf, lift, type Box3, type Mat4, type Vec3 } from "../fold";
import { flattenContour } from "../path";
import type { Dieline, Face, FaceKind, HingeMap, MaterialSpec } from "../types";

/**
 * The folded box with board thickness (U3.3): every face is a slab of the caliper, placed where a
 * real board would lie. Pure geometry — the app's WebGL preview, the virtual fold test, the asset
 * renderer and the drawing service read the same model.
 *
 * Where a slab lies, along the face's outward normal (its printed side), relative to the plane the
 * zero-thickness fold puts it in (the crease mid-plane):
 * - **walls** (`panel`, `wall`, `hanger`, `handle`) are centred on it — panels are scored at
 *   inside + t, so a wall's inner face is the inside size and its outer face inside + 2t;
 * - **everything that closes onto a plane** (lids, flaps, tucks, bases, glue flaps) lies *inward*
 *   of it, so the closure layers fill the depth allowance (depth + 2t) and the outer size stays
 *   inside + 2t;
 * - faces that close onto the same plane and overlap **stack inward in fold order**: the last to
 *   close (a lid) is outermost, the first (its dust flaps) under it; a tuck behind its panel.
 * Rigid boards carry a paper wrap on their outer face (`WRAP_MM`).
 */

/** The paper wrapped round rigid greyboard, mm. ⚠ typical 120–157 g/m² wrap. */
export const WRAP_MM = 0.15;

const CENTRED: FaceKind[] = ["panel", "wall", "hanger", "handle", "flat"];

export interface ModelFace {
  id: string;
  kind: FaceKind;
  stage: number;
  /** The face's fold transform (sheet → 3D, as `foldDieline`). */
  matrix: Mat4;
  /** Slab extent along the face's printed-side normal, mm: inner (`lo`) and outer (`hi`) surface. */
  lo: number;
  hi: number;
}

export interface FoldedModel {
  faces: ModelFace[];
  caliperMm: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalOf = (m: Mat4): Vec3 => {
  const n: Vec3 = [m[8], m[9], m[10]];
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
};

/** Fold stage per face: the hinge tree's, the roots 0. */
function stagesOf(d: Dieline, hinges: HingeMap): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of d.pieces) {
    const { root, hinges: list } = hingesOf(p, hinges);
    out.set(root, 0);
    for (const h of list) out.set(h.child, h.stage);
  }
  return out;
}

interface Placed {
  face: Face;
  matrix: Mat4;
  normal: Vec3;
  offset: number;
  /** The face's footprint in its plane, for overlap: [u0, u1, v0, v1]. */
  box: [number, number, number, number];
  stage: number;
}

/**
 * Layers per face at the closed state: `layer` 0 is the outermost slot of its plane (−1: a wall,
 * centred; −2: a wall glued back to back with another, on its own side), `flip` when the face's printed side looks into the box (folded through 180°, like a
 * rolled inner wall), so its slab is stacked along its normal rather than against it.
 */
function layers(placed: Placed[], t: number): Map<string, { layer: number; flip: boolean }> {
  const out = new Map<string, { layer: number; flip: boolean }>();
  const groups: Placed[][] = [];
  for (const p of placed) {
    const g = groups.find((q) => {
      const c = dot(q[0].normal, p.normal);
      return Math.abs(c) > 0.999 && Math.abs(q[0].offset - Math.sign(c) * p.offset) < 0.25;
    });
    if (g) g.push(p);
    else groups.push([p]);
  }
  const overlaps = (a: Placed, b: Placed) => {
    const w = Math.min(a.box[1], b.box[1]) - Math.max(a.box[0], b.box[0]);
    const h = Math.min(a.box[3], b.box[3]) - Math.max(a.box[2], b.box[2]);
    return w > 0.5 && h > 0.5;
  };
  const walls = groups.filter((g) => g.some((p) => CENTRED.includes(p.face.kind)));
  /**
   * A plane of closing faces one caliper outside an overlapping wall (a mailer's front flap over its
   * front wall — its lid is cut t longer for that): the faces wrap the wall, centred on their plane.
   */
  const wraps = (g: Placed[]) =>
    !g.some((p) => CENTRED.includes(p.face.kind)) &&
    walls.some((w) => {
      const c = dot(w[0].normal, g[0].normal);
      const wall = w.find((p) => CENTRED.includes(p.face.kind))!;
      const gap = Math.sign(c) * g[0].offset - w[0].offset;
      const outward = dot(wall.normal, w[0].normal) > 0 ? gap : -gap;
      return Math.abs(c) > 0.999 && outward > 0.75 * t && outward < 1.25 * t && g.some((p) => overlaps(wall, p));
    });
  for (const g of groups) {
    // Walls first (they define the plane), then the closing faces, last to close outermost.
    const order = [...g].sort(
      (a, b) =>
        Number(!CENTRED.includes(a.face.kind)) - Number(!CENTRED.includes(b.face.kind)) ||
        b.stage - a.stage ||
        (a.face.id < b.face.id ? -1 : 1),
    );
    const wrapping = wraps(g);
    // Outward for the whole plane: its wall's printed side, or else the last face to close.
    const ref = order[0].normal;
    const here: { p: Placed; layer: number }[] = [];
    for (const p of order) {
      const flip = dot(p.normal, ref) < 0;
      if (CENTRED.includes(p.face.kind)) {
        // Two walls back to back (a gable's handle panels) each lie on their own side of the plane.
        const backToBack = g.some(
          (q) => q !== p && CENTRED.includes(q.face.kind) && dot(q.normal, p.normal) < 0 && overlaps(q, p),
        );
        out.set(p.face.id, { layer: backToBack ? -2 : -1, flip });
        here.push({ p, layer: -1 });
        continue;
      }
      const taken = here.filter((q) => overlaps(q.p, p)).map((q) => q.layer);
      let layer = 0;
      while (taken.includes(layer)) layer++;
      // A face stacked under a centred wall (or wrapping one, centred itself) starts half a caliper in.
      const under = wrapping || here.some((q) => q.layer === -1 && overlaps(q.p, p)) ? 0.5 : 0;
      out.set(p.face.id, { layer: wrapping ? layer - 0.5 : layer + under, flip });
      here.push({ p, layer });
    }
  }
  return out;
}

function basis(n: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: Vec3 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  const ul = Math.hypot(...u);
  const uu: Vec3 = [u[0] / ul, u[1] / ul, u[2] / ul];
  const v: Vec3 = [n[1] * uu[2] - n[2] * uu[1], n[2] * uu[0] - n[0] * uu[2], n[0] * uu[1] - n[1] * uu[0]];
  return [uu, v];
}

/**
 * The model at `progress` (0 flat, 1 closed). Layers are worked out once, closed, and eased in with
 * the fold so the flat sheet lies flat.
 */
export function foldModel(d: Dieline, hinges: HingeMap, material: MaterialSpec, progress = 1): FoldedModel {
  const t = Math.max(0, material.caliperMm);
  const stages = stagesOf(d, hinges);
  const closed = foldDieline(d, hinges, 1);
  const now = progress === 1 ? closed : foldDieline(d, hinges, progress);
  const placed: Placed[] = allFaces(d).map((face) => {
    const matrix = closed.get(face.id)!;
    const normal = normalOf(matrix);
    const pts = flattenContour(face.outline, 0.5).map((p) => applyMat4(matrix, lift(p)));
    // The footprint's axes must not depend on which way the face looks: faces back to back share them.
    const k = Math.abs(normal[0]) > 1e-6 ? normal[0] : Math.abs(normal[1]) > 1e-6 ? normal[1] : normal[2];
    const [u, v] = basis(k < 0 ? [-normal[0], -normal[1], -normal[2]] : normal);
    const us = pts.map((p) => dot(p, u));
    const vs = pts.map((p) => dot(p, v));
    return {
      face,
      matrix,
      normal,
      offset: dot(pts[0], normal),
      box: [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)],
      stage: stages.get(face.id) ?? 0,
    };
  });
  const layer = layers(placed, t);
  const wrap = material.kind === "rigid" ? WRAP_MM : 0;
  return {
    caliperMm: t,
    faces: placed.map(({ face, stage }) => {
      const { layer: l, flip } = layer.get(face.id)!;
      // Closed: centred walls, or layer l inward of the plane (outward along a flipped face's
      // normal is inward of the box); flat: every slab centred.
      const [lc, hc] =
        l === -1 ? [-t / 2, t / 2] : l === -2 ? [0, t] : flip ? [l * t, (l + 1) * t] : [-(l + 1) * t, -l * t];
      const lerp = (flat: number, shut: number) => flat + (shut - flat) * progress;
      return {
        id: face.id,
        kind: face.kind,
        stage,
        matrix: now.get(face.id)!,
        lo: lerp(-t / 2, lc),
        hi: lerp(t / 2, hc) + wrap,
      };
    }),
  };
}

/** A sheet point of a face lifted onto one of its slab surfaces (`z` along its normal). */
export function slabPoint(f: ModelFace, p: [number, number], z: number): Vec3 {
  const q = applyMat4(f.matrix, lift(p));
  const n = normalOf(f.matrix);
  return [q[0] + n[0] * z, q[1] + n[1] * z, q[2] + n[2] * z];
}

/** The model's outer bounds, optionally leaving out faces that stand proud by design (hangers, handles). */
export function modelBounds(d: Dieline, model: FoldedModel, ignore: FaceKind[] = ["hanger", "handle"]): Box3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const byId = new Map(allFaces(d).map((f) => [f.id, f]));
  for (const f of model.faces) {
    if (ignore.includes(f.kind)) continue;
    for (const p of flattenContour(byId.get(f.id)!.outline, 0.5)) {
      for (const z of [f.lo, f.hi]) {
        const q = slabPoint(f, p, z);
        for (let i = 0; i < 3; i++) {
          if (q[i] < min[i]) min[i] = q[i];
          if (q[i] > max[i]) max[i] = q[i];
        }
      }
    }
  }
  return { min, max };
}
