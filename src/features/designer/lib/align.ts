import { unionBox, type Box } from "./geometry";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

export interface Move {
  id: string;
  dx: number;
  dy: number;
}

/**
 * Moves that align boxes to each other (the selection's bounds), or to `reference` — the
 * focused face — when given, or when there is only one box.
 */
export function alignMoves(items: { id: string; box: Box }[], mode: AlignMode, reference?: Box | null): Move[] {
  const ref = reference ?? unionBox(items.map((i) => i.box));
  if (!ref) return [];
  return items.map(({ id, box }) => {
    switch (mode) {
      case "left":
        return { id, dx: ref.x - box.x, dy: 0 };
      case "center":
        return { id, dx: ref.x + ref.width / 2 - (box.x + box.width / 2), dy: 0 };
      case "right":
        return { id, dx: ref.x + ref.width - (box.x + box.width), dy: 0 };
      case "top":
        return { id, dx: 0, dy: ref.y - box.y };
      case "middle":
        return { id, dx: 0, dy: ref.y + ref.height / 2 - (box.y + box.height / 2) };
      case "bottom":
        return { id, dx: 0, dy: ref.y + ref.height - (box.y + box.height) };
    }
  });
}

/** Moves that space three or more boxes evenly along an axis, the outermost two staying put. */
export function distributeMoves(items: { id: string; box: Box }[], axis: "x" | "y"): Move[] {
  if (items.length < 3) return [];
  const pos = (b: Box) => (axis === "x" ? b.x : b.y);
  const len = (b: Box) => (axis === "x" ? b.width : b.height);
  const sorted = [...items].sort((a, b) => pos(a.box) - pos(b.box));
  const first = sorted[0].box;
  const last = sorted[sorted.length - 1].box;
  const span = pos(last) + len(last) - pos(first);
  const total = sorted.reduce((acc, i) => acc + len(i.box), 0);
  const gap = (span - total) / (sorted.length - 1);
  let at = pos(first);
  return sorted.map(({ id, box }) => {
    const delta = at - pos(box);
    at += len(box) + gap;
    return axis === "x" ? { id, dx: delta, dy: 0 } : { id, dx: 0, dy: delta };
  });
}
