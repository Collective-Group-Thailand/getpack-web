import { arc, bezier, dist, line } from "./path";
import type { Contour, Edge, EdgeRole, Pt } from "./types";

/**
 * SVG path data → closed contours, for custom die shapes a customer uploads. Supports every
 * command (M L H V C S Q T A Z, absolute and relative). Circular arcs stay arcs; elliptical or
 * rotated arcs become cubic Béziers (≤ 90° each); quadratics become cubics. Every subpath is
 * closed — an open one gets a closing cut.
 */
export function parseSvgPath(d: string, role: EdgeRole = "cut"): Contour[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Contour[] = [];
  let current: Edge[] = [];
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastControl: Pt | null = null;
  let lastQuad: Pt | null = null;
  let cmd = "";
  let i = 0;
  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error("Malformed path data");
    return v;
  };
  const close = () => {
    if (current.length === 0) return;
    if (dist(pos, start) > 1e-6) current.push(line(pos, start, role));
    out.push(current);
    current = [];
    pos = start;
  };
  const push = (e: Edge) => {
    if (dist(e.from, e.to) > 1e-9) current.push(e);
    pos = e.to;
  };

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error("Path data must start with a command");
    const rel = cmd === cmd.toLowerCase();
    const abs = (x: number, y: number): Pt => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case "M": {
        close();
        pos = abs(num(), num());
        start = pos;
        // Further pairs after M are implicit L.
        cmd = rel ? "l" : "L";
        lastControl = lastQuad = null;
        continue;
      }
      case "L":
        push(line(pos, abs(num(), num()), role));
        lastControl = lastQuad = null;
        break;
      case "H": {
        const x = num();
        push(line(pos, [rel ? pos[0] + x : x, pos[1]], role));
        lastControl = lastQuad = null;
        break;
      }
      case "V": {
        const y = num();
        push(line(pos, [pos[0], rel ? pos[1] + y : y], role));
        lastControl = lastQuad = null;
        break;
      }
      case "C": {
        const c1 = abs(num(), num());
        const c2 = abs(num(), num());
        const to = abs(num(), num());
        push(bezier(pos, c1, c2, to, role));
        lastControl = c2;
        lastQuad = null;
        break;
      }
      case "S": {
        const c1: Pt = lastControl ? [2 * pos[0] - lastControl[0], 2 * pos[1] - lastControl[1]] : pos;
        const c2 = abs(num(), num());
        const to = abs(num(), num());
        push(bezier(pos, c1, c2, to, role));
        lastControl = c2;
        lastQuad = null;
        break;
      }
      case "Q":
      case "T": {
        const q: Pt =
          cmd.toUpperCase() === "Q"
            ? abs(num(), num())
            : lastQuad
              ? [2 * pos[0] - lastQuad[0], 2 * pos[1] - lastQuad[1]]
              : pos;
        const to = abs(num(), num());
        const from = pos;
        push(
          bezier(
            from,
            [from[0] + (2 / 3) * (q[0] - from[0]), from[1] + (2 / 3) * (q[1] - from[1])],
            [to[0] + (2 / 3) * (q[0] - to[0]), to[1] + (2 / 3) * (q[1] - to[1])],
            to,
            role,
          ),
        );
        lastQuad = q;
        lastControl = null;
        break;
      }
      case "A": {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        const rot = num();
        const large = num() !== 0;
        const sweep = num() !== 0;
        const to = abs(num(), num());
        for (const e of svgArc(pos, to, rx, ry, rot, large, sweep, role)) push(e);
        lastControl = lastQuad = null;
        break;
      }
      case "Z":
        close();
        lastControl = lastQuad = null;
        cmd = "";
        continue;
      default:
        throw new Error(`Unsupported path command ${cmd}`);
    }
  }
  close();
  return out;
}

/** An SVG endpoint arc as edges: a circular arc when it is one, Béziers otherwise (SVG spec F.6). */
function svgArc(
  p0: Pt,
  p1: Pt,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  large: boolean,
  sweep: boolean,
  role: EdgeRole,
): Edge[] {
  if (dist(p0, p1) < 1e-9) return [];
  if (rxIn === 0 || ryIn === 0) return [line(p0, p1, role)];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rx = rxIn;
  let ry = ryIn;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2;
  if (Math.abs(rx - ry) < 1e-9) {
    // Circular: one exact arc (SVG sweep-flag 1 = increasing angle = our `clockwise`).
    return [arc(p0, p1, [cx, cy], sweep, role)];
  }
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (a: number): Pt => [
    cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin,
    cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos,
  ];
  const deriv = (a: number): Pt => [
    -rx * Math.sin(a) * cos - ry * Math.cos(a) * sin,
    -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos,
  ];
  const out: Edge[] = [];
  for (let j = 0; j < n; j++) {
    const a0 = t1 + step * j;
    const a1 = a0 + step;
    const s = j === 0 ? p0 : pt(a0);
    const e = j === n - 1 ? p1 : pt(a1);
    const d0 = deriv(a0);
    const d1 = deriv(a1);
    out.push(bezier(s, [s[0] + k * d0[0], s[1] + k * d0[1]], [e[0] - k * d1[0], e[1] - k * d1[1]], e, role));
  }
  return out;
}
