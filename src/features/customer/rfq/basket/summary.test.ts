import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { itemFacts } from "./summary";

const item = (specification: Record<string, unknown>): Schemas["RfqBasketItemDto"] => ({
  id: "i1",
  sort: 0,
  productType: { id: "t", code: "paper_bag", nameTh: "ถุงกระดาษ", nameEn: "Paper bag" },
  specification,
  design: null,
  product: null,
  rfq: null,
});

describe("a basket item's facts (D-301)", () => {
  it("reads the size, the quantities and how many spec answers it carries", () => {
    expect(
      itemFacts(
        item({
          spec: { handle: "rope", paper: "kraft" },
          quantities: [500, 1000],
          lengthMm: 200,
          widthMm: 100,
          heightMm: 300,
        }),
      ),
    ).toEqual({ size: [200, 100, 300], quantities: [500, 1000], answers: 2 });
  });

  it("says nothing it was not given", () => {
    expect(itemFacts(item({ spec: {}, quantities: [] }))).toEqual({ size: null, quantities: [], answers: 0 });
    expect(itemFacts(item({ quantities: ["x", 300] }))).toEqual({ size: null, quantities: [300], answers: 0 });
  });
});
