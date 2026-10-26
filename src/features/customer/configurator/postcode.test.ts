import { afterEach, describe, expect, it, vi } from "vitest";

import { rememberedPostcode } from "./postcode";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("rememberedPostcode", () => {
  it("keeps a complete postcode for the next configuration", () => {
    expect(rememberedPostcode()).toBeNull();
    expect(rememberedPostcode("10110")).toBe("10110");
    expect(rememberedPostcode()).toBe("10110");
  });

  it("does not keep a partial or garbled postcode, and ignores a garbled stored value", () => {
    rememberedPostcode("10110");
    expect(rememberedPostcode("101")).toBe("10110");
    window.localStorage.setItem("getpack.postcode", "abc");
    expect(rememberedPostcode()).toBeNull();
  });

  it("remembers nothing, and does not throw, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(rememberedPostcode("10110")).toBeNull();
  });
});
