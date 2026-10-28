import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackProducts as fromBarrel } from "./index";
import { trackProducts } from "./products";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackProducts (products redesign item 15)", () => {
  it("is the same function from the analytics barrel", () => {
    expect(fromBarrel).toBe(trackProducts);
  });

  it("pushes the typed events once analytics is accepted", () => {
    consent("a1m0");
    trackProducts("products_calc_change", { product: "mailer-box", qty: 300, print: "cmyk" });
    trackProducts("products_rfq_submit", { count: 3 });
    expect(layer()).toEqual([
      { event: "products_calc_change", product: "mailer-box", qty: 300, print: "cmyk" },
      { event: "products_rfq_submit", count: 3 },
    ]);
  });

  it("sends nothing without consent", () => {
    consent("a0m0");
    trackProducts("products_tab", { mode: "instant" });
    expect(layer()).toEqual([]);
  });
});
