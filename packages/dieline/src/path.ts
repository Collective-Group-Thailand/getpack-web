import type { ArcEdge, BezierEdge, Bounds, Contour, Edge, EdgeRole, LineEdge, Pt } from "./types";

/** Default chord tolerance when curves are flattened: 0.2 mm, below what a die can hold. */
export const FLATTEN_TOLERANCE_MM = 0.2;

const TAU = Math.PI * 2;

export const line = (from: Pt, to: Pt, role: EdgeRole = "cut"): LineEdge => ({ kind: "line", from, to, role });

export const arc = (from: Pt, to: Pt, center: Pt, clockwise: boolean, role: EdgeRole = "cut"): ArcEdge => ({
  kind: "arc",
  from,
  to,
  center,
  radius: Math.hypot(from[0] - center[0], from[1] - center[1]),
  clockwise,
  role,
});

export const bezier = (from: Pt, c1: Pt, c2: Pt, to: Pt, role: EdgeRole = "cut"): BezierEdge => ({
  kind: "bezier",
  from,
  c1,
  c2,
  to,
  role,
});

/** A closed polygon of straight edges; `roles[i]` is the role of `points[i] → points[i + 1]`. */
export function polygon(points: Pt[], roles: EdgeRole | EdgeRole[] = "cut"): Contour {
  return points.map((p, i) => line(p, points[(i + 1) % points.length], Array.isArray(roles) ? roles[i] : roles));
}

/**
 * A rectangle, edges in drawing order: top (left → right), right (down), bottom (right → left),
 * left (up). In the y-down frame that is clockwise on screen.
 */
export function rectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  roles: Partial<Record<"top" | "right" | "bottom" | "left", EdgeRole>> = {},
): Contour {
  return polygon(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    [roles.top ?? "cut", roles.right ?? "cut", roles.bottom ?? "cut", roles.left ?? "cut"],
  );
}

/** Kappa for approximating a quarter circle with a cubic Bézier. */
const KAPPA = (4 / 3) * Math.tan(Math.PI / 8);

/** A rectangle with rounded corners (radius clamped to half the shorter side), as a closed contour. */
export function roundedRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  role: EdgeRole = "cut",
): Contour {
  const radius = Math.max(0, Math.min(r, width / 2, height / 2));
  if (radius < 1e-6) return rectangle(x, y, width, height, { top: role, right: role, bottom: role, left: role });
  const x1 = x + width;
  const y1 = y + height;
  const out: Contour = [];
  const push = (e: Edge) => {
    if (dist(e.from, e.to) > 1e-9) out.push(e);
  };
  push(line([x + radius, y], [x1 - radius, y], role));
  push(arc([x1 - radius, y], [x1, y + radius], [x1 - radius, y + radius], true, role));
  push(line([x1, y + radius], [x1, y1 - radius], role));
  push(arc([x1, y1 - radius], [x1 - radius, y1], [x1 - radius, y1 - radius], true, role));
  push(line([x1 - radius, y1], [x + radius, y1], role));
  push(arc([x + radius, y1], [x, y1 - radius], [x + radius, y1 - radius], true, role));
  push(line([x, y1 - radius], [x, y + radius], role));
  push(arc([x, y + radius], [x + radius, y], [x + radius, y + radius], true, role));
  return out;
}

