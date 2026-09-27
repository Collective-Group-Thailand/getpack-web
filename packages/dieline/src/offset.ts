import { ClipType, Clipper, EndType, FillRule, JoinType, type PathD, type PathsD } from "clipper2-ts";

import { FLATTEN_TOLERANCE_MM, flattenContour } from "./path";
import type { Face, Piece, Pt } from "./types";

/**
 * Offsetting and area maths on flattened geometry, through Clipper2 — robust for non-convex faces,
 * holes and curves where a naive vertex-normal inset folds over itself. Curves are flattened to
 * within `FLATTEN_TOLERANCE_MM` (0.2 mm) only here, never in the exported die.
 */

/** Decimal places Clipper keeps: 0.001 mm. */
const PRECISION = 3;

const toPath = (pts: Pt[]): PathD => pts.map(([x, y]) => ({ x, y }));
const union = (paths: PathsD): PathsD => Clipper.booleanOpD(ClipType.Union, paths, null, FillRule.NonZero, PRECISION);
const fromPath = (p: PathD): Pt[] => p.map((q) => [q.x, q.y]);

/** A face as Clipper paths: its outline minus its holes, cleaned up. */
function facePaths(f: Face, tol: number): PathsD {
  const outer = union([toPath(flattenContour(f.outline, tol))]);
  if (f.holes.length === 0) return outer;
  const holes = f.holes.map((h) => toPath(flattenContour(h, tol)));
  return Clipper.differenceD(outer, holes, FillRule.NonZero, PRECISION);
}

/**
 * Grows (positive) or shrinks (negative) a face by `deltaMm`. Returns polygons: outer boundaries
 * run one way and holes the other; draw them with the even-odd rule. Empty when a face is too
 * small for the inset.
 */
export function offsetFace(f: Face, deltaMm: number, tol = FLATTEN_TOLERANCE_MM): Pt[][] {
  const paths = facePaths(f, tol);
  if (deltaMm === 0) return paths.map(fromPath);
  const out = Clipper.inflatePathsD(paths, deltaMm, JoinType.Miter, EndType.Polygon, 4, PRECISION);
  return out.map(fromPath);
}

/** The printable safe zone of a face: inset from every cut, fold and hole by `insetMm`. */
export function safeZone(f: Face, insetMm: number, tol = FLATTEN_TOLERANCE_MM): Pt[][] {
  return offsetFace(f, -Math.abs(insetMm), tol);
}

/** The face as polygons (outline and holes), for rendering and hit-testing. */
export function facePolygons(f: Face, tol = FLATTEN_TOLERANCE_MM): Pt[][] {
  return facePaths(f, tol).map(fromPath);
}

/** The outer shape of a piece: all its faces merged, holes removed. */
export function pieceOutline(p: Piece, tol = FLATTEN_TOLERANCE_MM): Pt[][] {
  const all = p.faces.flatMap((f) => facePaths(f, tol));
  return union(all).map(fromPath);
}

/** How far artwork must run past the cut: the piece outline grown by `bleedMm` (windows shrink). */
export function bleedOutline(p: Piece, bleedMm: number, tol = FLATTEN_TOLERANCE_MM): Pt[][] {
  const all = p.faces.flatMap((f) => facePaths(f, tol));
  const merged = union(all);
  return Clipper.inflatePathsD(merged, Math.abs(bleedMm), JoinType.Miter, EndType.Polygon, 4, PRECISION).map(fromPath);
}

/** Total area of polygons in mm² (holes subtract). */
export function polygonsArea(polys: Pt[][]): number {
  return Math.abs(Clipper.areaPathsD(polys.map(toPath)));
}

/** Area two faces cover in common, in mm² — zero for neighbours that only share an edge. */
export function overlapArea(a: Face, b: Face, tol = FLATTEN_TOLERANCE_MM): number {
  const shared = Clipper.intersectD(facePaths(a, tol), facePaths(b, tol), FillRule.NonZero, PRECISION);
  return Math.abs(Clipper.areaPathsD(shared));
}

/** Triangles of a polygon set (outer + holes), for 3D meshes. */
export function triangulate(polys: Pt[][]): Pt[][] {
  if (polys.length === 0) return [];
  const { solution } = Clipper.triangulateD(polys.map(toPath), PRECISION);
  return solution.map(fromPath);
}
