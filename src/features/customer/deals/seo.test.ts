import { describe, expect, it } from "vitest";

import { fixtureDeal } from "../../../../mocks/store/deals-fixtures";

import { dealOfferSchema, dealsListSchema } from "./seo";

describe("deal structured data (PLAN §3.5.3)", () => {
  const deal = {
    ...fixtureDeal("box10-corrugated"),
    shareUrl: "https://getpack.co/deals/box10-corrugated?ref=AGT12345",
  };

  it("is an Offer with the deal's own words, dates and canonical URL — no price, no rating", () => {
    const data = dealOfferSchema(deal, "https://getpack.co", "th", { corrugated: "กล่องกระดาษลูกฟูก" });
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "Offer",
      name: "กล่องลูกฟูก 1,000 ใบขึ้นไป ลด 10%",
      description: "ลด 10% สูงสุด ฿1,500 · เฉพาะกล่องลูกฟูกฝาชน",
      url: "https://getpack.co/deals/box10-corrugated",
      validFrom: deal.startsAt,
      validThrough: deal.endsAt,
      category: "กล่องกระดาษลูกฟูก",
      offeredBy: { "@type": "Organization", name: "getpack", legalName: expect.any(String) },
    });
    expect(JSON.stringify(data)).not.toMatch(/price|rating|review|ref=/i);
  });

  it("drops validThrough for a deal without an end, and the category for unknown types", () => {
    const data = dealOfferSchema({ ...deal, endsAt: null }, "https://getpack.co", "en", {});
    expect(data).not.toHaveProperty("validThrough");
    expect(data).not.toHaveProperty("category");
    expect(data.url).toBe("https://getpack.co/en/deals/box10-corrugated");
  });

  it("lists /deals as an ItemList in the order shown", () => {
    const list = dealsListSchema([deal, fixtureDeal("label8-5000")], "https://getpack.co", "th", "ดีลและโปรโมชัน");
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement.map((item) => [item.position, item.url])).toEqual([
      [1, "https://getpack.co/deals/box10-corrugated"],
      [2, "https://getpack.co/deals/label8-5000"],
    ]);
  });
});