/** An ellipse as four cubic Béziers (a circle when `rx === ry`). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, role: EdgeRole = "cut"): Contour {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const e: Pt = [cx + rx, cy];
  const s: Pt = [cx, cy + ry];
  const w: Pt = [cx - rx, cy];
  const n: Pt = [cx, cy - ry];
  if (Math.abs(rx - ry) < 1e-9) {
    // A true circle: real arcs, so SVG and DXF carry an exact curve.
    return [
      arc(e, s, [cx, cy], true, role),
      arc(s, w, [cx, cy], true, role),
      arc(w, n, [cx, cy], true, role),
      arc(n, e, [cx, cy], true, role),
    ];
  }
  return [
    bezier(e, [cx + rx, cy + ky], [cx + kx, cy + ry], s, role),
    bezier(s, [cx - kx, cy + ry], [cx - rx, cy + ky], w, role),
    bezier(w, [cx - rx, cy - ky], [cx - kx, cy - ry], n, role),
    bezier(n, [cx + kx, cy - ry], [cx + rx, cy - ky], e, role),
  ];
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Start and end angle of an arc and its signed sweep (positive = clockwise in the y-down frame). */
export function arcAngles(e: ArcEdge): { start: number; end: number; sweep: number } {
  const start = Math.atan2(e.from[1] - e.center[1], e.from[0] - e.center[0]);
  const end = Math.atan2(e.to[1] - e.center[1], e.to[0] - e.center[0]);
  let sweep = end - start;
  if (e.clockwise) {
    while (sweep <= 1e-12) sweep += TAU;
  } else {
    while (sweep >= -1e-12) sweep -= TAU;
  }
  // A full-circle arc from a point to itself would be ambiguous; generators split circles.
  return { start, end, sweep };
}

function bezierPoint(e: BezierEdge, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * e.from[0] + b * e.c1[0] + c * e.c2[0] + d * e.to[0],
    a * e.from[1] + b * e.c1[1] + c * e.c2[1] + d * e.to[1],
  ];
}

/**
 * Points along an edge, `from` included and `to` excluded, with no chord further than `tol`
 * from the true curve. Lines give one point.
 */
export function flattenEdge(e: Edge, tol = FLATTEN_TOLERANCE_MM): Pt[] {
  if (e.kind === "line") return [e.from];
  if (e.kind === "arc") {
    const { start, sweep } = arcAngles(e);
    const r = Math.max(e.radius, 1e-9);
    const maxStep = tol >= r ? Math.PI / 2 : 2 * Math.acos(1 - tol / r);
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(maxStep, 1e-3)));
    const out: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = start + (sweep * i) / n;
      out.push([e.center[0] + r * Math.cos(a), e.center[1] + r * Math.sin(a)]);
    }
    out[0] = e.from;
    return out;
  }
  // Wang's formula: n = √(d(d−1)/8 · M / tol) segments keep every chord within `tol` (d = 3).
  const m = Math.max(
    Math.hypot(e.from[0] - 2 * e.c1[0] + e.c2[0], e.from[1] - 2 * e.c1[1] + e.c2[1]),
    Math.hypot(e.c1[0] - 2 * e.c2[0] + e.to[0], e.c1[1] - 2 * e.c2[1] + e.to[1]),
  );
  const n = Math.max(2, Math.min(512, Math.ceil(Math.sqrt((0.75 * m) / Math.max(tol, 1e-4)))));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(bezierPoint(e, i / n));
  return out;
}

/** A closed contour as a polygon (no repeated closing point). */
export function flattenContour(c: Contour, tol = FLATTEN_TOLERANCE_MM): Pt[] {
  return c.flatMap((e) => flattenEdge(e, tol));
}

/** An open edge as a polyline, both ends included. */
export function flattenOpen(e: Edge, tol = FLATTEN_TOLERANCE_MM): Pt[] {
  return [...flattenEdge(e, tol), e.to];
}

export function edgeLength(e: Edge): number {
  if (e.kind === "line") return dist(e.from, e.to);
  if (e.kind === "arc") return Math.abs(arcAngles(e).sweep) * e.radius;
  const pts = flattenOpen(e, 0.01);
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += dist(pts[i - 1], pts[i]);
  return sum;
}

/** The same edge walked the other way. */
export function reverseEdge(e: Edge): Edge {
  if (e.kind === "line") return { ...e, from: e.to, to: e.from };
  if (e.kind === "arc") return { ...e, from: e.to, to: e.from, clockwise: !e.clockwise };
  return { ...e, from: e.to, to: e.from, c1: e.c2, c2: e.c1 };
}

