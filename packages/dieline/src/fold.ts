import { edgeKey } from "./lines";
import { flattenContour } from "./path";
import type { Dieline, Face, FaceKind, HingeMap, Piece, Pt } from "./types";

/**
 * Folding the flat dieline into its box, as rigid-body transforms per face — pure maths, so the
 * designer's WebGL preview, tests and the drawing service all fold the same way.
 *
 * 3D frame: X = sheet x, Y = −(sheet y) so up is up, Z towards the viewer. The flat lies in Z = 0
 * with its printed side facing +Z; every fold turns a face **away** from the printed side, so
 * the box forms behind its root face and the print ends up outside.
 */

/** A 4 × 4 matrix, column-major (the order WebGL and three.js `Matrix4.fromArray` use). */
export type Mat4 = number[];
export type Vec3 = [number, number, number];

export interface Hinge {
  parent: string;
  child: string;
  /** The fold line, in sheet coordinates, as the parent lists it. */
  from: Pt;
  to: Pt;
  /** Closed angle, degrees. */
  angle: number;
  stage: number;
}

/** Default fold stage per kind: walls first, then flaps and locks, then lids, then tucks. */
const STAGE: Record<FaceKind, number> = {
  panel: 0,
  wall: 0,
  base: 0,
  glue_flap: 0,
  hanger: 0,
  flat: 0,
  dust_flap: 1,
  flap: 1,
  lock: 1,
  tab: 1,
  lid: 2,
  handle: 2,
  tuck: 3,
};

const FOLD_ROLES = new Set(["crease", "half_cut", "perforation"]);

export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export const translation = (x: number, y: number, z: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

/** Rotation by `angle` radians about the unit axis `u` through the origin (Rodrigues). */
export function rotation(u: Vec3, angle: number): Mat4 {
  const [x, y, z] = u;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    0,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    0,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1,
  ];
}

export function applyMat4(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** A sheet point in the 3D frame (flat state). */
export const lift = (p: Pt): Vec3 => [p[0], -p[1], 0];

function centroid(f: Face): Pt {
  const pts = flattenContour(f.outline, 0.5);
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** The fold tree of one piece: a breadth-first walk from its root across shared fold lines. */
export function hingesOf(piece: Piece, map: HingeMap): { root: string; hinges: Hinge[] } {
  const root = map.roots[piece.id] ?? piece.faces[0]?.id;
  const byKey = new Map<string, { face: Face; from: Pt; to: Pt }[]>();
  for (const f of piece.faces) {
    for (const e of f.outline) {
      // Curved creases (a pillow box's ends) hinge about their chord.
      if (!FOLD_ROLES.has(e.role) || e.kind === "bezier") continue;
      const key = edgeKey(e);
      byKey.set(key, [...(byKey.get(key) ?? []), { face: f, from: e.from, to: e.to }]);
    }
  }
  const neighbours = new Map<string, { face: Face; from: Pt; to: Pt }[]>();
  for (const owners of byKey.values()) {
    if (owners.length !== 2) continue;
    const [a, b] = owners;
    neighbours.set(a.face.id, [...(neighbours.get(a.face.id) ?? []), { face: b.face, from: a.from, to: a.to }]);
    neighbours.set(b.face.id, [...(neighbours.get(b.face.id) ?? []), { face: a.face, from: b.from, to: b.to }]);
  }
  const hinges: Hinge[] = [];
  const seen = new Set<string>([root]);
  const queue = [root];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const n of neighbours.get(parent) ?? []) {
      if (seen.has(n.face.id)) continue;
      seen.add(n.face.id);
      queue.push(n.face.id);
      hinges.push({
        parent,
        child: n.face.id,
        from: n.from,
        to: n.to,
        angle: map.angles?.[n.face.id] ?? 90,
        stage: map.stages?.[n.face.id] ?? STAGE[n.face.kind],
      });
    }
  }
  return { root, hinges };
}

/**
 * Face transforms for one piece at `progress` (0 = flat, 1 = closed). Stages run one after the
 * other, so walls stand before the flaps close over them.
 */
export function foldPiece(piece: Piece, map: HingeMap, progress: number): Map<string, Mat4> {
  const { root, hinges } = hingesOf(piece, map);
  const faces = new Map(piece.faces.map((f) => [f.id, f]));
  const stages = Math.max(1, ...hinges.map((h) => h.stage + 1));
  const out = new Map<string, Mat4>([[root, identity()]]);
  for (const h of hinges) {
    const parentM = out.get(h.parent) ?? identity();
    const local = Math.min(1, Math.max(0, progress * stages - h.stage));
    const angle = (h.angle * Math.PI * local) / 180;
    const a = lift(h.from);
    const b = lift(h.to);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let u: Vec3 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, 0];
    // Pick the direction that turns the child away from the printed side (towards −Z).
    const c = lift(centroid(faces.get(h.child)!));
    const probe = applyMat4(
      multiply(translation(a[0], a[1], 0), multiply(rotation(u, 0.1), translation(-a[0], -a[1], 0))),
      c,
    );
    if (probe[2] > 0) u = [-u[0], -u[1], 0];
    const hinge = multiply(translation(a[0], a[1], 0), multiply(rotation(u, angle), translation(-a[0], -a[1], 0)));
    out.set(h.child, multiply(parentM, hinge));
  }
  // Faces not reached by a fold (should not happen in a valid style) stay flat with the root.
  for (const f of piece.faces) if (!out.has(f.id)) out.set(f.id, identity());
  return out;
}

