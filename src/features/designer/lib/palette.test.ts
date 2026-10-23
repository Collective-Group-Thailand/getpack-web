import { describe, expect, it } from "vitest";

import { extractPalette } from "./palette";

const image = (pixels: [number, number, number, number][]) => new Uint8ClampedArray(pixels.flat());

describe("palette from a logo (U4.4)", () => {
  it("finds the logo's colours, most used first, without the white paper or transparent pixels", () => {
    const red: [number, number, number, number] = [200, 30, 40, 255];
    const navy: [number, number, number, number] = [20, 30, 90, 255];
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const clear: [number, number, number, number] = [0, 0, 0, 0];
    const palette = extractPalette(
      image([...Array(60).fill(red), ...Array(30).fill(navy), ...Array(100).fill(white), ...Array(50).fill(clear)]),
      4,
    );
    expect(palette[0]).toBe("#c81e28");
    expect(palette).toContain("#141e5a");
    expect(palette).not.toContain("#ffffff");
  });

  it("is empty for a blank image", () => {
    expect(extractPalette(image([[255, 255, 255, 255]]))).toEqual([]);
  });
});
