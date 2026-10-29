/**
 * Where a check's marker sits over the page preview (upload redesign Phase 2 item 3): the API gives a point in PDF page
 * space (points, y up, `at`); the preview draws the page's media box. Returns percentages of the preview, clamped
 * to it, or null when the item has no position.
 */
export function markerPosition(
  at: { x: number; y: number } | null,
  mediaBox: readonly number[] | null | undefined,
): { left: number; top: number } | null {
  if (!at || !mediaBox || mediaBox.length !== 4) return null;
  const [x1, y1, x2, y2] = mediaBox as [number, number, number, number];
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) return null;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return { left: clamp(((at.x - x1) / width) * 100), top: clamp(((y2 - at.y) / height) * 100) };
}

/** The die box (or trim box) of the page as percentages of the media box, to outline the sheet over the preview. */
export function boxPosition(box: readonly number[] | null | undefined, mediaBox: readonly number[] | null | undefined) {
  if (!box || !mediaBox || box.length !== 4 || mediaBox.length !== 4) return null;
  const [x1, y1, x2, y2] = mediaBox as [number, number, number, number];
  const [bx1, by1, bx2, by2] = box as [number, number, number, number];
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return null;
  return {
    left: ((bx1 - x1) / w) * 100,
    top: ((y2 - by2) / h) * 100,
    width: ((bx2 - bx1) / w) * 100,
    height: ((by2 - by1) / h) * 100,
  };
}
