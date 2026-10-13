import { describe, expect, it } from "vitest";

import enStore from "@/i18n/messages/en/customer/storefront.json";
import enErp from "@/i18n/messages/en/partner/erp.json";
import thStore from "@/i18n/messages/th/customer/storefront.json";
import thErp from "@/i18n/messages/th/partner/erp.json";

import { ERP_UNIT_VALUES } from "./units";

describe("ERP units (D-384)", () => {
  it("names every unit in both languages, in the factory app and on the customer's quotation link", () => {
    for (const units of [thErp.common.units, enErp.common.units, thStore.quoteLink.units, enStore.quoteLink.units])
      expect(ERP_UNIT_VALUES.filter((unit) => !(unit in units))).toEqual([]);
  });

  it("has the packaging and service units, and one unit for pieces", () => {
    expect(ERP_UNIT_VALUES).toEqual(expect.arrayContaining(["pouch", "tube", "job", "round", "trip", "pcs"]));
    expect(ERP_UNIT_VALUES).not.toContain("piece" as never);
  });
});
