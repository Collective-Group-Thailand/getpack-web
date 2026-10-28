import { describe, expect, it } from "vitest";

import { bestFit, cmToMm, fitsIn, FIT_CLEARANCE_MM, LOW_FIT_PERCENT } from "./fit";

// The postal box's 11 standard sizes as UAT lists them (inside, mm) — the shape of the data, not prices.
const SIZES = [
  { code: "00", lengthMm: 140, widthMm: 97.5, heightMm: 60 },
  { code: "0", lengthMm: 170, widthMm: 110, heightMm: 60 },
  { code: "0+4", lengthMm: 170, widthMm: 110, heightMm: 100 },
  { code: "A", lengthMm: 200, widthMm: 140, heightMm: 60 },
  { code: "2A", lengthMm: 200, widthMm: 140, heightMm: 120 },
  { code: "B", lengthMm: 250, widthMm: 170, heightMm: 90 },
  { code: "C", lengthMm: 300, widthMm: 200, heightMm: 110 },
  { code: "C+8", lengthMm: 300, widthMm: 200, heightMm: 190 },
  { code: "D", lengthMm: 350, widthMm: 220, heightMm: 140 },
  { code: "E", lengthMm: 400, widthMm: 240, heightMm: 170 },
  { code: "F", lengthMm: 450, widthMm: 300, heightMm: 220 },
];

describe("size finder fit (DECISIONS-STAGE-A §4: +0.5 cm per dimension, L/W may swap)", () => {
  it("uses the styles' clearance", () => {
    expect(FIT_CLEARANCE_MM).toBe(5);
    expect(LOW_FIT_PERCENT).toBe(45);
  });

  it("recommends the smallest-volume size that fits", () => {
    const answer = bestFit(SIZES, { l: 250, w: 180, h: 80 });
    expect(answer?.size.code).toBe("C");
    expect(answer?.rotated).toBe(false);
  });

  it("turns the product on its base (L ↔ W) when that is what fits", () => {
    expect(fitsIn(SIZES[0]!, { l: 90, w: 130, h: 50 })).toEqual({ rotated: true });
    expect(bestFit(SIZES, { l: 90, w: 130, h: 50 })?.size.code).toBe("00");
  });

  it("never turns the product upright: height is not swapped", () => {
    // 50 × 50 × 130 would fit 00 lying down, but height stays height → the smallest size ≥ 135 mm high (D).
    expect(bestFit(SIZES, { l: 50, w: 50, h: 130 })?.size.code).toBe("D");
  });

  it("fits exactly at the clearance and not 0.1 mm over", () => {
    expect(fitsIn(SIZES[0]!, { l: 135, w: 92.5, h: 55 })).toEqual({ rotated: false });
    expect(fitsIn(SIZES[0]!, { l: 135.1, w: 92.5, h: 55 })).toBeNull();
    expect(bestFit([SIZES[0]!], { l: 135, w: 92.5, h: 55 })?.utilisation).toBe(84);
  });

  it("answers null when nothing fits or the input is not a size", () => {
    expect(bestFit(SIZES, { l: 500, w: 100, h: 100 })).toBeNull();
    expect(bestFit(SIZES, { l: 0, w: 100, h: 100 })).toBeNull();
    expect(bestFit(SIZES, { l: Number.NaN, w: 1, h: 1 })).toBeNull();
    expect(bestFit([], { l: 10, w: 10, h: 10 })).toBeNull();
  });

  it("flags a loose fit below 45 % for the custom-size tip", () => {
    const loose = bestFit(SIZES, { l: 100, w: 50, h: 30 });
    expect(loose?.size.code).toBe("00");
    expect(loose?.lowFit).toBe(true);
    expect(bestFit(SIZES, { l: 130, w: 90, h: 50 })?.lowFit).toBe(false);
  });

  it("skips flat sizes (height 0)", () => {
    expect(bestFit([{ code: "flat", lengthMm: 500, widthMm: 500, heightMm: 0 }], { l: 1, w: 1, h: 1 })).toBeNull();
  });

  it("reads centimetres", () => {
    expect(cmToMm("25")).toBe(250);
    expect(cmToMm("9,75")).toBe(97.5);
    expect(cmToMm("")).toBeNull();
    expect(cmToMm("-1")).toBeNull();
    expect(cmToMm("abc")).toBeNull();
  });
});
