import { describe, expect, it } from "vitest";

import { compareDecimal } from "./decimal";

describe("compareDecimal", () => {
  it("orders decimal strings without arithmetic", () => {
    expect(compareDecimal("9.80", "12.5")).toBe(-1);
    expect(compareDecimal("12.50", "12.5")).toBe(0);
    expect(compareDecimal("12.51", "12.5")).toBe(1);
    expect(compareDecimal("007.10", "7.1")).toBe(0);
    expect(compareDecimal("100", "99.99")).toBe(1);
    expect(compareDecimal("abc", "1")).toBe(0);
  });
});
