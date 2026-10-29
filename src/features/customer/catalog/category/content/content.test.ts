import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en/customer/catalog.json";
import th from "@/i18n/messages/th/customer/catalog.json";

import { CATEGORY_CONTENT } from "./entries";
import { contentFor } from "./index";
import type { CategoryContent } from "./schema";

const ok = { status: "approved" as const, reviewedBy: "Marketing", reviewedOn: "2026-11-01" };

describe("category content (only approved renders)", () => {
  it("has an entry for each of the 14 categories: approved intro + FAQ (C12) and the owner's three style mappings (C2b)", () => {
    expect(CATEGORY_CONTENT).toHaveLength(14);
    const mapped: Record<string, string> = { flexible_pouch: "flexible", rigid_box: "rigid", label_sticker: "label" };
    for (const entry of CATEGORY_CONTENT) {
      const content = contentFor(entry.categoryCode);
      const style = mapped[entry.categoryCode];
      expect(content.styles?.styleCategory).toBe(style);
      expect(content.intro?.status).toBe("approved");
      if (entry.categoryCode !== "service") expect(content.faq?.keys.length).toBeGreaterThanOrEqual(2);
      // Nothing without approved data: use cases, per-product words, finder overrides, material guides.
      expect(content.useCases).toBeUndefined();
      expect(content.products).toBeUndefined();
      expect(content.sizeFinder).toBeUndefined();
      expect(content.guide).toBeUndefined();
    }
  });

  it("has the words of every approved intro and FAQ in both locales, with no claim the data does not back", () => {
    for (const messages of [th, en]) {
      const words = messages.categoryContent as Record<
        string,
        { intro?: string; faq?: Record<string, { q: string; a: string }> }
      >;
      for (const entry of CATEGORY_CONTENT) {
        const own = words[entry.categoryCode];
        expect(own?.intro, entry.categoryCode).toBeTruthy();
        for (const key of entry.faq?.keys ?? []) {
          expect(own?.faq?.[key]?.q, `${entry.categoryCode}.${key}`).toBeTruthy();
          expect(own?.faq?.[key]?.a, `${entry.categoryCode}.${key}`).toBeTruthy();
        }
      }
      expect(JSON.stringify(words)).not.toMatch(
        /DRAFT|โรงงาน|factory|ที่สุด|best|cheapest|ส่งฟรี|free shipping|ISO|FSC|ลูกค้ากว่า|\d+\s*%|ด้านละ/i,
      );
    }
  });

  it("keeps approved entries with a reviewer and drops drafts and unsigned approvals", () => {
    const fixture: CategoryContent[] = [
      {
        categoryCode: "fixture",
        intro: ok,
        faq: { status: "draft", keys: ["a"] },
        useCases: { status: "approved", items: [] },
        products: { a: { ...ok, short: true }, b: { status: "draft", short: true } },
      },
    ];
    const content = contentFor("fixture", fixture);
    expect(content.intro).toEqual(ok);
    expect(content.faq).toBeUndefined();
    expect(content.useCases).toBeUndefined();
    expect(Object.keys(content.products ?? {})).toEqual(["a"]);
  });

  it("answers an unknown category with no content", () => {
    expect(contentFor("nope")).toEqual({ categoryCode: "nope" });
  });
});
