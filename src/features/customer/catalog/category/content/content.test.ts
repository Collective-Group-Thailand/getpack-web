import { describe, expect, it } from "vitest";

import { CATEGORY_CONTENT } from "./entries";
import { contentFor } from "./index";
import type { CategoryContent } from "./schema";

const ok = { status: "approved" as const, reviewedBy: "Marketing", reviewedOn: "2026-11-01" };

describe("category content (only approved renders)", () => {
  it("has an entry for each of the 14 categories, none approved yet", () => {
    expect(CATEGORY_CONTENT).toHaveLength(14);
    for (const entry of CATEGORY_CONTENT) {
      expect(contentFor(entry.categoryCode)).toEqual({ categoryCode: entry.categoryCode });
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
