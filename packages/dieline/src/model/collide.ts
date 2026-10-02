import { allFaces } from "../faces";
import { applyMat4, foldDieline, lift, type Mat4, type Vec3 } from "../fold";
import { edgeKey } from "../lines";
import { offsetFace, triangulate } from "../offset";
import type { Dieline, HingeMap } from "../types";

/**
 * Collision check for the closed box (U3.3): no face may pass through another — a tuck through a
 * dust flap, a lock tongue through a side panel. Faces that share a fold line touch by design and
 * are skipped, and so are faces lying in one plane (layers: the thickness model stacks them).
 * Each face is shrunk by `CONTACT_MM` first, so faces that only touch along an edge never count.
 */

export const CONTACT_MM = 0.3;

type Tri = [Vec3, Vec3, Vec3];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Möller–Trumbore, limited to the segment p → q (strictly inside both). */
function segmentHits(p: Vec3, q: Vec3, [a, b, c]: Tri): boolean {
  const d = sub(q, p);
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const h = cross(d, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const f = 1 / det;
  const s = sub(p, a);
  const u = f * dot(s, h);
  if (u <= 1e-6 || u >= 1 - 1e-6) return false;
  const qv = cross(s, e1);
  const v = f * dot(d, qv);
  if (v <= 1e-6 || u + v >= 1 - 1e-6) return false;
  const t = f * dot(e2, qv);
  return t > 1e-6 && t < 1 - 1e-6;
}

function trianglesCross(x: Tri, y: Tri): boolean {
  for (const [p, q] of [
    [x[0], x[1]],
    [x[1], x[2]],
    [x[2], x[0]],
  ] as [Vec3, Vec3][])
    if (segmentHits(p, q, y)) return true;
  for (const [p, q] of [
    [y[0], y[1]],
    [y[1], y[2]],
    [y[2], y[0]],
  ] as [Vec3, Vec3][])
    if (segmentHits(p, q, x)) return true;
  return false;
}

interface Solid {
  id: string;
  tris: Tri[];
  normal: Vec3;
  offset: number;
  min: Vec3;
  max: Vec3;
}

function solidOf(id: string, polys: ReturnType<typeof offsetFace>, m: Mat4): Solid | null {
  const tris = triangulate(polys)
    .filter((t) => t.length === 3)
    .map((t) => t.map((p) => applyMat4(m, lift(p))) as Tri);
  if (!tris.length) return null;
  const n: Vec3 = [m[8], m[9], m[10]];
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const t of tris)
    for (const p of t)
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
  return { id, tris, normal: n, offset: dot(n, tris[0][0]), min, max };
}

/** Pairs of face ids that pass through each other when the box is closed. */
export function collisions(d: Dieline, hinges: HingeMap): [string, string][] {
  const transforms = foldDieline(d, hinges, 1);
  const faces = allFaces(d);
  const neighbours = new Map<string, Set<string>>();
  const owners = new Map<string, string[]>();
  for (const f of faces)
    for (const e of f.outline) if (e.role !== "cut") owners.set(edgeKey(e), [...(owners.get(edgeKey(e)) ?? []), f.id]);
  for (const ids of owners.values())
    for (const a of ids)
      for (const b of ids) if (a !== b) neighbours.set(a, new Set([...(neighbours.get(a) ?? []), b]));

  const solids = faces
    .map((f) => solidOf(f.id, offsetFace(f, -CONTACT_MM), transforms.get(f.id)!))
    .filter((s): s is Solid => s !== null);
  const out: [string, string][] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      if (neighbours.get(a.id)?.has(b.id)) continue;
      if ([0, 1, 2].some((k) => a.max[k] < b.min[k] || b.max[k] < a.min[k])) continue;
      const c = dot(a.normal, b.normal);
      if (Math.abs(c) > 0.999 && Math.abs(a.offset - Math.sign(c) * b.offset) < 0.3) continue;
      if (a.tris.some((x) => b.tris.some((y) => trianglesCross(x, y)))) out.push([a.id, b.id]);
    }
  }
  return out;
}
