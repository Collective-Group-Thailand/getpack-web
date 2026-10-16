import { allFaces, faceBounds, faceLabel, type Dieline, type Face } from "@getpack/dieline";

export interface PositionWords {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

/**
 * A name for every face that tells it apart from the others. The engine labels faces by kind —
 * a tuck end has two lids, two tucks and four dust flaps — so a repeated name is qualified by
 * where it sits on the flat sheet: top or bottom first, then the panel it hangs from, then left or
 * right. "ปีกกันฝุ่น (ด้านขวา · บน)" rather than four identical "ปีกกันฝุ่น".
 */
export function faceNames(d: Dieline, locale: "th" | "en", words: PositionWords): Map<string, string> {
  const faces = allFaces(d);
  const base = (f: Face) => faceLabel(f.label)[locale];
  const centre = (f: Face) => {
    const b = faceBounds(f);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const byLabel = new Map<string, Face[]>();
  for (const f of faces) byLabel.set(f.label, [...(byLabel.get(f.label) ?? []), f]);
  const unique = faces.filter((f) => byLabel.get(f.label)!.length === 1);

  const out = new Map<string, string>();
  for (const group of byLabel.values()) {
    if (group.length === 1) {
      out.set(group[0]!.id, base(group[0]!));
      continue;
    }
    const qualifiers = new Map<string, string[]>(group.map((f) => [f.id, []]));
    const distinct = () => new Set(group.map((f) => qualifiers.get(f.id)!.join("|"))).size === group.length;
    const spread = (axis: "x" | "y") => {
      const values = group.map((f) => centre(f)[axis]);
      return { min: Math.min(...values), max: Math.max(...values) };
    };

    const ys = spread("y");
    if (ys.max - ys.min > 1) {
      const mid = (ys.min + ys.max) / 2;
      for (const f of group) qualifiers.get(f.id)!.push(centre(f).y < mid ? words.top : words.bottom);
    }
    if (!distinct()) {
      // The uniquely named face in the same column (the panel a flap hangs from).
      for (const f of group) {
        const c = centre(f);
        const column = unique
          .filter((u) => {
            const b = faceBounds(u);
            return c.x >= b.x && c.x <= b.x + b.width;
          })
          .sort((a, b) => Math.abs(centre(a).y - c.y) - Math.abs(centre(b).y - c.y))[0];
        if (column) qualifiers.get(f.id)!.unshift(base(column));
      }
    }
    if (!distinct()) {
      const xs = spread("x");
      const mid = (xs.min + xs.max) / 2;
      for (const f of group) qualifiers.get(f.id)!.push(centre(f).x < mid ? words.left : words.right);
    }
    for (const f of group) {
      const q = qualifiers.get(f.id)!;
      out.set(f.id, q.length ? `${base(f)} (${q.join(" · ")})` : base(f));
    }
  }
  return out;
}
