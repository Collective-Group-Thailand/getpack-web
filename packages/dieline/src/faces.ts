import { edgesBounds, mapEdge, translate, type PtMap } from "./path";
import type { FaceLabel, PieceLabel } from "./labels";
import type { Annotation, Bounds, Contour, Dieline, Edge, Face, FaceKind, Piece } from "./types";

/** Space between separately cut pieces laid out on one sheet, in mm. */
export const PIECE_GAP_MM = 20;

export function face(
  id: string,
  label: FaceLabel,
  kind: FaceKind,
  outline: Contour,
  extra: { holes?: Contour[]; marks?: Edge[] } = {},
): Face {
  return { id, label, kind, outline, holes: extra.holes ?? [], marks: extra.marks ?? [] };
}

export function faceBounds(f: Face): Bounds {
  return edgesBounds(f.outline);
}

export function mapFace(f: Face, map: PtMap, flips = false): Face {
  return {
    ...f,
    outline: f.outline.map((e) => mapEdge(e, map, flips)),
    holes: f.holes.map((h) => h.map((e) => mapEdge(e, map, flips))),
    marks: f.marks.map((e) => mapEdge(e, map, flips)),
  };
}

function mapAnnotation(a: Annotation, map: PtMap): Annotation {
  return { ...a, from: map(a.from), to: map(a.to) };
}

function boundsOfFaces(faces: Face[]): Bounds {
  return edgesBounds(faces.flatMap((f) => f.outline));
}

export function piece(id: string, label: PieceLabel, faces: Face[], annotations: Annotation[] = []): Piece {
  return { id, label, faces, bounds: boundsOfFaces(faces), annotations };
}

export function mapPiece(p: Piece, map: PtMap, flips = false): Piece {
  const faces = p.faces.map((f) => mapFace(f, map, flips));
  return { ...p, faces, bounds: boundsOfFaces(faces), annotations: p.annotations.map((a) => mapAnnotation(a, map)) };
}

/**
 * Lays pieces out left to right, each moved so it starts at the origin row, with
 * `PIECE_GAP_MM` between them, and anchors the whole layout at (0, 0).
 */
export function assemble(styleId: string, pieces: Piece[], gap = PIECE_GAP_MM): Dieline {
  let x = 0;
  let height = 0;
  const placed = pieces.map((p) => {
    const moved = mapPiece(p, translate(x - p.bounds.x, -p.bounds.y));
    x += moved.bounds.width + gap;
    height = Math.max(height, moved.bounds.height);
    return moved;
  });
  const width = placed.length ? x - gap : 0;
  return { styleId, pieces: placed, width, height };
}

export const allFaces = (d: Dieline): Face[] => d.pieces.flatMap((p) => p.faces);

export function findFace(d: Dieline, id: string): Face | undefined {
  return allFaces(d).find((f) => f.id === id);
}
