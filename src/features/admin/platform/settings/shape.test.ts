import { describe, expect, it } from "vitest";

import {
  areaOf,
  editableShape,
  editorOf,
  isChoice,
  leafOf,
  parseLeaf,
  plainDescription,
  setAt,
  unitOf,
  wideValue,
} from "./shape";

describe("unitOf", () => {
  it("reads the unit from the key's own words", () => {
    expect(unitOf("quotes.validity_days")).toBe("days");
    expect(unitOf("payments.slip_review_sla_business_hours")).toBe("businessHours");
    expect(unitOf("production.factory_acceptance_sla_business_days")).toBe("businessDays");
    expect(unitOf("auth.access_token_ttl_seconds")).toBe("seconds");
    expect(unitOf("lockMinutes")).toBe("minutes");
    expect(unitOf("maxPerIpPerHour")).toBe("perHour");
    expect(unitOf("pricing.margin_floor_pct")).toBe("pct");
    expect(unitOf("referrerRewardBaht")).toBe("baht");
    expect(unitOf("reminderDaysBeforeDue")).toBe("days");
    expect(unitOf("api.max_keys_per_company")).toBeNull();
    expect(unitOf("dayOfNextMonth")).toBeNull();
  });
});

describe("editor shapes", () => {
  it("types flat and two-level structures, leaves the rest to JSON", () => {
    expect(editableShape({ lockMinutes: 15, maxFailedAttempts: 5 })).toBe(true);
    expect(editableShape({ pp30: { dayOfNextMonth: 15 }, reminderDaysBefore: 3 })).toBe(true);
    expect(editableShape([10, 25, 50])).toBe(true);
    expect(editableShape([{ tier: "member" }])).toBe(false);
    expect(editableShape({ zones: {}, default: { min: 3, max: 5 } })).toBe(false);
    expect(editorOf({ key: "x.y", valueType: "json" }, null)).toBe("json");
    expect(editorOf({ key: "x.y", valueType: "integer" }, 3)).toBe("leaf");
    expect(editorOf({ key: "calendar.business_hours", valueType: "time_of_day_window" }, null)).toBe("window");
  });

  it("keeps a leaf's JS type: numbers stay numbers, decimal strings stay strings", () => {
    expect(leafOf(5, "k")).toEqual({ kind: "integer" });
    expect(leafOf("0.63", "k")).toEqual({ kind: "decimal" });
    expect(leafOf("09:00", "k")).toEqual({ kind: "time" });
    expect(leafOf("hire_of_work", "tax.nature_by_product_type")).toMatchObject({ kind: "enum" });
    expect(parseLeaf("12", { kind: "integer" })).toBe(12);
    expect(parseLeaf("12.5", { kind: "integer" })).toBeUndefined();
    expect(parseLeaf("20000", { kind: "decimal", money: true })).toBe("20000.00");
    expect(parseLeaf("1.25", { kind: "decimal" })).toBe("1.25");
  });

  it("replaces one value deep in a structure without touching the rest", () => {
    const value = { pp30: { dayOfNextMonth: 15 }, pnd3: { dayOfNextMonth: 7 } };
    expect(setAt(value, ["pp30", "dayOfNextMonth"], 20)).toEqual({
      pp30: { dayOfNextMonth: 20 },
      pnd3: { dayOfNextMonth: 7 },
    });
    expect(value.pp30.dayOfNextMonth).toBe(15);
    expect(setAt([1, 2], [1], 3)).toEqual([1, 3]);
  });

  it("puts every key in an area", () => {
    expect(areaOf("tax.calendar")).toBe("accounting");
    expect(areaOf("entity.tax_id")).toBe("entity");
    expect(areaOf("nobody.knows")).toBe("other");
  });

  it("reads rates and spans named by a figure as no unit", () => {
    expect(unitOf("dielines.downloads_per_day")).toBeNull();
    expect(unitOf("assistant.messages_per_minute")).toBeNull();
    expect(unitOf("up_to_30_days")).toBeNull();
    expect(unitOf("over_90_days")).toBeNull();
    expect(unitOf("claims.window_days")).toBe("days");
  });

  it("says a code's words only where the setting has that choice", () => {
    expect(isChoice("tax.rounding_mode", "document")).toBe(true);
    expect(isChoice("studio.print_rules", "document")).toBe(false);
    expect(isChoice("storefront.roadmap", "live")).toBe(true);
  });

  it("reads lists of records and structures in structures full width", () => {
    expect(wideValue([{ tier: "member", multiplier: "1" }])).toBe(true);
    expect(wideValue({ default: { min: 3, max: 5 } })).toBe(false);
    expect(wideValue({ factors: { storage: { up_to_10_days: "0.63" } } })).toBe(true);
    expect(wideValue({ dayOfNextMonth: 15 })).toBe(false);
    expect(wideValue([15, 30, 45])).toBe(false);
  });
});

describe("plainDescription", () => {
  it("drops decision refs and design-document pointers, keeps the words", () => {
    expect(
      plainDescription("Withheld on hire-of-work lines (accounting-design §2 ⚖ design default 3 %, pending CPA) D-201"),
    ).toBe("Withheld on hire-of-work lines (design default 3 %, pending CPA)");
    expect(plainDescription("Output VAT on sales (accounting-design.md §2)")).toBe("Output VAT on sales");
  });
});
