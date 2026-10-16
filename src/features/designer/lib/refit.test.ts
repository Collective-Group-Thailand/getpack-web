import { allFaces, faceBounds, getStyle } from "@getpack/dieline";
import { describe, expect, it } from "vitest";

import type { DesignContent, DesignElement } from "../types";
import { elementCorners, localSize } from "./geometry";
import { refitContent } from "./refit";

const style = getStyle("tuck-end");
const material = { caliperMm: 0.45, kind: style.materials[0]! };
const small = style.build({ ...style.presets[0]!.values, length: 70, width: 40, height: 150 }, material);
const big = style.build({ ...style.presets[0]!.values, length: 105, width: 60, height: 225 }, material);

const centreOf = (el: DesignElement) => {
  const c = elementCorners(el, localSize(el));
  return [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4] as const;
};

describe("re-fitting a design to a new size", () => {
  const face = allFaces(small).find((f) => f.id === "front") ?? allFaces(small)[0]!;
  const b = faceBounds(face);
  const rect: DesignElement = {
    id: "r",
    type: "rect",
    x: b.x + b.width * 0.25,
    y: b.y + b.height * 0.4,
    width: b.width * 0.5,
    height: 10,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    fill: "#123456",
    stroke: "#123456",
    strokeWidth: 0,
    cornerRadius: 0,
    clipFaceId: face.id,
  } as DesignElement;
  const content: DesignContent = {
    elements: [rect],
    pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 },
  };

  it("keeps an element at the same place on its face, scaled with the face", () => {
    const [after] = refitContent(content, small, big).elements as [DesignElement];
    const nb = faceBounds(allFaces(big).find((f) => f.id === face.id)!);
    const [cx, cy] = centreOf(after);
    expect((cx - nb.x) / nb.width).toBeCloseTo(0.5, 3);
    expect((cy - nb.y) / nb.height).toBeCloseTo(0.4 + 5 / b.height, 3);
    const k = Math.min(nb.width / b.width, nb.height / b.height);
    expect(after.scaleX).toBeCloseTo(k, 6);
    expect(after.scaleY).toBeCloseTo(k, 6);
    expect(after.rotation).toBe(0);
  });

  it("round-trips back to the original size", () => {
    const back = refitContent(refitContent(content, small, big), big, small).elements[0]!;
    const [x0, y0] = centreOf(rect);
    const [x1, y1] = centreOf(back);
    expect(x1).toBeCloseTo(x0, 6);
    expect(y1).toBeCloseTo(y0, 6);
    // Caliper allowances do not scale with the box: within a thousandth.
    expect(back.scaleX).toBeCloseTo(1, 3);
  });

  it("leaves the background and colours alone", () => {
    const after = refitContent(content, small, big);
    expect(after.pattern).toEqual(content.pattern);
    expect((after.elements[0] as { fill: string }).fill).toBe("#123456");
  });
});
