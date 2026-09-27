import { round3 } from "./path";
import type { Dieline, Edge, EdgeRole } from "./types";

/** One line of the die: an edge, the faces it bounds, and whether it is a boundary, a hole or a mark. */
export interface DielineLine {
  edge: Edge;
  role: EdgeRole;
  pieceId: string;
  /** Faces this line belongs to — two for a shared fold or slit, one for a free edge. */
  faces: string[];
  source: "outline" | "hole" | "mark";
}

const k = (p: [number, number]) => `${round3(p[0])},${round3(p[1])}`;

/** A key equal for the same geometry walked either way. */
export function edgeKey(e: Edge): string {
  const a = k(e.from);
  const b = k(e.to);
  const forward = a <= b;
  const ends = forward ? `${a}|${b}` : `${b}|${a}`;
  if (e.kind === "line") return `L${ends}`;
  if (e.kind === "arc") return `A${ends}|${k(e.center)}|${round3(e.radius)}|${forward === e.clockwise ? 1 : 0}`;
  return `B${ends}|${forward ? `${k(e.c1)}|${k(e.c2)}` : `${k(e.c2)}|${k(e.c1)}`}`;
}

/** Folding lines win over a cut where two faces disagree; a checker reports the disagreement. */
const STRENGTH: Record<EdgeRole, number> = {
  crease: 5,
  perforation: 4,
  half_cut: 3,
  cut: 2,
  glue_area: 1,
  bleed: 0,
};

/**
 * Every line of the dieline once. Edges two faces share (a fold between a panel and its flap, a
 * slit between two flaps) appear a single time with both faces listed, in a stable order: piece
 * by piece, face by face, edge by edge — so exports are byte-identical run to run.
 */
export function dielineLines(d: Dieline): DielineLine[] {
  const out: DielineLine[] = [];
  for (const piece of d.pieces) {
    const index = new Map<string, DielineLine>();
    for (const f of piece.faces) {
      for (const e of f.outline) {
        const key = edgeKey(e);
        const seen = index.get(key);
        if (seen) {
          if (!seen.faces.includes(f.id)) seen.faces.push(f.id);
          if (STRENGTH[e.role] > STRENGTH[seen.role]) seen.role = e.role;
          continue;
        }
        const line: DielineLine = { edge: e, role: e.role, pieceId: piece.id, faces: [f.id], source: "outline" };
        index.set(key, line);
        out.push(line);
      }
      for (const hole of f.holes) {
        for (const e of hole) out.push({ edge: e, role: e.role, pieceId: piece.id, faces: [f.id], source: "hole" });
      }
      for (const e of f.marks) out.push({ edge: e, role: e.role, pieceId: piece.id, faces: [f.id], source: "mark" });
    }
  }
  return out;
}

/** Shared-edge roles as the two faces declared them, for checks. */
export function sharedEdgeRoles(d: Dieline): { key: string; roles: EdgeRole[]; faces: string[] }[] {
  const out: { key: string; roles: EdgeRole[]; faces: string[] }[] = [];
  for (const piece of d.pieces) {
    const index = new Map<string, { key: string; roles: EdgeRole[]; faces: string[] }>();
    for (const f of piece.faces) {
      for (const e of f.outline) {
        const key = edgeKey(e);
        const entry = index.get(key) ?? { key, roles: [], faces: [] };
        entry.roles.push(e.role);
        entry.faces.push(f.id);
        if (!index.has(key)) {
          index.set(key, entry);
          out.push(entry);
        }
      }
    }
  }
  return out;
}
