import { describe, expect, it } from "vitest";

import {
  compareDecimal,
  daysLeft,
  dealState,
  featuredDeal,
  pickerRowState,
  sortApplicable,
  stubValue,
  thbCompact,
} from "./model";

const row = (code: string, saving: string, best = false, conflictsWith: string[] = []) => ({
  code,
  saving,
  best,
  conflictsWith,
});

describe("the cart picker's order", () => {
  it("compares decimal strings without turning them into numbers", () => {
    expect(compareDecimal("1331.00", "250.00")).toBeGreaterThan(0);
    expect(compareDecimal("99.99", "100.00")).toBeLessThan(0);
    expect(compareDecimal("250.5", "250.50")).toBe(0);
    expect(compareDecimal("0250.00", "250.00")).toBe(0);
    expect(compareDecimal("12.05", "12.5")).toBeLessThan(0);
  });

  it("puts the API's best first, then the larger saving, then the code", () => {
    const sorted = sortApplicable([
      row("LABEL8", "340.00"),
      row("FREESHIP", "250.00"),
      row("AAA", "340.00"),
      row("BOX10", "1331.00", true),
    ]);
    expect(sorted.map((entry) => entry.code)).toEqual(["BOX10", "AAA", "LABEL8", "FREESHIP"]);
  });

  it("does not reorder the input it is given", () => {
    const input = [row("B", "1.00"), row("A", "2.00")];
    sortApplicable(input);
    expect(input.map((entry) => entry.code)).toEqual(["B", "A"]);
  });
});

describe("a picker row's state (D-452)", () => {
  const all = [
    row("BOX10", "1331.00", true, ["LABEL8"]),
    row("LABEL8", "340.00", false, ["BOX10"]),
    row("FREESHIP", "250.00"),
  ];

  it("is ticked when the cart holds the code", () => {
    expect(pickerRowState(all[0]!, ["BOX10"], all, 3)).toEqual({ kind: "applied" });
  });

  it("names the held code it cannot be used with — whichever side declares the conflict", () => {
    expect(pickerRowState(all[1]!, ["BOX10"], all, 3)).toEqual({ kind: "conflict", with: "BOX10" });
    const oneSided = [row("BOX10", "1331.00", true, ["LABEL8"]), row("LABEL8", "340.00")];
    expect(pickerRowState(oneSided[1]!, ["BOX10"], oneSided, 3)).toEqual({ kind: "conflict", with: "BOX10" });
  });

  it("stops at the cart's maximum: with 3 codes held, a fourth cannot be ticked", () => {
    const extra = row("NEW5", "50.00");
    expect(pickerRowState(extra, ["A", "B", "C"], [...all, extra], 3)).toEqual({ kind: "full", max: 3 });
    expect(pickerRowState(extra, ["A", "B"], [...all, extra], 3)).toEqual({ kind: "available" });
  });
});

describe("the ticket", () => {
  const format = { thbWhole: (amount: string) => thbCompact(amount, "th"), percent: (value: string) => `${value}%` };

  it("words each kind of benefit for the stub", () => {
    expect(stubValue({ kind: "percent", value: "10", maxDiscount: "1500.00", summary: "" }, format)).toEqual({
      word: "off",
      figure: { kind: "number", text: "10%" },
      cap: "฿1,500",
    });
    expect(stubValue({ kind: "amount", value: "300.00", maxDiscount: null, summary: "" }, format).figure).toEqual({
      kind: "number",
      text: "฿300",
    });
    expect(stubValue({ kind: "amount", value: "12.50", maxDiscount: null, summary: "" }, format).figure).toEqual({
      kind: "number",
      text: "฿12.50",
    });
    expect(stubValue({ kind: "free_shipping", value: "", maxDiscount: null, summary: "" }, format).figure).toEqual({
      kind: "word",
      key: "freeShipping",
    });
    expect(stubValue({ kind: "points_multiplier", value: "2", maxDiscount: null, summary: "" }, format)).toMatchObject({
      word: "points",
      figure: { text: "×2" },
    });
  });

  it("counts the days left up, and only while the deal is running", () => {
    const now = Date.parse("2026-11-04T10:00:00+07:00");
    expect(daysLeft("2026-11-05T16:00:00+07:00", now)).toBe(2);
    expect(daysLeft("2026-11-04T12:00:00+07:00", now)).toBe(1);
    expect(daysLeft("2026-11-04T09:00:00+07:00", now)).toBeNull();
    expect(daysLeft(null, now)).toBeNull();
  });

  it("derives the card's state from the deal and the reader", () => {
    expect(dealState({ code: "BOX10", myStatus: null }, false)).toBe("guest");
    expect(dealState({ code: "BOX10", myStatus: "claimable" }, true)).toBe("claimable");
    expect(dealState({ code: "BOX10", myStatus: "saved" }, true)).toBe("saved");
    expect(dealState({ code: "BOX10", myStatus: "used" }, true)).toBe("used");
    expect(dealState({ code: "WELCOME300", myStatus: "not_eligible" }, true)).toBe("ineligible");
    expect(dealState({ code: null, myStatus: null }, true)).toBe("automatic");
  });

  it("leads with the first featured deal, or none", () => {
    expect(featuredDeal([{ featured: false }, { featured: true, id: 2 }, { featured: true, id: 3 }])).toEqual({
      featured: true,
      id: 2,
    });
    expect(featuredDeal([{ featured: false }])).toBeNull();
  });
});
