import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  clearFilters,
  emptyParams,
  isFiltered,
  listHref,
  MAX_PAGE,
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

  it("round-trips every parameter, in the contract's order, with defaults omitted", () => {
    const raw = {
      cat: "rigid",
      q: "box",
      size: "120x80x50",
      use: "gift,snack",
      mat: "paperboard",
      close: "tuck_bottom:crash_lock",
      feat: "window:front_window",
      fam: "tuck_end",
      eco: "plastic_free,recyclable",
      price: "instant",
      sort: "new",
      page: "3",
      style: "PK-RG-01",
    };
    const params = readParams(raw);
    expect(toSearch(params)).toBe(
      "cat=rigid&q=box&size=120x80x50&use=gift,snack&mat=paperboard&close=tuck_bottom:crash_lock&feat=window:front_window&fam=tuck_end&eco=plastic_free,recyclable&price=instant&sort=new&page=3&style=PK-RG-01",
    );
    expect(readParams(Object.fromEntries(new URLSearchParams(toSearch(params))))).toEqual(params);
    expect(toSearch(readParams({ page: "1", sort: "popular", view: "styles" }))).toBe("");
  });

  it("reads the size as LxWxH and nothing else", () => {
    expect(readParams({ size: "12.5X8x5" }).size).toBe("12.5x8x5");
    expect(readParams({ size: "12×8×5" }).size).toBe("12x8x5");
    for (const size of ["12x8", "axbxc", "0x1x1", "12x8x5x2", "-1x2x3", "99999x1x1", ""])
      expect(readParams({ size }).size).toBeUndefined();
  });

  it("clamps the page and ignores a garbled one", () => {
    expect(readParams({ page: "2" }).page).toBe(2);
    expect(readParams({ page: "999" }).page).toBe(MAX_PAGE);
    for (const page of ["1", "0", "-3", "x", "2.5", ""]) expect(readParams({ page }).page).toBeUndefined();
  });

  it("survives garbled and repeated parameters without throwing", () => {
    const params = readParams({
      cat: ["rigid", "label"],
      q: ["a", "b"],
      use: ["gift", "snack,bad value", "%%%"],
      eco: ",,,",
      size: ["1x1x1", "2x2x2"],
      unknown: "1",
    });
    expect(params.category).toBe("rigid");
    expect(params.q).toBe("a");
    expect(params.useCase).toEqual(["gift", "snack"]);
    expect(params.eco).toEqual([]);
    expect(params.size).toBe("1x1x1");
    expect(readParams({ q: "x".repeat(500) }).q).toHaveLength(120);
    expect(readParams({ use: Array.from({ length: 50 }, (_, i) => `v${i}`).join(",") }).useCase).toHaveLength(20);
  });

  it("starts from the first page whenever a filter, the search or the order changes", () => {
    const params = readParams({ use: "gift", page: "3" });
    expect(listHref(params)).toBe("/styles?use=gift");
    expect(listHref({ ...params, sort: "new" })).toBe("/styles?use=gift&sort=new");
    expect(listHref(params, { page: 3 })).toBe("/styles?use=gift&page=3");
  });

  it("keeps eco and size out of the API query and out of the filter count", () => {
    const params = readParams({ eco: "recyclable", size: "1x1x1" });
    expect(toQuery(params, 24)).toEqual({ limit: 24 });
    expect(activeFilterCount(params)).toBe(0);
    expect(isFiltered(params)).toBe(false);
  });
});