export interface Box3 {
  min: Vec3;
  max: Vec3;
}

function boundsOfTransformed(faces: Face[], transforms: Map<string, Mat4>): Box3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    const m = transforms.get(f.id) ?? identity();
    for (const p of flattenContour(f.outline, 0.5)) {
      const q = applyMat4(m, lift(p));
      for (let i = 0; i < 3; i++) {
        if (q[i] < min[i]) min[i] = q[i];
        if (q[i] > max[i]) max[i] = q[i];
      }
    }
  }
  return { min, max };
}

/**
 * Every face's transform for the whole dieline: each piece folded, then placed as the hinge map
 * says (a lid turned over and lifted above its base, a drawer slid into its sleeve), then turned
 * upright when the root is a base rather than a front panel.
 */
export function foldDieline(d: Dieline, map: HingeMap, progress = 1): Map<string, Mat4> {
  const out = new Map<string, Mat4>();
  const folded = new Map<string, Map<string, Mat4>>();
  for (const p of d.pieces) folded.set(p.id, foldPiece(p, map, progress));

  const upright = map.upright === "base" ? rotation([1, 0, 0], Math.PI / 2) : identity();
  const placedBounds = new Map<string, Box3>();
  for (const p of d.pieces) {
    let transforms = folded.get(p.id)!;
    transforms = new Map([...transforms].map(([id, m]) => [id, multiply(upright, m)]));
    const rule = map.placement?.[p.id];
    if (rule) {
      if (rule.rotate) {
        const b = boundsOfTransformed(p.faces, transforms);
        const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
        const [rx, ry, rz] = rule.rotate.map((deg) => (deg * Math.PI) / 180);
        const r = multiply(rotation([0, 0, 1], rz), multiply(rotation([0, 1, 0], ry), rotation([1, 0, 0], rx)));
        const turn = multiply(translation(c[0], c[1], c[2]), multiply(r, translation(-c[0], -c[1], -c[2])));
        transforms = new Map([...transforms].map(([id, m]) => [id, multiply(turn, m)]));
      }
      if (rule.flip) {
        const b = boundsOfTransformed(p.faces, transforms);
        const cy = (b.min[1] + b.max[1]) / 2;
        const cz = (b.min[2] + b.max[2]) / 2;
        const flip = multiply(translation(0, cy, cz), multiply(rotation([1, 0, 0], Math.PI), translation(0, -cy, -cz)));
        transforms = new Map([...transforms].map(([id, m]) => [id, multiply(flip, m)]));
      }
      const target = rule.over ?? rule.inside;
      const ref = target ? placedBounds.get(target) : undefined;
      if (ref) {
        const b = boundsOfTransformed(p.faces, transforms);
        const dx = (ref.min[0] + ref.max[0]) / 2 - (b.min[0] + b.max[0]) / 2;
        const dz = (ref.min[2] + ref.max[2]) / 2 - (b.min[2] + b.max[2]) / 2;
        // Over: sits on top, lifted by `lift` × progress so the closed state is assembled.
        const dy = rule.over
          ? ref.max[1] - b.min[1] - (rule.sink ?? 0) + (rule.lift ?? 0) * (1 - progress)
          : rule.floor !== undefined
            ? ref.min[1] + rule.floor - b.min[1] + (rule.lift ?? 0) * (1 - progress)
            : (ref.min[1] + ref.max[1]) / 2 - (b.min[1] + b.max[1]) / 2;
        const slide = rule.inside ? (rule.slide ?? 0) * (1 - progress) : 0;
        const move = translation(dx + slide, dy, dz);
        transforms = new Map([...transforms].map(([id, m]) => [id, multiply(move, m)]));
      }
    }
    placedBounds.set(p.id, boundsOfTransformed(p.faces, transforms));
    for (const [id, m] of transforms) out.set(id, m);
  }
  return out;
}

/** The folded box's bounds, optionally ignoring faces that stick out by design (hanger, handle). */
export function foldedBounds(d: Dieline, map: HingeMap, progress = 1, ignore: FaceKind[] = ["hanger", "handle"]): Box3 {
  const transforms = foldDieline(d, map, progress);
  const faces = d.pieces.flatMap((p) => p.faces).filter((f) => !ignore.includes(f.kind));
  return boundsOfTransformed(faces, transforms);
}
