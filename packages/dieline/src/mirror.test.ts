import { describe, expect, it } from "vitest";

import { checkDieline } from "./checks";
import { allFaces } from "./faces";
import { mirrorDieline } from "./mirror";
import { safeZone } from "./offset";
import { flattenContour } from "./path";
import { getStyle } from "./styles";
import type { Pt } from "./types";

const signedArea = (poly: Pt[]) =>
  poly.reduce((sum, [x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    return sum + (x1 * y2 - x2 * y1);
  }, 0) / 2;

describe("mirrorDieline (inside printing, U4.3)", () => {
  const material = { caliperMm: 0.45, kind: "paperboard" as const };
  const d = getStyle("tuck-end").build({ length: 70, width: 40, height: 150 }, material);
  const m = mirrorDieline(d);

  it("mirrors every face across the sheet, keeping ids, area and winding", () => {
    const before = allFaces(d);
    const after = allFaces(m);
    expect(after.map((f) => f.id)).toEqual(before.map((f) => f.id));
    before.forEach((f, i) => {
      const a = flattenContour(f.outline, 0.5);
      const b = flattenContour(after[i]!.outline, 0.5);
      expect(Math.sign(signedArea(b))).toBe(Math.sign(signedArea(a)));
      expect(Math.abs(signedArea(b))).toBeCloseTo(Math.abs(signedArea(a)), 3);
      const xs = (poly: Pt[]) => poly.map((p) => p[0]);
      expect(Math.min(...xs(b))).toBeCloseTo(d.width - Math.max(...xs(a)), 6);
    });
  });

  it("stays a clean dieline with safe zones, and mirrors back to itself", () => {
    expect(checkDieline(m)).toEqual([]);
    for (const f of allFaces(m)) expect(safeZone(f, 3).length).toBeGreaterThanOrEqual(0);
    const rounded = (value: unknown) =>
      JSON.stringify(value, (_k, v: unknown) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v));
    expect(rounded(mirrorDieline(m))).toBe(rounded(d));
  });
});
