import { allFaces, faceBounds, getStyle } from "@packio/dieline";
import { describe, expect, it } from "vitest";

import { faceAnchor, faceAt, flatAnchor, readAnchor, sheetPoint } from "./anchors";

const style = getStyle("tuck-end");
const material = { caliperMm: 0.45, kind: style.materials[0]! };
const d = style.build(style.presets[0]!.values, material);

describe("comment anchors", () => {
  it("a point on a face round-trips through its face anchor", () => {
    const face = allFaces(d)[0]!;
    const b = faceBounds(face);
    const p: [number, number] = [b.x + b.width * 0.42, b.y + b.height * 0.3];
    const anchor = faceAnchor(d, p, face.id)!;
    expect(anchor).toEqual({ faceId: face.id, u: 0.42, v: 0.3 });
    const back = sheetPoint(d, anchor)!;
    expect(back[0]).toBeCloseTo(p[0], 1);
    expect(back[1]).toBeCloseTo(p[1], 1);
  });

  it("finds the face under a point, and none off the sheet", () => {
    const face = allFaces(d).find((f) => f.id === "front") ?? allFaces(d)[0]!;
    const b = faceBounds(face);
    expect(faceAt(d, [b.x + b.width / 2, b.y + b.height / 2])).toBe(face.id);
    expect(faceAt(d, [-50, -50])).toBeNull();
    expect(faceAnchor(d, [-50, -50])).toBeNull();
  });

  it("a flat anchor is the point itself; an unknown face has no point", () => {
    expect(sheetPoint(d, flatAnchor([10.04, 20.06]))).toEqual([10, 20.1]);
    expect(sheetPoint(d, { faceId: "nope", u: 0.5, v: 0.5 })).toBeNull();
  });

  it("reads the API's opaque anchor", () => {
    expect(readAnchor({ faceId: "front", u: 0.1, v: 0.2 })).toEqual({ faceId: "front", u: 0.1, v: 0.2 });
    expect(readAnchor({ xMm: 1, yMm: 2 })).toEqual({ xMm: 1, yMm: 2 });
    expect(readAnchor({ faceId: "front" })).toBeNull();
    expect(readAnchor(null)).toBeNull();
  });
});
