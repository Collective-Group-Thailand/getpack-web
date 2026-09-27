import { edgeKey, dielineLines, sharedEdgeRoles } from "./lines";
import { overlapArea } from "./offset";
import { contourGap, dist, edgesBounds } from "./path";
import type { Dieline, Pt } from "./types";

/** A geometric defect in a built dieline — a bug in a style, never a customer input error. */
export interface GeometryProblem {
  code:
    | "face.duplicate_id"
    | "contour.open"
    | "hole.open"
    | "boundary.not_cut"
    | "crease.not_shared"
    | "edge.role_conflict"
    | "cut.dangling"
    | "faces.overlap"
    | "piece.disconnected";
  detail: string;
}

/** Closure tolerance for chains and cut networks: 0.01 mm. */
export const CLOSURE_TOLERANCE_MM = 0.01;
/** Overlap tolerance: flattened curves may disagree by slivers; 0.05 mm² is far below any real overlap. */
export const OVERLAP_TOLERANCE_MM2 = 0.05;

const FOLD_ROLES = new Set(["crease", "perforation", "half_cut"]);

/**
 * Checks a dieline can actually be cut and folded:
 * face ids unique; every outline and hole closed (≤ 0.01 mm); every free edge cut; every fold
 * shared by exactly two faces; no face overlaps another; every cut line ends on another line
 * (no dangling slit); the faces of each piece form one connected blank.
 */
export function checkDieline(d: Dieline): GeometryProblem[] {
  const problems: GeometryProblem[] = [];
  const ids = new Set<string>();
  for (const piece of d.pieces) {
    for (const f of piece.faces) {
      if (ids.has(f.id)) problems.push({ code: "face.duplicate_id", detail: f.id });
      ids.add(f.id);
      const gap = contourGap(f.outline);
      if (gap > CLOSURE_TOLERANCE_MM)
        problems.push({ code: "contour.open", detail: `${f.id} gap ${gap.toFixed(4)} mm` });
      f.holes.forEach((h, i) => {
        const hg = contourGap(h);
        if (hg > CLOSURE_TOLERANCE_MM)
          problems.push({ code: "hole.open", detail: `${f.id} hole ${i} gap ${hg.toFixed(4)} mm` });
      });
    }
  }

  for (const shared of sharedEdgeRoles(d)) {
    if (shared.faces.length === 1) {
      if (shared.roles[0] !== "cut")
        problems.push({ code: "boundary.not_cut", detail: `${shared.faces[0]} ${shared.key} is ${shared.roles[0]}` });
      continue;
    }
    if (shared.faces.length > 2)
      problems.push({ code: "edge.role_conflict", detail: `${shared.faces.join(",")} share ${shared.key}` });
    if (new Set(shared.roles).size > 1) {
      problems.push({ code: "edge.role_conflict", detail: `${shared.faces.join(",")}: ${shared.roles.join("/")}` });
    }
  }

  // Folds must hinge two faces; a fold with one face is a fold to nowhere.
  const lines = dielineLines(d);
  for (const l of lines) {
    if (l.source === "outline" && FOLD_ROLES.has(l.role) && l.faces.length < 2) {
      problems.push({ code: "crease.not_shared", detail: `${l.faces[0]} ${edgeKey(l.edge)}` });
    }
  }

  // Every endpoint of a cut must meet another line's endpoint (or lie on it): a cut that stops in
  // mid-board tears.
  for (const piece of d.pieces) {
    const pieceLines = lines.filter((l) => l.pieceId === piece.id && l.role !== "bleed" && l.role !== "glue_area");
    const ends: Pt[] = pieceLines.flatMap((l) => [l.edge.from, l.edge.to]);
    for (const l of pieceLines) {
      if (l.role !== "cut" || l.source === "mark") continue;
      for (const end of [l.edge.from, l.edge.to]) {
        let meets = 0;
        for (const other of ends) if (dist(end, other) <= CLOSURE_TOLERANCE_MM) meets++;
        // The line's own endpoint counts once; it needs at least one other.
        if (meets < 2)
          problems.push({
            code: "cut.dangling",
            detail: `${l.faces.join(",")} at ${end[0].toFixed(3)},${end[1].toFixed(3)}`,
          });
      }
    }
  }

  for (const piece of d.pieces) {
    const faces = piece.faces;
    for (let i = 0; i < faces.length; i++) {
      const bi = edgesBounds(faces[i].outline);
      for (let j = i + 1; j < faces.length; j++) {
        const bj = edgesBounds(faces[j].outline);
        if (bi.x >= bj.x + bj.width || bj.x >= bi.x + bi.width || bi.y >= bj.y + bj.height || bj.y >= bi.y + bi.height)
          continue;
        const area = overlapArea(faces[i], faces[j]);
        if (area > OVERLAP_TOLERANCE_MM2) {
          problems.push({ code: "faces.overlap", detail: `${faces[i].id} × ${faces[j].id} ${area.toFixed(3)} mm²` });
        }
      }
    }

    // Connectivity through shared edges.
    const byKey = new Map<string, string[]>();
    for (const f of faces) for (const e of f.outline) byKey.set(edgeKey(e), [...(byKey.get(edgeKey(e)) ?? []), f.id]);
    const adjacent = new Map<string, Set<string>>(faces.map((f) => [f.id, new Set<string>()]));
    for (const owners of byKey.values()) {
      for (const a of owners) for (const b of owners) if (a !== b) adjacent.get(a)?.add(b);
    }
    if (faces.length > 0) {
      const seen = new Set<string>([faces[0].id]);
      const queue = [faces[0].id];
      while (queue.length) {
        for (const next of adjacent.get(queue.shift()!) ?? []) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      if (seen.size !== faces.length) {
        const lost = faces.filter((f) => !seen.has(f.id)).map((f) => f.id);
        problems.push({ code: "piece.disconnected", detail: `${piece.id}: ${lost.join(",")}` });
      }
    }
  }
  return problems;
}
