import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { faqAnswer } from "./content";
import { lineTrayItem, pendingItems } from "./quote-tray";

/** C1b (D-447 / DECISIONS-STAGE-A §10.9): signed in, the quote tray is the draft basket's waiting lines. */
describe("the signed-in quote tray", () => {
  const line = (over: Partial<Schemas["RfqBasketItemDto"]>): Schemas["RfqBasketItemDto"] => ({
    id: "line-1",
    sort: 0,
    productType: { id: "t", code: "standard_product", nameTh: "สินค้าสต็อก", nameEn: "Stock product" },
    specification: { productTypeCode: "standard_product", stockProductSku: "PKO-BTL-0250" },
    design: null,
    formPending: true,
    categoryCode: "standard_product",
    product: { kind: "stock_product", key: "PKO-BTL-0250", nameTh: "ขวด", nameEn: "Bottle" },
    rfq: null,
    ...over,
  });

  it("reads a waiting line as a tray item with its product, type, category and line id", () => {
    expect(lineTrayItem(line({}))).toEqual({
      kind: "stock",
      key: "PKO-BTL-0250",
      productTypeCode: "standard_product",
      categoryCode: "standard_product",
      nameTh: "ขวด",
      nameEn: "Bottle",
      lineId: "line-1",
    });
  });

  it("leaves out filled lines and lines without a product", () => {
    const basket = {
      items: [line({}), line({ id: "line-2", formPending: false }), line({ id: "line-3", product: null })],
    } as Schemas["RfqBasketDto"];
    expect(pendingItems(basket).map((item) => item.lineId)).toEqual(["line-1"]);
    expect(pendingItems(null)).toEqual([]);
  });
});

/** D-447 §10.8: the tax-invoice answer names the company from its settings, never from copy. */
describe("the FAQ's tax-invoice answer", () => {
  const t = (key: string, values?: Record<string, string>) => `${key}${values ? JSON.stringify(values) : ""}`;
  it("names the issuing company when settings give one, and says it without a name otherwise", () => {
    expect(faqAnswer(t, "taxInvoice", "บริษัท ทดสอบ จำกัด")).toBe('items.taxInvoice.a{"company":"บริษัท ทดสอบ จำกัด"}');
    expect(faqAnswer(t, "taxInvoice", null)).toBe("items.taxInvoice.aNoName");
    expect(faqAnswer(t, "vat", "x")).toBe("items.vat.a");
  });
});
