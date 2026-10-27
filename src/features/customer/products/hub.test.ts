import { describe, expect, it } from "vitest";

import {
  catalogMode,
  categoriesIn,
  filterItems,
  instantLeadBand,
  modeCounts,
  modeSummary,
  sortItems,
  visibleBatch,
  type HubItem,
} from "./hub";

let order = 0;
const item = (over: Partial<HubItem>): HubItem => ({
  kind: "catalog",
  key: `k${order}`,
  nameTh: "สินค้า",
  nameEn: "Product",
  mode: "quote",
  categoryCode: "corrugated",
  productTypeCode: "corrugated_box",
  imageUrl: null,
  imageAlt: null,
  startingPrice: null,
  priceQuantity: null,
  specLabel: null,
  moq: null,
  unit: null,
  leadTime: null,
  inStock: null,
  order: order++,
  ...over,
});

describe("the /products hub list (products redesign item 5)", () => {
  it("derives the mode: service category, instant (and partial) price, else made to spec", () => {
    expect(catalogMode({ availability: "instant" }, "service")).toBe("service");
    expect(catalogMode({ availability: "rfq" }, "graphic_service")).toBe("service");
    expect(catalogMode({ availability: "instant" }, "corrugated")).toBe("instant");
    expect(catalogMode({ availability: "partial" }, "corrugated")).toBe("instant");
    expect(catalogMode({ availability: "rfq" }, "folding_carton")).toBe("quote");
  });

  it("filters by mode and category, counts each mode over every item", () => {
    const items = [
      item({ mode: "instant" }),
      item({ mode: "quote", categoryCode: "label" }),
      item({ mode: "stock", kind: "stock", categoryCode: "standard_product" }),
      item({ mode: "service", categoryCode: "service" }),
    ];
    expect(filterItems(items, { mode: "quote" })).toHaveLength(1);
    expect(filterItems(items, { cat: "corrugated" })).toHaveLength(1);
    expect(filterItems(items, {})).toHaveLength(4);
    expect(modeCounts(items)).toEqual({ all: 4, instant: 1, quote: 1, stock: 1, service: 1 });
  });

  it("recommended order: instant, made to spec, stock, services last — the API order inside each", () => {
    const service = item({ mode: "service" });
    const quote = item({ mode: "quote" });
    const instant = item({ mode: "instant" });
    const stock = item({ mode: "stock" });
    expect(sortItems([service, quote, instant, stock], "recommended").map((i) => i.mode)).toEqual([
      "instant",
      "quote",
      "stock",
      "service",
    ]);
  });

  it("sorts by price as decimals (not as text), MOQ and lead time, with missing figures last", () => {
    const a = item({ mode: "instant", startingPrice: "123.06", moq: 500, leadTime: { min: 5, max: 10 } });
    const b = item({ mode: "instant", startingPrice: "15.70", moq: 100, leadTime: { min: 5, max: 5 } });
    const c = item({ mode: "quote", startingPrice: null, moq: null, leadTime: null });
    expect(sortItems([a, c, b], "price").map((i) => i.startingPrice)).toEqual(["15.70", "123.06", null]);
    expect(sortItems([c, a, b], "moq").map((i) => i.moq)).toEqual([100, 500, null]);
    expect(sortItems([c, a, b], "lead").map((i) => i.leadTime?.max ?? null)).toEqual([5, 10, null]);
  });

  it("pages in batches of 15 over the whole list", () => {
    const many = Array.from({ length: 40 }, () => item({}));
    expect(visibleBatch(many, 1)).toHaveLength(15);
    expect(visibleBatch(many, 2)).toHaveLength(30);
    expect(visibleBatch(many, 3)).toHaveLength(40);
    expect(visibleBatch(many, 0)).toHaveLength(15);
  });

  it("lists only the categories present, in the tree's order, unknown ones after", () => {
    const items = [
      item({ categoryCode: "label" }),
      item({ categoryCode: "zeta" }),
      item({ categoryCode: "corrugated" }),
    ];
    expect(categoriesIn(items, ["corrugated", "folding_carton", "label"])).toEqual(["corrugated", "label", "zeta"]);
  });

  it("mode card lines come from the data only: cheapest instant price + its MOQ, quote MOQ range, stock minimum", () => {
    const items = [
      item({ mode: "instant", startingPrice: "198.92", moq: 100, unit: "piece" }),
      item({ mode: "instant", startingPrice: "15.70", moq: 300, unit: "piece" }),
      item({ mode: "quote", moq: 3000 }),
      item({ mode: "quote", moq: 300 }),
      item({ mode: "quote", moq: null }),
      item({ mode: "stock", moq: 1 }),
      item({ mode: "stock", moq: 2000 }),
    ];
    expect(modeSummary(items)).toEqual({
      instant: { price: "15.70", unit: "piece", moq: 300 },
      quote: { min: 300, max: 3000 },
      stock: { min: 1 },
    });
    expect(modeSummary([])).toEqual({ instant: null, quote: null, stock: null });
  });

  it("the production band of instant items, for the process step's tag", () => {
    expect(
      instantLeadBand([
        item({ mode: "instant", leadTime: { min: 5, max: 5 } }),
        item({ mode: "instant", leadTime: { min: 7, max: 10 } }),
        item({ mode: "quote", leadTime: { min: 1, max: 30 } }),
      ]),
    ).toEqual({ min: 5, max: 10 });
    expect(instantLeadBand([item({ mode: "quote" })])).toBeNull();
  });
});
