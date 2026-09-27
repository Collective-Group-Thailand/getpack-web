import { describe, expect, it } from "vitest";

import { checkDieline } from "./checks";
import { assemble, face, piece } from "./faces";
import { applyMat4, foldPiece, lift } from "./fold";
import { dielineLines, edgeKey } from "./lines";
import { polygonInsideWithMargin } from "./geom";
import { offsetFace, polygonsArea, safeZone } from "./offset";
import {
  arc,
  arcAngles,
  arcToBeziers,
  contourGap,
  edgeLength,
  ellipse,
  flattenContour,
  flattenEdge,
  line,
  polygon,
  rectangle,
  reverseEdge,
  roundedRectangle,
  signedArea,
  svgPathData,
} from "./path";
import type { Pt } from "./types";

describe("path", () => {
  it("measures arcs: a clockwise quarter from 3 to 6 o'clock sweeps +90° (y down)", () => {
    const quarter = arc([10, 0], [0, 10], [0, 0], true);
    expect(arcAngles(quarter).sweep).toBeCloseTo(Math.PI / 2, 9);
    expect(edgeLength(quarter)).toBeCloseTo((Math.PI * 10) / 2, 9);
    const other = arc([10, 0], [0, 10], [0, 0], false);
    expect(arcAngles(other).sweep).toBeCloseTo((-3 * Math.PI) / 2, 9);
  });

  it("flattens curves within the tolerance", () => {
    const circle = ellipse(0, 0, 50, 50);
    const pts = flattenContour(circle, 0.2);
    for (const [x, y] of pts) expect(Math.abs(Math.hypot(x, y) - 50)).toBeLessThan(1e-9);
    // Chord midpoints stay within 0.2 mm of the circle.
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      expect(50 - Math.hypot((x1 + x2) / 2, (y1 + y2) / 2)).toBeLessThanOrEqual(0.2 + 1e-9);
    }
    const oval = ellipse(0, 0, 60, 30);
    const flat = flattenContour(oval, 0.2);
    expect(flat.length).toBeGreaterThan(16);
    expect(Math.abs(polygonsArea([flat]) - Math.PI * 60 * 30)).toBeLessThan(Math.PI * 60 * 30 * 0.01);
  });

  it("keeps contours closed and reversible", () => {
    const r = roundedRectangle(0, 0, 100, 60, 8);
    expect(contourGap(r)).toBeLessThan(1e-9);
    const e = arc([10, 0], [0, 10], [0, 0], true);
    const back = reverseEdge(e);
    expect(edgeKey(back)).toBe(edgeKey(e));
    expect(arcAngles(back as typeof e).sweep).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("writes true SVG arcs and splits arcs into Béziers of ≤ 90° for PDF", () => {
    const e = arc([10, 0], [-10, 0], [0, 0], true);
    expect(svgPathData([e], false)).toBe("M10 0 A10 10 0 0 1 -10 0");
    const curves = arcToBeziers(e);
    expect(curves).toHaveLength(2);
    expect(curves[1].to).toEqual([-10, 0]);
    // Midpoint of the Bézier pair lies on the circle within 0.03 mm.
    const [p] = flattenEdge({ ...curves[1], from: curves[1].from }, 0.01);
    expect(Math.hypot(p[0], p[1])).toBeCloseTo(10, 1);
  });

  it("orients rectangles clockwise on screen", () => {
    expect(signedArea(flattenContour(rectangle(0, 0, 10, 5)))).toBeGreaterThan(0);
  });
});

describe("offsetting (non-convex faces, holes)", () => {
  // An L-shaped face: a naive vertex-normal inset folds over itself at the inner corner.
  const lShape: Pt[] = [
    [0, 0],
    [100, 0],
    [100, 40],
    [40, 40],
    [40, 100],
    [0, 100],
  ];
  const lFace = face("l", "panel", "panel", polygon(lShape));

  it("insets a non-convex face into a valid, smaller shape", () => {
    const zone = safeZone(lFace, 5);
    expect(zone).toHaveLength(1);
    const area = polygonsArea(zone);
    // Exact inset of the L: (90 × 30) + (30 × 60) = 4500.
    expect(area).toBeCloseTo(4500, 0);
  });

  it("returns nothing when the inset swallows the face", () => {
    expect(safeZone(face("tiny", "panel", "panel", rectangle(0, 0, 8, 8)), 5)).toEqual([]);
  });

  it("keeps a safe zone around holes", () => {
    const withWindow = face("w", "panel", "panel", rectangle(0, 0, 100, 100), { holes: [rectangle(40, 40, 20, 20)] });
    const zone = safeZone(withWindow, 3);
    // Outer 94 × 94 minus the hole grown to 26 × 26.
    expect(polygonsArea(zone)).toBeCloseTo(94 * 94 - 26 * 26, 0);
    expect(offsetFace(withWindow, 0)).toHaveLength(2);
  });

  it("checks containment with a margin", () => {
    const panel = flattenContour(rectangle(0, 0, 100, 60));
    expect(polygonInsideWithMargin(panel, flattenContour(rectangle(10, 10, 80, 40)), 6)).toBe(true);
    expect(polygonInsideWithMargin(panel, flattenContour(rectangle(2, 10, 80, 40)), 6)).toBe(false);
    expect(polygonInsideWithMargin(panel, flattenContour(ellipse(50, 30, 20, 10)), 6)).toBe(true);
  });
});

describe("folding", () => {
  // A panel with a flap hinged on its top edge.
  const panel = face("panel", "front", "panel", rectangle(0, 0, 100, 50, { top: "crease" }));
  const flap = face(
    "flap",
    "top_flap",
    "flap",
    polygon(
      [
        [0, 0],
        [0, -30],
        [100, -30],
        [100, 0],
      ],
      ["cut", "cut", "cut", "crease"],
    ),
  );
  const p = piece("blank", "blank", [panel, flap]);

  it("turns a flap away from the printed side by its hinge angle", () => {
    const m = foldPiece(p, { roots: { blank: "panel" } }, 1).get("flap")!;
    // The flap's far edge (y = −30 on the sheet) ends 30 mm behind the panel, at the top edge.
    const tip = applyMat4(m, lift([50, -30]));
    expect(tip[0]).toBeCloseTo(50, 6);
    expect(tip[1]).toBeCloseTo(0, 6);
    expect(tip[2]).toBeCloseTo(-30, 6);
  });

  it("stays flat at progress 0 and honours custom angles", () => {
    const flat = foldPiece(p, { roots: { blank: "panel" } }, 0).get("flap")!;
    expect(applyMat4(flat, lift([50, -30]))).toEqual([50, 30, 0]);
    const half = foldPiece(p, { roots: { blank: "panel" }, angles: { flap: 180 } }, 1).get("flap")!;
    expect(applyMat4(half, lift([50, -30]))[1]).toBeCloseTo(-30, 6);
  });
});

describe("checks catch broken geometry", () => {
  it("reports an open contour, an unshared crease, an overlap and a dangling cut", () => {
    const open = face("open", "panel", "panel", [
      line([0, 0], [10, 0]),
      line([10, 0], [10, 10]),
      line([10, 10], [0, 9]),
    ]);
    const lonely = face("lonely", "panel", "panel", rectangle(20, 0, 10, 10, { top: "crease" }));
    const a = face("a", "panel", "panel", rectangle(40, 0, 10, 10));
    const b = face("b", "panel", "panel", rectangle(45, 5, 10, 10));
    const slit = face("slit", "panel", "panel", rectangle(60, 0, 10, 10), { marks: [] });
    const d = assemble("broken", [piece("blank", "blank", [open, lonely, a, b, slit])], 0);
    const codes = new Set(checkDieline(d).map((p) => p.code));
    expect(codes.has("contour.open")).toBe(true);
    expect(codes.has("boundary.not_cut")).toBe(true);
    expect(codes.has("faces.overlap")).toBe(true);
    expect(codes.has("piece.disconnected")).toBe(true);
  });

  it("lists a shared crease once, with both faces", () => {
    const panel = face("panel", "front", "panel", rectangle(0, 0, 100, 50, { top: "crease" }));
    const flap = face(
      "flap",
      "top_flap",
      "flap",
      polygon(
        [
          [0, 0],
          [0, -30],
          [100, -30],
          [100, 0],
        ],
        ["cut", "cut", "cut", "crease"],
      ),
    );
    const d = assemble("ok", [piece("blank", "blank", [panel, flap])]);
    const creases = dielineLines(d).filter((l) => l.role === "crease");
    expect(creases).toHaveLength(1);
    expect(creases[0].faces.sort()).toEqual(["flap", "panel"]);
    expect(checkDieline(d)).toEqual([]);
  });
});
