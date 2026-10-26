import { describe, expect, it } from "vitest";

import type { PriceStep } from "./pricing";
import { mergeEqualTiers } from "./tiers";

const step = (quantity: number, unitPrice: string | null, instant = true) =>
  ({ quantity, unitPrice, instant, grossAmount: "0.00" }) as unknown as PriceStep;

describe("mergeEqualTiers", () => {
  it("joins consecutive quantities with the same per-piece string (100–500 ฿17.26, 1,000 ฿14.96)", () => {
    const groups = mergeEqualTiers([step(100, "17.26"), step(300, "17.26"), step(500, "17.26"), step(1000, "14.96")]);
    expect(groups.map((g) => [g.first.quantity, g.last.quantity, g.first.unitPrice])).toEqual([
      [100, 500, "17.26"],
      [1000, 1000, "14.96"],
    ]);
  });

  it("compares the strings as they are: 17.26 and 17.260 are two prices, and equal prices apart are two rows", () => {
    expect(mergeEqualTiers([step(100, "17.26"), step(300, "17.260")])).toHaveLength(2);
    expect(mergeEqualTiers([step(100, "10.00"), step(300, "9.00"), step(500, "10.00")])).toHaveLength(3);
  });

  it("never merges a quantity without an instant price", () => {
    expect(mergeEqualTiers([step(100, null, false), step(300, null, false)])).toHaveLength(2);
  });
});
