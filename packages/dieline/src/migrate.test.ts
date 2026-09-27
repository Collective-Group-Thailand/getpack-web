import { describe, expect, it } from "vitest";

import { findFace, faceBounds } from "./faces";
import { buildDielineV1 } from "./legacy/v1";
import { migrateSpec, remapV1Point, SPEC_VERSION, v1FaceId, type V1Spec } from "./migrate";
import { getStyle } from "./styles";

const v1: V1Spec = { style: "tuck-end", dims: { length: 70, width: 40, height: 150 }, paperId: "ivory-350" };

describe("migrateSpec", () => {
  it("turns a BoxStudio spec into a v2 spec with the frozen board", () => {
    expect(migrateSpec(v1)).toEqual({
      specVersion: SPEC_VERSION,
      styleId: "tuck-end",
      values: { length: 70, width: 40, height: 150 },
      material: { caliperMm: 0.45, kind: "paperboard" },
      materialId: "ivory-350",
    });
  });

  it("passes a current spec through and refuses garbage", () => {
    const current = migrateSpec(v1)!;
    expect(migrateSpec(current)).toBe(current);
    expect(migrateSpec({ style: "hexagon", dims: { length: 1, width: 1, height: 1 }, paperId: "x" })).toBeNull();
    expect(migrateSpec(null)).toBeNull();
  });

  it("maps every v1 face id to a face that exists in v2", () => {
    for (const style of ["rsc", "tuck-end", "tray"] as const) {
      const dims = { length: 150, width: 100, height: 80 };
      const next = getStyle(style).build(dims, { caliperMm: 0.45, kind: "paperboard" });
      for (const f of buildDielineV1(style, dims).faces)
        expect(findFace(next, v1FaceId(style, f.id)), `${style} ${f.id}`).toBeDefined();
    }
  });
});

describe("remapV1Point", () => {
  it("keeps artwork on the same face at the same relative position", () => {
    const next = getStyle("tuck-end").build(migrateSpec(v1)!.values, migrateSpec(v1)!.material);
    const old = buildDielineV1("tuck-end", v1.dims);
    const front = old.faces.find((f) => f.id === "panel-1")!;
    const xs = front.points.map((p) => p[0]);
    const ys = front.points.map((p) => p[1]);
    const centre: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const moved = remapV1Point(v1, next, centre);
    const b = faceBounds(findFace(next, "front")!);
    expect(moved[0]).toBeCloseTo(b.x + b.width / 2, 6);
    expect(moved[1]).toBeCloseTo(b.y + b.height / 2, 6);
  });
});
