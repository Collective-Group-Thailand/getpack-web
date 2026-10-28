import { describe, expect, it } from "vitest";

import { DEFAULT_PARAMS, hubHref, hubSearch, isFilteredHub, readHubParams } from "./query";

describe("the hub's URL state (mode, cat, q, sort, view, page)", () => {
  it("reads every parameter and leaves garbage at its default", () => {
    expect(
      readHubParams({ mode: "stock", cat: "label-sticker", q: " ขวด ", sort: "moq", view: "table", page: "3" }),
    ).toEqual({ mode: "stock", cat: "label_sticker", q: "ขวด", sort: "moq", view: "table", page: 3 });
    expect(readHubParams({ mode: "free", cat: "../x", sort: "cheap", view: "list", page: "-2" })).toEqual(
      DEFAULT_PARAMS,
    );
    expect(readHubParams({ mode: ["instant", "quote"], page: "9999" })).toMatchObject({ mode: "instant", page: 50 });
  });

  it("writes defaults nowhere: the untouched page is /products", () => {
    expect(hubSearch(DEFAULT_PARAMS)).toBe("");
    expect(hubHref("/products", DEFAULT_PARAMS)).toBe("/products");
  });

  it("round-trips through the URL", () => {
    const params = readHubParams({
      mode: "quote",
      cat: "folding-carton",
      q: "กล่อง",
      sort: "price",
      view: "table",
      page: "2",
    });
    expect(readHubParams(Object.fromEntries(new URLSearchParams(hubSearch(params))))).toEqual(params);
  });

  it("a new list goes back to the first batch; the view toggle keeps it", () => {
    const params = { ...DEFAULT_PARAMS, page: 3 };
    expect(hubHref("/products", params, { sort: "price" })).toBe("/products?sort=price");
    expect(hubHref("/products", params, { view: "table" })).toBe("/products?view=table&page=3");
    expect(hubHref("/products", params, { page: 4 })).toBe("/products?page=4");
  });

  it("changing the mode drops the category the new mode may not have", () => {
    const params = { ...DEFAULT_PARAMS, mode: "quote" as const, cat: "label" };
    expect(hubHref("/products", params, { mode: "stock" })).toBe("/products?mode=stock");
    expect(hubHref("/products", params, { mode: "stock", cat: "standard_product" })).toBe(
      "/products?mode=stock&cat=standard-product",
    );
  });

  it("knows a filtered view from the page itself", () => {
    expect(isFilteredHub(DEFAULT_PARAMS)).toBe(false);
    expect(isFilteredHub({ ...DEFAULT_PARAMS, q: "x" })).toBe(true);
    expect(isFilteredHub({ ...DEFAULT_PARAMS, page: 2 })).toBe(true);
  });
});
