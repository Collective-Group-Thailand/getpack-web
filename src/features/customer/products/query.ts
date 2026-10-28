/**
 * The /products hub's state in the address bar (prompt item 5): `mode`, `cat`, `q`, `sort`, `view`,
 * `page`. Defaults are left out, so the untouched page has a clean URL; anything garbled is read as
 * its default, never guessed at. The page renders from these on the server, so a shared link, a
 * crawler and the back button all see the same list.
 */

import { HUB_MODES, HUB_SORTS, type HubMode, type HubSort } from "./hub";

export type HubView = "grid" | "table";

export interface HubParams {
  mode: HubMode | null;
  /** A category code (snake_case, as the API writes it). */
  cat: string | null;
  q: string | null;
  sort: HubSort;
  view: HubView;
  /** How many batches of 15 are shown (≥ 1). */
  page: number;
}

export const DEFAULT_PARAMS: HubParams = { mode: null, cat: null, q: null, sort: "recommended", view: "grid", page: 1 };

/** The words a sort is written as in the URL ("recommended" is the default and never written). */
const SORT_PARAM: Record<HubSort, string | null> = { recommended: null, price: "price", moq: "moq", lead: "lead" };

type Raw = Partial<Record<string, string | string[] | undefined>>;

const one = (raw: Raw, name: string): string | undefined => {
  const value = raw[name];
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" && text.trim() !== "" && text.length <= 120 ? text.trim() : undefined;
};

const CATEGORY = /^[a-z][a-z0-9_]{0,59}$/;
const MAX_PAGE = 50;

export function readHubParams(raw: Raw): HubParams {
  const mode = one(raw, "mode");
  const cat = one(raw, "cat")?.replaceAll("-", "_");
  const sort = one(raw, "sort");
  const page = Number(one(raw, "page"));
  return {
    mode: (HUB_MODES as readonly string[]).includes(mode ?? "") ? (mode as HubMode) : null,
    cat: cat && CATEGORY.test(cat) ? cat : null,
    q: one(raw, "q") ?? null,
    sort: HUB_SORTS.find((s) => SORT_PARAM[s] !== null && SORT_PARAM[s] === sort) ?? "recommended",
    view: one(raw, "view") === "table" ? "table" : "grid",
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/**
 * The search string of a state (no leading "?"), defaults omitted, in a fixed order. `fixed` are a page's own
 * parameters written first and kept on every link (a category page's `type`).
 */
export function hubSearch(params: HubParams, fixed: Record<string, string> = {}): string {
  const search = new URLSearchParams(fixed);
  if (params.mode) search.set("mode", params.mode);
  if (params.cat) search.set("cat", params.cat.replaceAll("_", "-"));
  if (params.q) search.set("q", params.q);
  const sort = SORT_PARAM[params.sort];
  if (sort) search.set("sort", sort);
  if (params.view === "table") search.set("view", "table");
  if (params.page > 1) search.set("page", String(params.page));
  return search.toString();
}

/**
 * The link to the state after `changes`. Changing what is listed (mode, category, search, sort) goes
 * back to the first batch; switching the view keeps it. Changing the mode drops a category that the
 * new mode may not have.
 */
export function hubHref(
  base: string,
  params: HubParams,
  changes: Partial<HubParams> = {},
  fixed: Record<string, string> = {},
): string {
  const listChanged = (["mode", "cat", "q", "sort"] as const).some(
    (key) => key in changes && changes[key] !== params[key],
  );
  const next: HubParams = {
    ...params,
    ...("mode" in changes && changes.mode !== params.mode && !("cat" in changes) ? { cat: null } : {}),
    ...changes,
    ...(listChanged && !("page" in changes) ? { page: 1 } : {}),
  };
  const search = hubSearch(next, fixed);
  return search ? `${base}?${search}` : base;
}

/** Whether the state is a filtered view of the hub (not the page a crawler should index). */
export const isFilteredHub = (params: HubParams) =>
  !!(
    params.mode ||
    params.cat ||
    params.q ||
    params.sort !== "recommended" ||
    params.view !== "grid" ||
    params.page > 1
  );
