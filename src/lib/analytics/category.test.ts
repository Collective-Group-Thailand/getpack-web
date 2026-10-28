import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackCategory } from "./category";
import { trackCategory as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackCategory (category redesign item 9)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackCategory);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackCategory("category_view_toggle", { category: "corrugated", view: "table" });
    trackCategory("category_size_find", {
      category: "corrugated",
      product: "mailer-box",
      dims: "250x180x80",
      result: "C",
    });
    trackCategory("category_size_cta", { category: "corrugated", product: "mailer-box", size: "C", cta: "order" });
    expect(layer()).toEqual([
      { event: "category_view_toggle", category: "corrugated", view: "table" },
      { event: "category_size_find", category: "corrugated", product: "mailer-box", dims: "250x180x80", result: "C" },
      { event: "category_size_cta", category: "corrugated", product: "mailer-box", size: "C", cta: "order" },
    ]);
  });

  it("sends nothing without consent", () => {
    consent("a0m0");
    trackCategory("category_guide_view", { category: "corrugated", kind: "flute" });
    expect(layer()).toEqual([]);
  });
});
