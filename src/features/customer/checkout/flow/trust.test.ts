import { describe, expect, it } from "vitest";

import { leadDaysOf, readyDateOf } from "./trust";

describe("trust lines (checkout redesign item 6)", () => {
  it("the cart is ready once its last line is; unknown when a line has no date", () => {
    expect(readyDateOf([{ earliestShipDate: "2026-11-09" }, { earliestShipDate: "2026-11-12" }])).toBe("2026-11-12");
    expect(readyDateOf([{ earliestShipDate: "2026-11-09" }, { earliestShipDate: null }])).toBeNull();
  });

  it("production days are the longest line's, from data only", () => {
    expect(leadDaysOf([{ leadTimeDays: 5 }, { leadTimeDays: 7 }])).toBe(7);
    expect(leadDaysOf([{ leadTimeDays: 5 }, { leadTimeDays: null }])).toBeNull();
    expect(leadDaysOf([])).toBeNull();
  });
});
