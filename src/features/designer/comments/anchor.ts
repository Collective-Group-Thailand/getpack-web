// No engine here: the shared page's comments read anchors without @packio/dieline.

/**
 * Where a comment is pinned (U4.7, D-285): to a face of the 3D box — its id and a point in it as
 * fractions (`u` across, `v` down) of the face's bounds on the outside of the flat sheet — or to a
 * point of the flat sheet in mm. A face anchor survives a change of size (it stays at the same place
 * on its face); a flat anchor is where it was clicked.
 */
export type CommentAnchor = { faceId: string; u: number; v: number } | { xMm: number; yMm: number };

/** An anchor as packio-api answers it (`CommentDto.anchor`, opaque), or `null` when it is neither. */
export function readAnchor(raw: Record<string, unknown> | null | undefined): CommentAnchor | null {
  if (!raw) return null;
  const { faceId, u, v, xMm, yMm } = raw;
  if (typeof faceId === "string" && typeof u === "number" && typeof v === "number") return { faceId, u, v };
  if (typeof xMm === "number" && typeof yMm === "number") return { xMm, yMm };
  return null;
}

/** An anchor's point on the sheet from each face's bounds (mm) — the engine-free form of `sheetPoint`. */
export function pointFromBounds(
  bounds: Record<string, { x: number; y: number; width: number; height: number }>,
  anchor: CommentAnchor,
): [number, number] | null {
  if ("xMm" in anchor) return [anchor.xMm, anchor.yMm];
  const b = bounds[anchor.faceId];
  return b ? [b.x + anchor.u * b.width, b.y + anchor.v * b.height] : null;
}

/** A flat anchor, to a tenth of a millimetre (engine-free). */
export function flatAnchorOf(xMm: number, yMm: number): CommentAnchor {
  return { xMm: Math.round(xMm * 10) / 10, yMm: Math.round(yMm * 10) / 10 };
}
