import { describe, expect, it } from "vitest";

import { matchFaqs, mightBeOrderCode, orderCodeOf } from "./match";

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

describe("matchFaqs", () => {
  it("matches the question in the page's language and links to its group", () => {
    expect(matchFaqs(groups, "ขั้นต่ำ", "th")).toEqual([
      { question: "สั่งขั้นต่ำกี่ชิ้น", answer: "ขึ้นอยู่กับสินค้า", href: "/faq#ordering" },
    ]);
    expect(matchFaqs(groups, "MINIMUM", "en")[0]?.question).toBe("What is the minimum order?");
  });

  it("falls back to Thai where there is no English, and ignores one letter", () => {
    expect(matchFaqs(groups, "ผลิต", "en")[0]?.question).toBe("ผลิตกี่วัน");
    expect(matchFaqs(groups, "ส", "th")).toEqual([]);
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
