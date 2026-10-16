import { allFaces, faceBounds, flattenContour, pointInPolygon, type Dieline, type Pt } from "@getpack/dieline";

import type { CommentAnchor } from "./anchor";

export { readAnchor, type CommentAnchor } from "./anchor";

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The face under a point of the sheet, if any. */
export function faceAt(d: Dieline, p: Pt): string | null {
  for (const f of allFaces(d)) if (pointInPolygon(p, flattenContour(f.outline, 0.5))) return f.id;
  return null;
}

/** A face anchor for a point on a face of the sheet (a 3D pick), or `null` off every face. */
export function faceAnchor(d: Dieline, p: Pt, faceId?: string | null): CommentAnchor | null {
  const id = faceId ?? faceAt(d, p);
  const face = id ? allFaces(d).find((f) => f.id === id) : undefined;
  if (!face) return null;
  const b = faceBounds(face);
  if (b.width <= 0 || b.height <= 0) return null;
  return {
    faceId: face.id,
    u: round(clamp01((p[0] - b.x) / b.width), 4),
    v: round(clamp01((p[1] - b.y) / b.height), 4),
  };
}

/** A flat anchor, to a tenth of a millimetre. */
export function flatAnchor(p: Pt): CommentAnchor {
  return { xMm: round(p[0], 1), yMm: round(p[1], 1) };
}

/** The anchor's point on the sheet (mm), or `null` for a face this box does not have. */
export function sheetPoint(d: Dieline, anchor: CommentAnchor): Pt | null {
  if ("xMm" in anchor) return [anchor.xMm, anchor.yMm];
  const face = allFaces(d).find((f) => f.id === anchor.faceId);
  if (!face) return null;
  const b = faceBounds(face);
  return [b.x + anchor.u * b.width, b.y + anchor.v * b.height];
}
