import type { Box } from "./geometry";

/** Lines an element can snap to: vertical ones at `xs`, horizontal ones at `ys` (sheet mm). */
export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** The lines snapped to, for the smart guides. */
  guides: { axis: "x" | "y"; at: number }[];
}

function nearest(edges: number[], lines: number[], threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const e of edges) {
    for (const line of lines) {
      const delta = line - e;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: line };
    }
  }
  return best;
}

/**
 * How far to nudge a moving box so its left, centre or right meets a vertical line (and its top,
 * middle or bottom a horizontal one), within `threshold` mm. The canvas applies the nudge and
 * draws the guides.
 */
export function snapBox(box: Box, targets: SnapTargets, threshold: number): SnapResult {
  const x = nearest([box.x, box.x + box.width / 2, box.x + box.width], targets.xs, threshold);
  const y = nearest([box.y, box.y + box.height / 2, box.y + box.height], targets.ys, threshold);
  const guides: SnapResult["guides"] = [];
  if (x) guides.push({ axis: "x", at: x.at });
  if (y) guides.push({ axis: "y", at: y.at });
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides };
}

/** Snap lines from boxes: their edges and centres. */
export function linesOf(boxes: Box[]): SnapTargets {
  return {
    xs: boxes.flatMap((b) => [b.x, b.x + b.width / 2, b.x + b.width]),
    ys: boxes.flatMap((b) => [b.y, b.y + b.height / 2, b.y + b.height]),
  };
}
