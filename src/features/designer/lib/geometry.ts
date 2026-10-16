import type { Pt } from "@getpack/dieline";

import type { DesignElement } from "../types";

/** An axis-aligned box in sheet millimetres. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * An element's own size before rotation, in mm. Text has no stored size — the canvas measures it
 * (`measured`); without a measurement it is estimated from its lines and font size.
 */
export function localSize(
  el: DesignElement,
  measured?: { width: number; height: number },
): { width: number; height: number } {
  if (el.type === "text") {
    if (measured) return measured;
    const lines = el.text.split("\n");
    return {
      width: Math.max(...lines.map((l) => l.length)) * el.fontSize * 0.6,
      height: lines.length * el.fontSize * 1.25,
    };
  }
  return { width: el.width, height: el.height };
}

/** The element's four corners on the sheet: its top-left origin, scaled, rotated about the origin. */
export function elementCorners(el: DesignElement, size: { width: number; height: number }): Pt[] {
  const w = size.width * el.scaleX;
  const h = size.height * el.scaleY;
  const a = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ].map(([x, y]) => [el.x + x * cos - y * sin, el.y + x * sin + y * cos] as Pt);
}

export function boxOf(points: Pt[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export const elementBox = (el: DesignElement, size: { width: number; height: number }) =>
  boxOf(elementCorners(el, size));

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return boxOf(boxes.flatMap((b) => [[b.x, b.y] as Pt, [b.x + b.width, b.y + b.height] as Pt]));
}

/** Whether segment a–b crosses or touches the convex polygon (the element's corners). */
export function segmentHitsPolygon(a: Pt, b: Pt, poly: Pt[]): boolean {
  const inside = (p: Pt) => {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const q = poly[i];
      const r = poly[(i + 1) % poly.length];
      const cross = (r[0] - q[0]) * (p[1] - q[1]) - (r[1] - q[1]) * (p[0] - q[0]);
      if (Math.abs(cross) < 1e-9) continue;
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  };
  if (inside(a) || inside(b)) return true;
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i];
    const d = poly[(i + 1) % poly.length];
    if (o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)) return true;
  }
  return false;
}
