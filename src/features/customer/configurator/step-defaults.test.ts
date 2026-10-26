import { describe, expect, it } from "vitest";

import { isDefaultStep } from "./step-defaults";

describe("isDefaultStep", () => {
  it("keeps choice steps on ค่าเริ่มต้น until touched or confirmed", () => {
    expect(isDefaultStep("material", new Set())).toBe(true);
    expect(isDefaultStep("printing", new Set())).toBe(true);
    expect(isDefaultStep("finishing", new Set())).toBe(true);
    expect(isDefaultStep("printing", new Set(["printing"]))).toBe(false);
    // Size, quantity and the rest are answers the customer gives, not catalogue defaults.
    expect(isDefaultStep("size", new Set())).toBe(false);
    expect(isDefaultStep("quantity", new Set())).toBe(false);
  });
});
