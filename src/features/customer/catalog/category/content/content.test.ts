import { describe, expect, it } from "vitest";

import { CATEGORY_CONTENT } from "./entries";
import { contentFor } from "./index";
import type { CategoryContent } from "./schema";

const ok = { status: "approved" as const, reviewedBy: "Marketing", reviewedOn: "2026-11-01" };

describe("category content (only approved renders)", () => {
  it("has an entry for each of the 14 categories; only the owner's three style mappings are approved (C2b)", () => {
    expect(CATEGORY_CONTENT).toHaveLength(14);
    const mapped: Record<string, string> = { flexible_pouch: "flexible", rigid_box: "rigid", label_sticker: "label" };
    for (const entry of CATEGORY_CONTENT) {
      const content = contentFor(entry.categoryCode);
      const style = mapped[entry.categoryCode];
      if (style) {
        expect(content.styles?.styleCategory).toBe(style);
        expect(Object.keys(content).sort()).toEqual(["categoryCode", "styles"]);
      } else {
        expect(content).toEqual({ categoryCode: entry.categoryCode });
      }
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
