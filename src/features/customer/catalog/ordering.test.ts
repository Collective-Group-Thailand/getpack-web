import { describe, expect, it } from "vitest";

import { categoryGroup, compareDecimal, orderCards, orderCategories, readFilters, readSort } from "./ordering";

const type = (quoteMode: "instant" | "rfq") => ({ quoteMode }) as never;

describe("catalogue ordering (UX audit, /products)", () => {
  it("puts instant-price categories first, quotation next and services last, keeping admin order within", () => {
    const tree = [
      { code: "design-service", types: [type("rfq")] },
      { code: "rigid-box", types: [type("rfq")] },
      { code: "corrugated", types: [type("instant")] },
      { code: "paper-bag", types: [type("rfq")] },
      { code: "standard-product", types: [type("instant")] },
    ];
    expect(orderCategories(tree).map((c) => c.code)).toEqual([
      "corrugated",
      "standard-product",
      "rigid-box",
      "paper-bag",
      "design-service",
    ]);
    expect(categoryGroup(tree[0]!)).toBe("service");
  });

  it("compares money as written, without turning it into a number", () => {
    expect(compareDecimal("14.13", "15.7")).toBeLessThan(0);
    expect(compareDecimal("198.92", "33.83")).toBeGreaterThan(0);
    expect(compareDecimal("12.50", "12.5")).toBe(0);
    expect(compareDecimal("0.95", "1")).toBeLessThan(0);
  });

  it("reads only known chips and sorts from the URL", () => {
    expect(readFilters("instant,bogus,fast")).toEqual(["instant", "fast"]);
    expect(readSort("price")).toBe("price");
    expect(readSort("cheapest")).toBe("recommended");
  });
});

describe("cards of a page (customer walkthrough 2026-10-16)", () => {
  it("puts instant-price cards first, quotation cards next, services last, keeping the API's order within a group", () => {
    const cards = [
      { slug: "plates", availability: "rfq", productTypeCode: "service" },
      { slug: "serum", availability: "rfq", productTypeCode: "folding_carton" },
      { slug: "postal", availability: "instant", productTypeCode: "corrugated" },
      { slug: "mockup", availability: "rfq", productTypeCode: "service" },
      { slug: "mailer", availability: "partial", productTypeCode: "corrugated" },
    ] as const;
    expect(orderCards(cards).map((card) => card.slug)).toEqual(["postal", "mailer", "serum", "plates", "mockup"]);
  });
});
