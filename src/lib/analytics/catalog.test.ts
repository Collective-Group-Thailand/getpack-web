import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { trackCatalog } from "./catalog";
import { trackCatalog as fromBarrel } from "./index";

type Window = { dataLayer?: unknown[] };
const layer = () => (window as unknown as Window).dataLayer!;
const consent = (value: string | null) => {
  document.cookie = value ? `pk_consent=${value}; path=/` : "pk_consent=; path=/; max-age=0";
};

beforeEach(() => {
  (window as unknown as Window).dataLayer = [];
});
afterEach(() => consent(null));

describe("trackCatalog", () => {
  it("is the same function from the analytics barrel, so other packs import it", () => {
    expect(fromBarrel).toBe(trackCatalog);
  });

  it("pushes each typed event to the dataLayer once analytics is accepted", () => {
    consent("a1m0");
    trackCatalog("catalog_search", { query: "ถุง", mode: "word", result_count: 12 });
    trackCatalog("catalog_filter", { facet: "useCase", value: "gift", action: "add", result_count: 39 });
    trackCatalog("catalog_quickview", { style_code: "PK-A-1", position: 3, source: "grid" });
    trackCatalog("catalog_cta", { style_code: "PK-A-1", cta: "design" });
    trackCatalog("catalog_compare", { style_codes: ["PK-A-1", "PK-A-2"] });
    expect(layer()).toEqual([
      { event: "catalog_search", query: "ถุง", mode: "word", result_count: 12 },
      { event: "catalog_filter", facet: "useCase", value: "gift", action: "add", result_count: 39 },
      { event: "catalog_quickview", style_code: "PK-A-1", position: 3, source: "grid" },
      { event: "catalog_cta", style_code: "PK-A-1", cta: "design" },
      { event: "catalog_compare", style_codes: ["PK-A-1", "PK-A-2"] },
    ]);
  });

  it("sends a search that found nothing, with result_count 0", () => {
    consent("a1m1");
    trackCatalog("catalog_search", { query: "xyz", mode: "word", result_count: 0 });
    expect(layer()).toEqual([{ event: "catalog_search", query: "xyz", mode: "word", result_count: 0 }]);
  });

  it("sends nothing before the visitor has answered or after analytics was refused", () => {
    trackCatalog("catalog_cta", { style_code: "PK-A-1", cta: "quote" });
    consent("a0m1");
    trackCatalog("catalog_cta", { style_code: "PK-A-1", cta: "quote" });
    expect(layer()).toEqual([]);
  });

  it("never throws without GTM on the page", () => {
    consent("a1m1");
    delete (window as unknown as Window).dataLayer;
    expect(() => trackCatalog("catalog_compare", { style_codes: [] })).not.toThrow();
  });
});
