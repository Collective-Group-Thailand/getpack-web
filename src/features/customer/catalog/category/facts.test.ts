import { describe, expect, it } from "vitest";

import type { HubItem } from "@/features/customer/products/hub";

import { buyModeOf, categoryFacts } from "./facts";

const item = (over: Partial<HubItem>): HubItem => ({
  kind: "catalog",
  key: "x",
  id: null,
  nameTh: "x",
  nameEn: "x",
  mode: "instant",
  categoryCode: "corrugated",
  productTypeCode: "corrugated",
  imageUrl: null,
  imageAlt: null,
  startingPrice: null,
  startingPriceExVat: null,
  priceQuantity: null,
  specLabel: null,
  moq: null,
  unit: null,
  leadTime: null,
  inStock: null,
  order: 0,
  ...over,
});

describe("categoryFacts (category Phase 1 item 1)", () => {
  it("takes the lowest instant price as written, with its ex-VAT figure and quantity", () => {
    const facts = categoryFacts([
      item({ key: "a", startingPrice: "33.83", startingPriceExVat: "31.62", priceQuantity: 300 }),
      item({ key: "b", startingPrice: "15.70", startingPriceExVat: "14.67", priceQuantity: 300 }),
      item({ key: "c", startingPrice: "198.92", startingPriceExVat: "185.91", priceQuantity: 300 }),
    ]);
    expect(facts.start).toEqual({ incl: "15.70", excl: "14.67", quantity: 300, unit: null });
  });

  it("ranges MOQ and the instant lead times; null-safe", () => {
    const facts = categoryFacts([
      item({ moq: 100, leadTime: { min: 5, max: 5 } }),
      item({ moq: 500, leadTime: { min: 5, max: 10 } }),
      item({ mode: "quote", moq: null, leadTime: { min: 20, max: 30 } }),
    ]);
    expect(facts.moq).toEqual({ min: 100, max: 500 });
    expect(facts.lead).toEqual({ min: 5, max: 10 });
    expect(categoryFacts([]).moq).toBeNull();
    expect(categoryFacts([]).start).toBeNull();
    expect(categoryFacts([]).lead).toBeNull();
  });

  it("says 'every item instant' only when it is so, and 'mixed' otherwise", () => {
    expect(buyModeOf([item({}), item({})])).toBe("instant");
    expect(buyModeOf([item({ mode: "quote" })])).toBe("quote");
    expect(buyModeOf([item({}), item({ mode: "quote" })])).toBe("mixed");
    expect(buyModeOf([])).toBeNull();
  });

  it("never takes a price from a quote item", () => {
    expect(categoryFacts([item({ mode: "quote", startingPrice: "1.00" })]).start).toBeNull();
  });
});
