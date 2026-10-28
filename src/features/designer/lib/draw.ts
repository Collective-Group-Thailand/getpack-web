import type { Pt } from "@getpack/dieline";

import { ARTWORK_DEFAULTS } from "../canvas-colors";
import type { NewElement } from "../types";

/*
 * The pro toolbox's shapes (C8 Phase 3): rectangles, ellipses, lines and pen paths drawn on the sheet in mm. A line
 * or a pen path is a `shape` whose path is points in its own 100 × 100 box (like the shape library), `open` when it
 * is not closed — so the print checks (hairline, safe zone) treat it like any shape.
 */

const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
/** A line has some height so its box can be selected and scaled. */
const MIN_EXTENT = 0.5;

/** A drag from `a` to `b`; with `square` (⇧) the box keeps equal sides. */
export function dragBox(a: Pt, b: Pt, square: boolean): { x: number; y: number; width: number; height: number } {
  let w = b[0] - a[0];
  let h = b[1] - a[1];
  if (square) {
    const s = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * s;
    h = Math.sign(h || 1) * s;
  }
  return { x: Math.min(a[0], a[0] + w), y: Math.min(a[1], a[1] + h), width: Math.abs(w), height: Math.abs(h) };
}

/** ⇧ while drawing a line or a pen segment: the end snapped to the nearest 45°. */
export function constrain45(from: Pt, to: Pt): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [from[0] + Math.cos(angle) * len, from[1] + Math.sin(angle) * len];
}

export function newRectangle(
  box: { x: number; y: number; width: number; height: number },
  kind: "rect" | "circle",
): NewElement {
  return {
    ...base,
    type: kind,
    ...box,
    fill: ARTWORK_DEFAULTS.shapeFill,
    stroke: ARTWORK_DEFAULTS.shapeStroke,
    strokeWidth: 0,
    cornerRadius: 0,
  };
}

/** Points on the sheet → a `shape` with its path in its own 100 × 100 box. */
export function newPath(points: Pt[], closed: boolean): NewElement | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  let x = Math.min(...xs);
  let y = Math.min(...ys);
  let width = Math.max(...xs) - x;
  let height = Math.max(...ys) - y;
  if (width < MIN_EXTENT) {
    x -= (MIN_EXTENT - width) / 2;
    width = MIN_EXTENT;
  }
  if (height < MIN_EXTENT) {
    y -= (MIN_EXTENT - height) / 2;
    height = MIN_EXTENT;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const d =
    points
      .map((p, i) => `${i ? "L" : "M"}${round(((p[0] - x) / width) * 100)} ${round(((p[1] - y) / height) * 100)}`)
      .join(" ") + (closed ? " Z" : "");
  return {
    ...base,
    type: "shape",
    x,
    y,
    width,
    height,
    path: d,
    ...(closed ? {} : { open: true }),
    fill: closed ? ARTWORK_DEFAULTS.shapeFill : "transparent",
    stroke: ARTWORK_DEFAULTS.shapeStroke,
    strokeWidth: closed ? 0 : 0.5,
    cornerRadius: 0,
  };
}

/** A path made only of straight segments (the line and pen tools'), as points in its box — else null. */
export function polylineOf(path: string | undefined): { points: number[]; closed: boolean } | null {
  if (!path || !/^[MLZ0-9.\s-]+$/i.test(path)) return null;
  const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 4 || nums.length % 2) return null;
  return { points: nums, closed: /z/i.test(path) };
}
