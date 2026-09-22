import { describe, expect, it } from "vitest";
import { flat, insetConvex, PX_PER_MM } from "./geometry";
import type { Pt } from "./types";

const SQUARE: Pt[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

const signedArea = (pts: Pt[]) =>
  pts.reduce((a, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return a + (p[0] * q[1] - q[0] * p[1]);
  }, 0) / 2;

describe("PX_PER_MM", () => {
  it("is 96 dpi expressed per millimetre", () => {
    expect(PX_PER_MM).toBeCloseTo(96 / 25.4, 10);
  });
});

describe("insetConvex", () => {
  it("shrinks a square by the inset distance on every side", () => {
    const out = insetConvex(SQUARE, 2);
    expect(out).not.toBeNull();
    expect(out!).toHaveLength(4);
    const xs = out!.map((p) => p[0]);
    const ys = out!.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(2, 9);
    expect(Math.max(...xs)).toBeCloseTo(8, 9);
    expect(Math.min(...ys)).toBeCloseTo(2, 9);
    expect(Math.max(...ys)).toBeCloseTo(8, 9);
  });

  it("insets inwards regardless of winding direction", () => {
    const reversed = [...SQUARE].reverse();
    expect(signedArea(SQUARE) * signedArea(reversed)).toBeLessThan(0);
    const out = insetConvex(reversed, 2)!;
    const xs = out.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(2, 9);
    expect(Math.max(...xs)).toBeCloseTo(8, 9);
  });

  it("preserves the winding direction of the input", () => {
    expect(Math.sign(signedArea(insetConvex(SQUARE, 2)!))).toBe(Math.sign(signedArea(SQUARE)));
    const reversed = [...SQUARE].reverse();
    expect(Math.sign(signedArea(insetConvex(reversed, 2)!))).toBe(Math.sign(signedArea(reversed)));
  });

  it("returns null when the polygon collapses to a point", () => {
    expect(insetConvex(SQUARE, 5)).toBeNull();
  });

  // Known limitation of the current offset maths, pinned here so the move into
  // @packio/dieline cannot change it silently: past the collapse distance the
  // offset lines cross over and produce a mirrored polygon whose signed area is
  // still positive, so the guard in insetConvex does not reject it.
  // Callers must keep the inset below half the smallest span.
  it("does not detect an over-inset that turns the polygon inside out", () => {
    const out = insetConvex(SQUARE, 6);
    expect(out).not.toBeNull();
    const xs = out!.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(4, 9);
    expect(Math.max(...xs)).toBeCloseTo(6, 9);
  });

  it("returns the polygon unchanged for a zero inset", () => {
    const out = insetConvex(SQUARE, 0)!;
    out.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(SQUARE[i][0], 9);
      expect(p[1]).toBeCloseTo(SQUARE[i][1], 9);
    });
  });

  it("handles a triangle", () => {
    const tri: Pt[] = [
      [0, 0],
      [12, 0],
      [6, 9],
    ];
    const out = insetConvex(tri, 1)!;
    expect(out).toHaveLength(3);
    expect(Math.abs(signedArea(out))).toBeLessThan(Math.abs(signedArea(tri)));
  });
});

describe("flat", () => {
  it("flattens points into the flat number array Konva expects", () => {
    expect(
      flat([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([1, 2, 3, 4]);
    expect(flat([])).toEqual([]);
  });
});
