import type { Pt } from "./types";

/**
 * Small exact polygon predicates with no dependency — used where the style registry needs a
 * geometric answer, so drawing a box never pulls the Clipper2 offsetting engine into a page.
 */

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/**
 * Whether polygon `inner` lies inside polygon `outer` with at least `margin` to its boundary:
 * every inner vertex inside and at least `margin` from every outer edge, every outer vertex at
 * least `margin` from every inner edge, and no edges crossing.
 */
export function polygonInsideWithMargin(outer: Pt[], inner: Pt[], margin: number): boolean {
  for (const p of inner) if (!pointInPolygon(p, outer)) return false;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    for (let j = 0; j < inner.length; j++) {
      const c = inner[j];
      const d = inner[(j + 1) % inner.length];
      if (segmentsCross(a, b, c, d)) return false;
      if (pointSegmentDistance(c, a, b) < margin - 1e-9) return false;
      if (pointSegmentDistance(a, c, d) < margin - 1e-9) return false;
    }
  }
  return true;
}
