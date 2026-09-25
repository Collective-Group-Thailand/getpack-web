import { describe, expect, it } from "vitest";

import { mergeIntoUrl, parseListState, serialiseListState, toApiQuery, updateListState, viewQuery } from "./list-state";

const parse = (query: string, defaults = {}) => parseListState(new URLSearchParams(query), defaults);

describe("list state in the URL", () => {
  it("reads pagination, sort, search, filters and hidden columns", () => {
    const state = parse("page=3&perPage=50&sort=total&order=asc&q=PK-2569&status=paid&hide=channel,factory");
    expect(state).toEqual({
      page: 3,
      perPage: 50,
      sort: "total",
      order: "asc",
      q: "PK-2569",
      filters: { status: "paid" },
      hidden: ["channel", "factory"],
    });
  });

  it("reads only the declared filters, leaving a page's own parameters alone", () => {
    // Regression: `/approvals?tab=all` sent `tab=all` to the API as a filter.
    const state = parse("tab=all&status=pending&panel=open", { filterKeys: ["status", "policy"] });
    expect(state.filters).toEqual({ status: "pending" });
  });

  it("falls back to the defaults, and to safe values for a hand-edited URL", () => {
    const state = parse("page=-2&perPage=5000&order=sideways", { perPage: 50, sort: "createdAt" });
    expect(state.page).toBe(1);
    expect(state.perPage).toBe(50);
    expect(state.order).toBe("desc");
    expect(state.sort).toBe("createdAt");
  });

  it("round-trips, and writes only what differs from the defaults", () => {
    const defaults = { sort: "createdAt", filters: { queue: "waiting_payment" } };
    const clean = parse("", defaults);
    expect(serialiseListState(clean, defaults).toString()).toBe("");

    const state = parse("q=somchai&status=paid&page=2", defaults);
    expect(parse(serialiseListState(state, defaults).toString(), defaults)).toEqual(state);
  });

  it("returns to page 1 whenever the matching rows change", () => {
    const state = parse("page=9");
    expect(updateListState(state, { q: "x" }).page).toBe(1);
    expect(updateListState(state, { filters: { status: "paid" } }).page).toBe(1);
    expect(updateListState(state, { sort: "total" }).page).toBe(1);
    expect(updateListState(state, { hidden: ["total"] }).page).toBe(9);
    expect(updateListState(state, { page: 10 }).page).toBe(10);
  });

  it("never sends presentation to the API", () => {
    const query = toApiQuery(parse("hide=total&status=paid&sort=code"));
    expect(query).toEqual({ page: 1, perPage: 25, sort: "code", order: "desc", status: "paid" });
    expect(query).not.toHaveProperty("hide");
  });

  it("saves a view without its page or its hidden columns", () => {
    expect(viewQuery(parse("page=4&status=paid&hide=total"))).toEqual({ status: "paid" });
  });
});

describe("mergeIntoUrl", () => {
  it("rewrites the list's parameters and keeps the page's own", () => {
    const defaults = { filterKeys: ["status"] };
    const current = new URLSearchParams("tab=all&status=pending&page=3");
    const next = mergeIntoUrl(current, updateListState(parseListState(current, defaults), { filters: { status: "approved" } }), defaults);
    expect(Object.fromEntries(next)).toEqual({ tab: "all", status: "approved" });
  });

  it("drops a filter that was cleared", () => {
    const defaults = { filterKeys: ["status"] };
    const current = new URLSearchParams("tab=all&status=pending");
    expect(mergeIntoUrl(current, updateListState(parseListState(current, defaults), { filters: {} }), defaults).toString()).toBe("tab=all");
  });
});
