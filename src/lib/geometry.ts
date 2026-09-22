import type { Pt } from "./types";

export const PX_PER_MM = 96 / 25.4;

function signedArea(pts: Pt[]) {
  let a = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  });
  return a / 2;
}

/** Insets a convex polygon by `d` mm. Returns null if it collapses. */
export function insetConvex(pts: Pt[], d: number): Pt[] | null {
  const n = pts.length;
  const sign = signedArea(pts) > 0 ? 1 : -1;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // inward normal
    const nx = (-dy / len) * sign;
    const ny = (dx / len) * sign;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, dir: [dx, dy] as Pt };
  });
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n];
    const l2 = lines[i];
    const den = l1.dir[0] * l2.dir[1] - l1.dir[1] * l2.dir[0];
    if (Math.abs(den) < 1e-9) {
      out.push(l2.p);
      continue;
    }
    const t = ((l2.p[0] - l1.p[0]) * l2.dir[1] - (l2.p[1] - l1.p[1]) * l2.dir[0]) / den;
    out.push([l1.p[0] + l1.dir[0] * t, l1.p[1] + l1.dir[1] * t]);
  }
  if (signedArea(out) * sign <= 0) return null;
  return out;
}

export const flat = (pts: Pt[]) => pts.flatMap((p) => p);
