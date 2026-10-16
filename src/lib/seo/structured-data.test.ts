import { describe, expect, it } from "vitest";

import { breadcrumbSchema, faqPageSchema, jsonLdText, productSchema } from "./structured-data";

describe("page structured data", () => {
  it("claims an offer only when the API gave a price", () => {
    const base = { name: "กล่องไปรษณีย์", url: "https://getpack.example/products/mailer-box", images: [] };
    expect(productSchema(base)).not.toHaveProperty("offers");
    expect(productSchema({ ...base, lowPrice: "4.20" }).offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "4.20",
      priceCurrency: "THB",
    });
    expect(JSON.stringify(productSchema(base))).not.toMatch(/rating|review/i);
  });

  it("numbers breadcrumbs from one and leaves the page's own crumb without a link", () => {
    const list = breadcrumbSchema([{ name: "หน้าแรก", url: "https://getpack.example/" }, { name: "สินค้า" }]);
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "หน้าแรก", item: "https://getpack.example/" },
      { "@type": "ListItem", position: 2, name: "สินค้า" },
    ]);
  });

  it("marks up questions and answers", () => {
    expect(faqPageSchema([{ question: "สั่งขั้นต่ำกี่ชิ้น", answer: "ขึ้นอยู่กับสินค้า" }]).mainEntity[0]).toEqual({
      "@type": "Question",
      name: "สั่งขั้นต่ำกี่ชิ้น",
      acceptedAnswer: { "@type": "Answer", text: "ขึ้นอยู่กับสินค้า" },
    });
  });

  it("cannot be closed early by content that contains </script>", () => {
    const text = jsonLdText({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
