import type { Contour, Dieline, Edge, Face, Piece, Pt } from "./types";

/**
 * The dieline as seen from the other side of the board — the inside of the box (U4.3 inside
 * printing): every point mirrored across the sheet's vertical centre line. Contours are walked
 * backwards so each keeps its winding (outlines and holes turn the way the offsetting and the
 * checks expect); an arc keeps its `clockwise`, since the mirror and the reversal each flip it.
 * Face ids, labels and kinds are unchanged, so artwork anchored to a face stays anchored to it.
 */
export function mirrorDieline(d: Dieline): Dieline {
  const x = (p: Pt): Pt => [d.width - p[0], p[1]];
  const edge = (e: Edge): Edge => {
    if (e.kind === "line") return { ...e, from: x(e.to), to: x(e.from) };
    if (e.kind === "arc") return { ...e, from: x(e.to), to: x(e.from), center: x(e.center) };
    return { ...e, from: x(e.to), to: x(e.from), c1: x(e.c2), c2: x(e.c1) };
  };
  const contour = (c: Contour): Contour => [...c].reverse().map(edge);
  const face = (f: Face): Face => ({
    ...f,
    outline: contour(f.outline),
    holes: f.holes.map(contour),
    marks: f.marks.map(edge),
  });
  const piece = (p: Piece): Piece => ({
    ...p,
    faces: p.faces.map(face),
    bounds: { ...p.bounds, x: d.width - p.bounds.x - p.bounds.width },
    annotations: p.annotations.map((a) => ({ ...a, from: x(a.from), to: x(a.to) })),
  });
  return { ...d, pieces: d.pieces.map(piece) };
}

/** A point on the printed side's sheet, in the inside's (mirrored) sheet frame — and back. */
export const mirrorPoint = (d: Pick<Dieline, "width">, p: Pt): Pt => [d.width - p[0], p[1]];
