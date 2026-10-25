import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  clearFilters,
  emptyParams,
  isFiltered,
  listHref,
  readParams,
  toggleValue,
  toQuery,
  toSearch,
} from "./query";

describe("the style library's URL state (styles redesign)", () => {
  it("reads the short names, comma lists and the quick view's style", () => {
    const params = readParams({
      cat: "rigid",
      use: "gift,cosmetics,gift",
      close: ["tuck_bottom:crash_lock", "closure_rigid:magnet"],
      price: "instant",
      sort: "new",
      style: "pk-rg-03",
      q: "  กล่องเค้ก ",
    });
    expect(params).toEqual({
      ...emptyParams(),
      category: "rigid",
      useCase: ["gift", "cosmetics"],
      closure: ["tuck_bottom:crash_lock", "closure_rigid:magnet"],
      pricePath: "instant",
      sort: "new",
      style: "PK-RG-03",
      q: "กล่องเค้ก",
    });
  });

  it("still reads links shared before the redesign (long names)", () => {
    const params = readParams({ category: "corrugated", useCase: "shipping", pricePath: "rfq" });
    expect(params.category).toBe("corrugated");
    expect(params.useCase).toEqual(["shipping"]);
    expect(params.pricePath).toBe("rfq");
    expect(toSearch(params)).toBe("cat=corrugated&use=shipping&price=rfq");
  });

  it("drops what it does not understand", () => {
    const params = readParams({ sort: "cheapest", price: "free", style: "nope", use: "a b,<x>", mat: "" });
    expect(params).toEqual(emptyParams());
  });

  it("writes defaults nowhere and sorts list values, so one view has one URL", () => {
    const params = readParams({ use: "snack,bakery", sort: "popular" });
    expect(listHref(params)).toBe("/styles?use=bakery,snack");
    expect(listHref(readParams({ q: "box", sort: "relevance" }))).toBe("/styles?q=box");
    expect(listHref(emptyParams())).toBe("/styles");
    expect(toSearch(readParams({ close: "window:front_window" }))).toBe("close=window:front_window");
  });

  it("round-trips through the URL", () => {
    const params = readParams({
      cat: "folding_carton",
      feat: "window:front_window",
      fam: "tuck_end",
      style: "PK-TE-01",
    });
    expect(readParams(Object.fromEntries(new URLSearchParams(toSearch(params))))).toEqual(params);
  });

  it("asks the API for one value per facet until multi-value facets ship", () => {
    const params = readParams({ use: "gift,snack", mat: "paperboard", price: "instant", q: "x", sort: "name" });
    expect(toQuery(params, 24)).toEqual({
      limit: 24,
      pricePath: "instant",
      useCase: "gift",
      materialClass: "paperboard",
      q: "x",
      sort: "name",
    });
  });

  it("toggles a value: replacing the facet's other value while the API takes one", () => {
    const params = readParams({ use: "gift" });
    expect(toggleValue(params, "useCase", "snack").useCase).toEqual(["snack"]);
    expect(toggleValue(params, "useCase", "gift").useCase).toEqual([]);
  });

  it("counts and clears filters, keeping the search and the order", () => {
    const params = readParams({ cat: "rigid", use: "gift", price: "instant", q: "x", sort: "new" });
    expect(activeFilterCount(params)).toBe(2);
    expect(isFiltered(params)).toBe(true);
    expect(clearFilters(params)).toEqual({ ...emptyParams(), q: "x", sort: "new" });
    expect(isFiltered(readParams({ cat: "rigid", style: "PK-RG-01" }))).toBe(false);
  });
});
