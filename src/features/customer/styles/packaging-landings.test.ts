import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en/customer/styles.json";
import th from "@/i18n/messages/th/customer/styles.json";

import { isLandingPublished, landingCopyStatus, PACKAGING_LANDINGS } from "./packaging-landings";

type Copy = { status: string; intro: string; faq: { question: string; answer: string }[] };
const pages = (messages: { packagingPages: unknown }) => messages.packagingPages as Record<string, Copy>;

/** C0b (DECISIONS-STAGE-A §9.4b): draft copy for every landing, waiting for the owner. */
describe("packaging landing copy", () => {
  it("has a draft intro and 4–6 FAQs for every page in both locales, unpublished until approved", () => {
    for (const { slug } of PACKAGING_LANDINGS) {
      for (const messages of [th, en]) {
        const copy = pages(messages)[slug]!;
        expect(copy.status).toBe("draft");
        expect(copy.faq.length).toBeGreaterThanOrEqual(4);
        expect(copy.faq.length).toBeLessThanOrEqual(6);
      }
      expect(landingCopyStatus(slug)).toBe("draft");
      expect(isLandingPublished(slug)).toBe(false);
      // 300–600 words (English counts words; Thai is checked by length, it has no spaces between words).
      const words = pages(en)[slug]!.intro.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(300);
      expect(words).toBeLessThanOrEqual(600);
    }
  });

  it("claims nothing the data does not back (GLOBAL-RULES §1, §3)", () => {
    const text = JSON.stringify([pages(th), pages(en)]);
    expect(text).not.toMatch(
      /โรงงาน|factory|factories|ที่สุด|best|cheapest|ถูกที่สุด|ราคาประมาณ|ISO|FSC|ลูกค้ากว่า|\d+\s*%/i,
    );
  });
});
