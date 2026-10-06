import { LAYER_OF } from "../export/layers";
import { dielineLines } from "../lines";
import { flattenOpen } from "../path";
import type { Dieline, EdgeRole, Pt } from "../types";

/**
 * Reading a partner's DXF (U3.6, D-272) to lay it over a recipe's dieline: ASCII DXF `LINE`, `ARC`,
 * `CIRCLE`, `LWPOLYLINE` (with bulges), `POLYLINE`/`VERTEX` and `SPLINE` (through its control or fit
 * points — close enough to judge a match, not to cut from) as polylines in millimetres, per layer,
 * in the sheet's frame (y down, the drawing's lower-left corner at the origin). Units from
 * `$INSUNITS` (unitless is read as millimetres). Blocks and inserts are not expanded.
 */

export interface DxfPolyline {
  layer: string;
  points: Pt[];
}

export interface DxfDrawing {
  polylines: DxfPolyline[];
  width: number;
  height: number;
  /** Entities skipped because they are not geometry the reader follows (TEXT, INSERT, HATCH…). */
  skipped: number;
}

const UNIT_MM: Record<number, number> = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };

/** Arcs are followed within this chord error, in the file's units (mm in practice). */
const CHORD_TOLERANCE = 0.01;
const stepDeg = (r: number) =>
  Math.min(5, Math.max(0.2, (2 * Math.acos(Math.max(-1, 1 - CHORD_TOLERANCE / Math.max(r, 1e-6))) * 180) / Math.PI));

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number): Pt[] {
  let end = a1;
  while (end <= a0) end += 360;
  const n = Math.max(2, Math.ceil((end - a0) / stepDeg(r)));
  return Array.from({ length: n + 1 }, (_x, i) => {
    const a = ((a0 + ((end - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/** The points of a bulged segment p → q (DXF bulge = tan(θ / 4), positive counter-clockwise). */
function bulgePoints(p: Pt, q: Pt, bulge: number): Pt[] {
  if (Math.abs(bulge) < 1e-9) return [q];
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const r = chord / (2 * Math.sin(theta / 2));
  const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const h = r * Math.cos(theta / 2);
  const [ux, uy] = [(q[0] - p[0]) / chord, (q[1] - p[1]) / chord];
  const c: Pt = [mid[0] - uy * h, mid[1] + ux * h];
  const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
  const n = Math.max(2, Math.ceil(Math.abs(theta) / ((stepDeg(Math.abs(r)) * Math.PI) / 180)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (theta * i) / n;
    out.push([c[0] + Math.abs(r) * Math.cos(a), c[1] + Math.abs(r) * Math.sin(a)]);
  }
  out[out.length - 1] = q;
  return out;
}

export function parseDxf(text: string): DxfDrawing {
  const raw = text.split(/\r?\n/);
  const pairs: [number, string][] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([Number(raw[i].trim()), raw[i + 1].trim()]);

  let scale = 1;
  for (let i = 0; i < pairs.length - 1; i++)
    if (pairs[i][0] === 9 && pairs[i][1] === "$INSUNITS") scale = UNIT_MM[Number(pairs[i + 1][1])] ?? 1;

  const start = pairs.findIndex((p, i) => p[0] === 2 && p[1] === "ENTITIES" && pairs[i - 1]?.[1] === "SECTION");
  const polylines: DxfPolyline[] = [];
  let skipped = 0;
  if (start < 0) return { polylines, width: 0, height: 0, skipped };

  // Entities as their group lists.
  const entities: { type: string; groups: [number, string][] }[] = [];
  for (let i = start + 1; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0) {
      if (value === "ENDSEC") break;
      entities.push({ type: value, groups: [] });
    } else entities.at(-1)?.groups.push([code, value]);
  }

  const num = (g: [number, string][], code: number, fallback = 0) => {
    const hit = g.find((x) => x[0] === code);
    return hit ? Number(hit[1]) : fallback;
  };
  const layerOf = (g: [number, string][]) => g.find((x) => x[0] === 8)?.[1] ?? "0";

  for (let i = 0; i < entities.length; i++) {
    const { type, groups: g } = entities[i];
    const layer = layerOf(g);
    switch (type) {
      case "LINE":
        polylines.push({
          layer,
          points: [
            [num(g, 10), num(g, 20)],
            [num(g, 11), num(g, 21)],
          ],
        });
        break;
      case "ARC":
        polylines.push({ layer, points: arcPoints(num(g, 10), num(g, 20), num(g, 40), num(g, 50), num(g, 51)) });
        break;
      case "CIRCLE":
        polylines.push({ layer, points: arcPoints(num(g, 10), num(g, 20), num(g, 40), 0, 360) });
        break;
      case "LWPOLYLINE": {
        const closed = (num(g, 70) & 1) === 1;
        const verts: { p: Pt; bulge: number }[] = [];
        for (const [code, value] of g) {
          if (code === 10) verts.push({ p: [Number(value), 0], bulge: 0 });
          else if (code === 20 && verts.length) verts[verts.length - 1].p[1] = Number(value);
          else if (code === 42 && verts.length) verts[verts.length - 1].bulge = Number(value);
        }
        if (verts.length < 2) break;
        const points: Pt[] = [verts[0].p];
        const n = closed ? verts.length : verts.length - 1;
        for (let k = 0; k < n; k++)
          points.push(...bulgePoints(verts[k].p, verts[(k + 1) % verts.length].p, verts[k].bulge));
        polylines.push({ layer, points });
        break;
      }
      case "POLYLINE": {
        const closed = (num(g, 70) & 1) === 1;
        const verts: { p: Pt; bulge: number }[] = [];
        while (entities[i + 1]?.type === "VERTEX") {
          const v = entities[++i].groups;
          verts.push({ p: [num(v, 10), num(v, 20)], bulge: num(v, 42) });
        }
        if (entities[i + 1]?.type === "SEQEND") i++;
        if (verts.length < 2) break;
        const points: Pt[] = [verts[0].p];
        const n = closed ? verts.length : verts.length - 1;
        for (let k = 0; k < n; k++)
          points.push(...bulgePoints(verts[k].p, verts[(k + 1) % verts.length].p, verts[k].bulge));
        polylines.push({ layer, points });
        break;
      }
      case "SPLINE": {
        const fit = g.filter((x) => x[0] === 11 || x[0] === 21);
        const ctrl = g.filter((x) => x[0] === 10 || x[0] === 20);
        const src = fit.length >= 4 ? fit : ctrl;
        const xs = src.filter((x) => x[0] === 10 || x[0] === 11).map((x) => Number(x[1]));
        const ys = src.filter((x) => x[0] === 20 || x[0] === 21).map((x) => Number(x[1]));
        const points = xs.map((x, k) => [x, ys[k] ?? 0] as Pt);
        if (points.length >= 2) polylines.push({ layer, points });
        break;
      }
      default:
        skipped++;
    }
  }

  // Millimetres, y down, the lower-left corner at the origin.
  const all = polylines.flatMap((p) => p.points);
  if (!all.length) return { polylines, width: 0, height: 0, skipped };
  const minX = Math.min(...all.map((p) => p[0]));
  const maxY = Math.max(...all.map((p) => p[1]));
  for (const pl of polylines) pl.points = pl.points.map(([x, y]) => [(x - minX) * scale, (maxY - y) * scale]);
  const out = polylines.flatMap((p) => p.points);
  return {
    polylines,
    width: Math.max(...out.map((p) => p[0])),
    height: Math.max(...out.map((p) => p[1])),
    skipped,
  };
}

export interface Deviation {
  /** Largest distance between the two drawings, mm, either way (a line in one and not the other counts). */
  max: number;
  mean: number;
  /** The drawing's extent minus the dieline's, mm (x, y). */
  sizeDelta: [number, number];
  /** The DXF was compared mirrored left to right (drawn from the unprinted side). */
  mirrored: boolean;
  /** Within the 0.5 mm the intake review accepts (D-272, U3.6). */
  matches: boolean;
}

/** The tolerance a partner's dieline is matched to a recipe within, mm (U3.6). */
export const INTAKE_TOLERANCE_MM = 0.5;

function sample(points: Pt[], step: number): Pt[] {
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

function nearest(p: Pt, segs: [Pt, Pt][]): number {
  let best = Infinity;
  for (const [a, b] of segs) {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (d < best) best = d;
  }
  return best;
}

const segmentsOf = (lines: Pt[][]): [Pt, Pt][] =>
  lines.flatMap((pts) => pts.slice(1).map((p, i) => [pts[i], p] as [Pt, Pt]));

/**
 * How far a partner's drawing is from a dieline: both laid with their lower-left corners together
 * (as drawn, and mirrored left to right — the better of the two), the cut and crease lines sampled
 * every millimetre and each point's distance to the other drawing's nearest line, both ways.
 * The drawing's lines are its layers named for `roles` (`CUT`, `CREASE` — the trade's names) when
 * it has any, else all of them.
 */
export function deviationFrom(
  drawing: DxfDrawing,
  d: Dieline,
  roles: readonly EdgeRole[] = ["cut", "crease"],
): Deviation {
  const engine: Pt[][] = dielineLines(d)
    .filter((l) => roles.includes(l.role))
    .map((l) => flattenOpen(l.edge, 0.01));
  const eAll = engine.flat();
  const eMinX = Math.min(...eAll.map((p) => p[0]));
  const eMaxY = Math.max(...eAll.map((p) => p[1]));
  const eW = Math.max(...eAll.map((p) => p[0])) - eMinX;
  const eH = eMaxY - Math.min(...eAll.map((p) => p[1]));
  // The engine's lower-left corner at the origin, y down: as the reader lays the DXF out.
  const engineLaid = engine.map((pts) => pts.map(([x, y]) => [x - eMinX, y - (eMaxY - eH)] as Pt));
  const eSegs = segmentsOf(engineLaid);
  const eSamples = engineLaid.flatMap((pts) => sample(pts, 1));

  // The drawing's lines for those roles: its CUT / CREASE… layers when it has them, else every line.
  const wanted = new Set(roles.map((r) => LAYER_OF[r]));
  const named = drawing.polylines.filter((pl) => wanted.has(pl.layer.toUpperCase() as never));
  const source = named.length ? named : drawing.polylines;
  const tryWith = (mirrored: boolean) => {
    const lines = source.map((pl) =>
      pl.points.map(([x, y]) => (mirrored ? ([drawing.width - x, y] as Pt) : ([x, y] as Pt))),
    );
    const dSegs = segmentsOf(lines);
    const there = lines.flatMap((pts) => sample(pts, 1)).map((p) => nearest(p, eSegs));
    const back = eSamples.map((p) => nearest(p, dSegs));
    const all = [...there, ...back];
    return {
      max: Math.max(...all),
      mean: all.reduce((s, x) => s + x, 0) / all.length,
      mirrored,
    };
  };
  const plain = tryWith(false);
  const flipped = tryWith(true);
  const best = flipped.max < plain.max ? flipped : plain;
  return {
    ...best,
    sizeDelta: [drawing.width - eW, drawing.height - eH],
    matches: best.max <= INTAKE_TOLERANCE_MM,
  };
}
