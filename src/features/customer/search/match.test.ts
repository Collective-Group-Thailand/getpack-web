import { describe, expect, it } from "vitest";

import { faqHitsOf, mightBeOrderCode, orderCodeOf } from "./match";

const groups = [
  {
    categoryCode: "ordering",
    faqs: [
      {
        questionTh: "สั่งขั้นต่ำกี่ชิ้น",
        questionEn: "What is the minimum order?",
        answerTh: "ขึ้นอยู่กับสินค้า",
        answerEn: "It depends",
      },
      { questionTh: "ผลิตกี่วัน", questionEn: null, answerTh: "ดูในใบเสนอราคา", answerEn: null },
    ],
  },
];

describe("faqHitsOf", () => {
  const hits = [
    { kind: "catalog_product", key: "mailer-box", titleTh: "กล่องไปรษณีย์", titleEn: "Mailer box" },
    { kind: "faq", key: "f-1", titleTh: "สั่งขั้นต่ำกี่ชิ้น", titleEn: "What is the minimum order?" },
    { kind: "faq", key: "f-2", titleTh: "ส่งต่างประเทศไหม", titleEn: null },
  ];

  it("keeps the search's FAQ hits, with the answer and group the FAQ list has", () => {
    expect(faqHitsOf(hits, groups, "th")).toEqual([
      { key: "f-1", question: "สั่งขั้นต่ำกี่ชิ้น", answer: "ขึ้นอยู่กับสินค้า", href: "/faq#ordering" },
      { key: "f-2", question: "ส่งต่างประเทศไหม", answer: null, href: "/faq" },
    ]);
  });

  it("reads the page's language and falls back to Thai", () => {
    const [first, second] = faqHitsOf(hits, groups, "en");
    expect(first).toMatchObject({ question: "What is the minimum order?", answer: "It depends" });
    expect(second?.question).toBe("ส่งต่างประเทศไหม");
    expect(faqHitsOf(hits, groups, "th", 1)).toHaveLength(1);
  });
});

describe("order codes", () => {
  it("tries codes, not words", () => {
    expect(mightBeOrderCode("PK-2569-00042")).toBe(true);
    expect(mightBeOrderCode(" pk-2569-00042 ")).toBe(true);
    expect(mightBeOrderCode("กล่อง")).toBe(false);
    expect(mightBeOrderCode("mailer box")).toBe(false);
    expect(orderCodeOf(" pk-2569-00042 ")).toBe("PK-2569-00042");
  });
});