export function reverseContour(c: Contour): Contour {
  return [...c].reverse().map(reverseEdge);
}

/** Signed polygon area; positive when the contour runs clockwise on screen (y-down). */
export function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function boundsOf(points: Pt[]): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Exact-enough bounds of edges: curves are sampled finely, lines are exact. */
export function edgesBounds(edges: Edge[]): Bounds {
  return boundsOf(edges.flatMap((e) => flattenOpen(e, 0.01)));
}

export type PtMap = (p: Pt) => Pt;

/** Applies a point map to an edge. `flips` says whether the map mirrors (reverses arc direction). */
export function mapEdge(e: Edge, f: PtMap, flips = false): Edge {
  if (e.kind === "line") return { ...e, from: f(e.from), to: f(e.to) };
  if (e.kind === "arc")
    return { ...e, from: f(e.from), to: f(e.to), center: f(e.center), clockwise: flips ? !e.clockwise : e.clockwise };
  return { ...e, from: f(e.from), to: f(e.to), c1: f(e.c1), c2: f(e.c2) };
}

export const translate =
  (dx: number, dy: number): PtMap =>
  (p) => [p[0] + dx, p[1] + dy];
export const mirrorX =
  (axis: number): PtMap =>
  (p) => [2 * axis - p[0], p[1]];
export const mirrorY =
  (axis: number): PtMap =>
  (p) => [p[0], 2 * axis - p[1]];

/** Rounds to 1 µm — enough for any die and it keeps output byte-stable across platforms. */
export const round3 = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

/** SVG path data for a contour (closed with `Z`) or an open list of edges. Units as given. */
export function svgPathData(
  edges: Edge[],
  closed = true,
  fmt: (n: number) => string = (n) => String(round3(n)),
): string {
  if (edges.length === 0) return "";
  const p = (pt: Pt) => `${fmt(pt[0])} ${fmt(pt[1])}`;
  let d = "";
  let cursor: Pt | null = null;
  for (const e of edges) {
    if (!cursor || dist(cursor, e.from) > 1e-6) d += `${d ? " " : ""}M${p(e.from)}`;
    if (e.kind === "line") d += ` L${p(e.to)}`;
    else if (e.kind === "bezier") d += ` C${p(e.c1)} ${p(e.c2)} ${p(e.to)}`;
    else {
      const { sweep } = arcAngles(e);
      const large = Math.abs(sweep) > Math.PI ? 1 : 0;
      d += ` A${fmt(e.radius)} ${fmt(e.radius)} 0 ${large} ${e.clockwise ? 1 : 0} ${p(e.to)}`;
    }
    cursor = e.to;
  }
  return closed ? `${d} Z` : d;
}

/** Splits an arc into pieces of at most 90° as cubic Béziers (for PDF, which has no arcs). */
export function arcToBeziers(e: ArcEdge): BezierEdge[] {
  const { start, sweep } = arcAngles(e);
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const r = e.radius;
  const [cx, cy] = e.center;
  const out: BezierEdge[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = start + step * i;
    const a1 = a0 + step;
    const p0: Pt = i === 0 ? e.from : [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p3: Pt = i === n - 1 ? e.to : [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const c1: Pt = [cx + r * (Math.cos(a0) - k * Math.sin(a0)), cy + r * (Math.sin(a0) + k * Math.cos(a0))];
    const c2: Pt = [cx + r * (Math.cos(a1) + k * Math.sin(a1)), cy + r * (Math.sin(a1) - k * Math.cos(a1))];
    out.push(bezier(p0, c1, c2, p3, e.role));
  }
  return out;
}

/** Gap between consecutive edges of a contour, the largest one — 0 for a perfectly closed chain. */
export function contourGap(c: Contour): number {
  let worst = 0;
  for (let i = 0; i < c.length; i++) worst = Math.max(worst, dist(c[i].to, c[(i + 1) % c.length].from));
  return worst;
}
