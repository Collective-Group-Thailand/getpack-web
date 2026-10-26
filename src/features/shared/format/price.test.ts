// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { displayPrice, figuresOf, vatSwitchAvailable } from "./price";

const thb = (amount: string) => `฿${amount}`;
const labels = { incl: "รวม VAT", excl: "ไม่รวม VAT" };

describe("the shared price-display helper", () => {
  it("labels a VAT-inclusive API amount and returns the amount string untouched", () => {
    expect(displayPrice(figuresOf("4.85"), "incl", thb, labels)).toEqual({
      amount: "฿4.85",
      basis: "incl",
      vatLabel: "รวม VAT",
    });
  });

  it("labels an exclusive amount as exclusive and never converts it", () => {
    const shown = displayPrice(figuresOf("4.53", false), "incl", thb, labels);
    expect(shown).toEqual({ amount: "฿4.53", basis: "excl", vatLabel: "ไม่รวม VAT" });
  });

  it("follows the preference only when the API gave that figure", () => {
    const both = { incl: "4.85", excl: "4.53" };
    expect(displayPrice(both, "excl", thb, labels)?.amount).toBe("฿4.53");
    expect(displayPrice(both, "incl", thb, labels)?.amount).toBe("฿4.85");
    expect(displayPrice({ incl: "4.85" }, "excl", thb, labels)).toMatchObject({ amount: "฿4.85", basis: "incl" });
  });

  it("returns null without a figure", () => {
    expect(displayPrice({}, "incl", thb, labels)).toBeNull();
    expect(displayPrice(figuresOf(null), "incl", thb, labels)).toBeNull();
    expect(displayPrice(figuresOf(""), "incl", thb, labels)).toBeNull();
  });

  it("offers the switch only when every price has both figures", () => {
    expect(vatSwitchAvailable([])).toBe(false);
    expect(vatSwitchAvailable([figuresOf("4.85")])).toBe(false);
    expect(vatSwitchAvailable([{ incl: "4.85", excl: "4.53" }])).toBe(true);
    expect(vatSwitchAvailable([{ incl: "4.85", excl: "4.53" }, figuresOf("1.00")])).toBe(false);
  });

  it("does no arithmetic on money: no operators or numeric coercion in the source", () => {
    const source = readFileSync(new URL("./price.ts", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(source).not.toMatch(/Number\(|parseFloat|parseInt|Math\.|toFixed|Decimal|\*\s*\d|\/\s*\d/);
  });
});
