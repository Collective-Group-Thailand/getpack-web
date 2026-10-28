import { describe, expect, it } from "vitest";

import { placeIn } from "../components/studio-shell/element-info";
import type { DesignContent, DesignElement } from "../types";
import { constrain45, dragBox, newPath, polylineOf } from "./draw";
import { fitAreas } from "./fit";
import { documentColours, inkOf, isBlackInk, recolour } from "./ink";

const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const text = (id: string, fill: string, extra: Partial<DesignElement> = {}) =>
  ({
    ...base,
    id,
    x: 0,
    y: 0,
    type: "text",
    text: "a",
    fontSize: 4,
    fontFamily: "Sarabun",
    fontStyle: "normal",
    fill,
    align: "left",
    ...extra,
  }) as DesignElement;
const rect = (id: string, fill: string, stroke = "#000000", strokeWidth = 0) =>
  ({
    ...base,
    id,
    x: 0,
    y: 0,
    type: "rect",
    width: 10,
    height: 10,
    fill,
    stroke,
    strokeWidth,
    cornerRadius: 0,
  }) as DesignElement;
const content = (elements: DesignElement[]): DesignContent => ({
  elements,
  pattern: { kind: "solid", color: "#2e6b54", background: "#ffffff", size: 12 },
});

describe("fitAreas (C8: the sheet fits clear of the 3D card)", () => {
  it("is the stage less its insets without a card", () => {
    expect(fitAreas(800, 600, { top: 18, right: 0, bottom: 64, left: 18 }, null, 24)).toEqual([
      { x: 42, y: 42, width: 734, height: 470 },
    ]);
  });
  it("offers the band below the card and the band beside it", () => {
    const [below, beside] = fitAreas(
      800,
      600,
      { top: 0, right: 0, bottom: 64, left: 0 },
      { width: 236, height: 177, top: 12, right: 14 },
      24,
    );
    expect(below!.y).toBe(12 + 177 + 24);
    expect(below!.width).toBe(752);
    expect(beside!.x + beside!.width).toBe(800 - 14 - 236 - 24);
  });
});

describe("ink helpers (สีในงาน, แยกหมึก)", () => {
  it("tells black ink from colours", () => {
    expect(isBlackInk("#111111")).toBe(true);
    expect(isBlackInk("#2E6B54")).toBe(false);
    expect(inkOf(text("t", "#111111"))).toBe("black");
    expect(inkOf(rect("r", "#2e6b54", "#111111", 0.5))).toBe("both");
  });
  it("counts each colour's uses on both sides and the background, hidden ones left out", () => {
    const c = content([text("a", "#2E6B54"), rect("b", "#2e6b54"), text("c", "#E8B04B", { hidden: true })]);
    expect(documentColours(c)).toEqual([{ colour: "#2e6b54", uses: 3 }]);
  });
  it("recolours everywhere — fills, strokes, gradients and the background", () => {
    const c = content([
      text("a", "#2e6b54", {
        fillGradient: { kind: "linear", from: "#2e6b54", to: "#ffffff", angle: 0 },
      } as Partial<DesignElement>),
      rect("b", "#ffffff", "#2E6B54", 1),
    ]);
    const next = recolour(c, "#2e6b54", "#5a3825");
    expect((next.elements[0] as { fill: string }).fill).toBe("#5a3825");
    expect((next.elements[0] as { fillGradient: { from: string } }).fillGradient.from).toBe("#5a3825");
    expect((next.elements[1] as { stroke: string }).stroke).toBe("#5a3825");
    expect(next.pattern.color).toBe("#5a3825");
  });
});

describe("drawing helpers (pro toolbox)", () => {
  it("drags a box either way; ⇧ makes it square", () => {
    expect(dragBox([10, 10], [0, 4], false)).toEqual({ x: 0, y: 4, width: 10, height: 6 });
    expect(dragBox([0, 0], [10, 4], true)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
  it("snaps to 45°", () => {
    const [x, y] = constrain45([0, 0], [10, 9]);
    expect(Math.abs(x - y)).toBeLessThan(1e-9);
  });
  it("turns pen points into an open or closed shape in its own 100 × 100 box", () => {
    const line = newPath(
      [
        [10, 20],
        [60, 20],
      ],
      false,
    )!;
    expect(line).toMatchObject({ type: "shape", open: true, x: 10, width: 50, height: 0.5 });
    const poly = polylineOf((line as { path: string }).path)!;
    expect(poly.closed).toBe(false);
    expect(poly.points).toEqual([0, 50, 100, 50]);
    const tri = newPath(
      [
        [0, 0],
        [10, 0],
        [5, 10],
      ],
      true,
    )!;
    expect(polylineOf((tri as { path: string }).path)!.closed).toBe(true);
    expect(newPath([[0, 0]], false)).toBeNull();
  });
  it("leaves library paths (curves) to the path renderer", () => {
    expect(polylineOf("M50 0 C 70 0 100 30 100 50 Z")).toBeNull();
  });
});

describe("placeIn (easy inspector's 9-cell grid, 5 mm inside the panel)", () => {
  const frame = { x: 100, y: 50, width: 150, height: 80 };
  const box = { x: 0, y: 0, width: 20, height: 10 };
  it("puts the box in each corner and the centre", () => {
    expect(placeIn(box, frame, 0, 5)).toEqual({ dx: 105, dy: 55 });
    expect(placeIn(box, frame, 4, 5)).toEqual({ dx: 165, dy: 85 });
    expect(placeIn(box, frame, 8, 5)).toEqual({ dx: 225, dy: 115 });
  });
});
