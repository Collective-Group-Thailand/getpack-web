import { describe, expect, it } from "vitest";

import { budgetState, docsReady, overThreshold, readDocs, roi } from "./rules";

describe("business landing rules (C10)", () => {
  it("compares the API's amount with the visitor's threshold as written, never as a computed number", () => {
    expect(overThreshold("38970.00", 20000)).toBe(true);
    expect(overThreshold("11436.00", 20000)).toBe(false);
    expect(overThreshold("20000.00", 20000)).toBe(false);
    expect(overThreshold("20000.01", 20000)).toBe(true);
    expect(overThreshold("120.00", 0)).toBe(true);
  });

  it("estimates the hours and baht back from the visitor's numbers (15 minutes per approval)", () => {
    expect(roi({ quotesPerMonth: 8, hoursPerQuote: 2, approvalsPerMonth: 10, hourlyCost: 250 })).toEqual({
      quoteHours: 192,
      approvalHours: 30,
      hours: 222,
      baht: 55500,
    });
  });

  it("warns at 80 % of a budget and asks for approval over it", () => {
    expect(budgetState(50000, 30000)).toEqual({ pct: 60, state: "ok" });
    expect(budgetState(50000, 40000)).toEqual({ pct: 80, state: "warn" });
    expect(budgetState(50000, 52000)).toEqual({ pct: 104, state: "over" });
  });

  it("reads the checklist kept on this device and counts the required documents only", () => {
    expect(readDocs('["vat","statements","nonsense"]')).toEqual(["vat", "statements"]);
    expect(readDocs("not json")).toEqual([]);
    expect(readDocs(null)).toEqual([]);
    expect(docsReady(["certificate", "vat", "statements"])).toBe(2);
  });
});
