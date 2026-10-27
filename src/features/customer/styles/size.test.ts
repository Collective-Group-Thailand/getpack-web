import { describe, expect, it } from "vitest";

import { cmOf, cmOfSize, sizeOfCm } from "./size";

describe("size search units (C0)", () => {
  it("turns typed centimetres (W × L × H) into the URL's L x W x H millimetres", () => {
    expect(sizeOfCm({ w: "8", l: "12", h: "5" })).toBe("120x80x50");
    expect(sizeOfCm({ w: "8.5", l: "12,3", h: "5" })).toBe("123x85x50");
  });

  it("refuses a missing or non-positive dimension", () => {
    expect(sizeOfCm({ w: "", l: "12", h: "5" })).toBeNull();
    expect(sizeOfCm({ w: "0", l: "12", h: "5" })).toBeNull();
    expect(sizeOfCm({ w: "abc", l: "12", h: "5" })).toBeNull();
  });

  it("reads the URL back as centimetres", () => {
    expect(cmOfSize("123x85x50")).toEqual({ l: "12.3", w: "8.5", h: "5" });
    expect(cmOfSize("bad")).toBeNull();
    expect(cmOf(205)).toBe("20.5");
  });
});
