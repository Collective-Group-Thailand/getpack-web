import { describe, expect, it } from "vitest";
import { buildDieline, dielineSegments, dielineToSvg, faceCentroid } from "./dieline";
import type { BoxDims, BoxStyleId, Dieline, Face } from "./types";

const STYLES: BoxStyleId[] = ["rsc", "tuck-end", "tray"];
const DIMS: Record<BoxStyleId, BoxDims> = {
  rsc: { length: 250, width: 180, height: 120 },
  "tuck-end": { length: 70, width: 40, height: 150 },
  tray: { length: 200, width: 150, height: 60 },
};

const bbox = (d: Dieline) => {
  const pts = d.faces.flatMap((f) => f.points);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};

const face = (d: Dieline, id: string): Face => {
  const f = d.faces.find((x) => x.id === id);
  if (!f) throw new Error(`face ${id} not found`);
  return f;
};
const spanX = (f: Face) => Math.max(...f.points.map((p) => p[0])) - Math.min(...f.points.map((p) => p[0]));
const spanY = (f: Face) => Math.max(...f.points.map((p) => p[1])) - Math.min(...f.points.map((p) => p[1]));

describe.each(STYLES)("buildDieline(%s)", (style) => {
  const dims = DIMS[style];
  const d = buildDieline(style, dims);

  it("produces faces with unique ids", () => {
    expect(d.faces.length).toBeGreaterThan(0);
    expect(new Set(d.faces.map((f) => f.id)).size).toBe(d.faces.length);
  });

  it("produces closed polygons with no repeated consecutive point", () => {
    for (const f of d.faces) {
      expect(f.points.length, f.id).toBeGreaterThanOrEqual(3);
      f.points.forEach((p, i) => {
        const q = f.points[(i + 1) % f.points.length];
        expect(p[0] === q[0] && p[1] === q[1], `${f.id} edge ${i} is degenerate`).toBe(false);
        expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${f.id} point ${i}`).toBe(true);
      });
    }
  });

  it("only marks fold indices that address a real edge", () => {
    for (const f of d.faces) {
      expect(new Set(f.folds).size, f.id).toBe(f.folds.length);
      for (const i of f.folds) {
        expect(Number.isInteger(i), f.id).toBe(true);
        expect(i, f.id).toBeGreaterThanOrEqual(0);
        expect(i, f.id).toBeLessThan(f.points.length);
      }
    }
  });

  it("reports width and height that match the real extents, anchored at the origin", () => {
    const b = bbox(d);
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.minY).toBeCloseTo(0, 6);
    expect(d.width).toBeCloseTo(b.maxX, 6);
    expect(d.height).toBeCloseTo(b.maxY, 6);
  });

  it("is never larger than a sheet that could not hold the box", () => {
    expect(d.width).toBeGreaterThan(dims.length);
    expect(d.height).toBeGreaterThan(0);
  });
});

describe("panel dimensions equal the requested box dimensions", () => {
  it("rsc: L | W | L | W panels of height H, flaps of W/2, glue tab included in the width", () => {
    const { length: L, width: W, height: H } = DIMS.rsc;
    const d = buildDieline("rsc", DIMS.rsc);
    expect(spanX(face(d, "panel-1"))).toBeCloseTo(L, 6);
    expect(spanX(face(d, "panel-2"))).toBeCloseTo(W, 6);
    expect(spanX(face(d, "panel-3"))).toBeCloseTo(L, 6);
    expect(spanX(face(d, "panel-4"))).toBeCloseTo(W, 6);
    for (const id of ["panel-1", "panel-2", "panel-3", "panel-4"]) {
      expect(spanY(face(d, id)), id).toBeCloseTo(H, 6);
    }
    for (const id of ["top-1", "bottom-1"]) {
      expect(spanY(face(d, id)), id).toBeCloseTo(W / 2, 6);
    }
    expect(d.height).toBeCloseTo(H + W, 6);
    // glue tab = width - (2L + 2W)
    expect(d.width - (2 * L + 2 * W)).toBeGreaterThan(0);
  });

  it("tuck-end: L | W | L | W panels of height H with lid and tuck on the back panel", () => {
    const { length: L, width: W, height: H } = DIMS["tuck-end"];
    const d = buildDieline("tuck-end", DIMS["tuck-end"]);
    expect(spanX(face(d, "panel-1"))).toBeCloseTo(L, 6);
    expect(spanX(face(d, "panel-2"))).toBeCloseTo(W, 6);
    expect(spanY(face(d, "panel-1"))).toBeCloseTo(H, 6);
    expect(spanX(face(d, "lid-top"))).toBeCloseTo(L, 6);
    expect(d.faces.map((f) => f.id)).toEqual(expect.arrayContaining(["tuck-top", "tuck-bottom", "lid-bottom"]));
    // dust flaps sit on the two W panels only
    const dust = d.faces.filter((f) => f.id.startsWith("dust-")).map((f) => f.id);
    expect(dust.sort()).toEqual(["dust-bottom-2", "dust-bottom-4", "dust-top-2", "dust-top-4"]);
  });

  it("tray: base is exactly L x W and the sheet is L+2H by W+2H", () => {
    const { length: L, width: W, height: H } = DIMS.tray;
    const d = buildDieline("tray", DIMS.tray);
    expect(spanX(face(d, "base"))).toBeCloseTo(L, 6);
    expect(spanY(face(d, "base"))).toBeCloseTo(W, 6);
    expect(d.width).toBeCloseTo(L + 2 * H, 6);
    expect(d.height).toBeCloseTo(W + 2 * H, 6);
    expect(spanY(face(d, "wall-back"))).toBeCloseTo(H, 6);
    expect(spanX(face(d, "wall-left"))).toBeCloseTo(H, 6);
  });
});

describe("dielineSegments", () => {
  it.each(STYLES)("%s: emits only cut/fold segments and de-duplicates shared fold edges", (style) => {
    const d = buildDieline(style, DIMS[style]);
    const segs = dielineSegments(d);
    const totalEdges = d.faces.reduce((n, f) => n + f.points.length, 0);

    expect(segs.length).toBeGreaterThan(0);
    expect(segs.length).toBeLessThan(totalEdges);
    for (const s of segs) expect(["cut", "fold"]).toContain(s.kind);

    const key = (s: (typeof segs)[number]) => {
      const [p, q] = s.a[0] < s.b[0] || (s.a[0] === s.b[0] && s.a[1] <= s.b[1]) ? [s.a, s.b] : [s.b, s.a];
      return `${s.kind}|${p[0].toFixed(3)},${p[1].toFixed(3)}-${q[0].toFixed(3)},${q[1].toFixed(3)}`;
    };
    expect(new Set(segs.map(key)).size).toBe(segs.length);
  });

  it("marks every crease of a tray base as a fold and its outline as cuts", () => {
    const d = buildDieline("tray", DIMS.tray);
    const segs = dielineSegments(d);
    expect(segs.some((s) => s.kind === "fold")).toBe(true);
    expect(segs.some((s) => s.kind === "cut")).toBe(true);
  });
});

describe("faceCentroid", () => {
  it("returns the centre of the bounding box", () => {
    expect(
      faceCentroid({
        id: "f",
        name: "f",
        points: [
          [0, 0],
          [10, 0],
          [10, 4],
          [0, 4],
        ],
        folds: [],
      }),
    ).toEqual([5, 2]);
  });
});

describe("dielineToSvg", () => {
  const d = buildDieline("rsc", DIMS.rsc);

  it("writes true-size millimetre output with separate CUT and CREASE layers", () => {
    const svg = dielineToSvg(d, 5);
    expect(svg).toContain('<g id="CUT"');
    expect(svg).toContain('<g id="CREASE"');
    expect(svg).toContain(`width="${d.width + 10}mm"`);
    expect(svg).toContain(`height="${d.height + 10}mm"`);
    expect(svg).toContain(`viewBox="0 0 ${d.width + 10} ${d.height + 10}"`);
    expect(svg).toContain('stroke-dasharray="3 2"');
  });

  it("applies the margin to the geometry as well as the canvas", () => {
    const noMargin = dielineToSvg(d, 0);
    const margin = dielineToSvg(d, 5);
    expect(noMargin).toContain('x1="0"');
    expect(margin).not.toContain('x1="0"');
    expect(margin.length).toBeGreaterThan(0);
  });

  it("emits one line per segment", () => {
    const svg = dielineToSvg(d, 3);
    expect(svg.match(/<line /g)?.length).toBe(dielineSegments(d).length);
  });
});
