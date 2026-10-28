import { describe, expect, it } from "vitest";

import { formatTHB } from "@/i18n/format";

import { isFreeShipping, shippingAmountText } from "./shipping";

const thb = (amount: string) => formatTHB(amount, "th");

describe("free shipping (C2b, DECISIONS-STAGE-A §15.4)", () => {
  it('reads exactly "0.00" as free', () => {
    expect(isFreeShipping("0.00")).toBe(true);
    expect(shippingAmountText("0.00", thb, "ส่งฟรี")).toBe("ส่งฟรี");
  });

  it("formats any other amount, and never treats pending or unpriced shipping as free", () => {
    expect(shippingAmountText("120.00", thb, "ส่งฟรี")).toBe(thb("120.00"));
    for (const value of [null, undefined, "", "0", "0.0", "-0.00", "0.01"]) expect(isFreeShipping(value)).toBe(false);
  });
});
