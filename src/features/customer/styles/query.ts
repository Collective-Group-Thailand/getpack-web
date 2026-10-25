import type { StyleListQuery, StyleSort } from "@/features/customer/catalog/api.server";

import { STYLES_HREF } from "./paths";

/**
 * The style library's state in its URL (styles redesign, PLAN.md §0.1 / prototype spec 7): what a
 * shared link reopens and what the server renders the page from.
 *
 * | URL     | meaning                         | API (`store.styles.list`) |
 * |---------|---------------------------------|---------------------------|
 * | `cat`   | category (the rail)             | `category`                |
 * | `q`     | search words                    | `q`                       |
 * | `use`   | suits (use cases), comma list   | `useCase`                 |
 * | `mat`   | material class, comma list      | `materialClass`           |
 * | `close` | closure options `axis:value`    | `closure`                 |
 * | `feat`  | feature options `axis:value`    | `feature`                 |
 * | `fam`   | structure family                | `family`                  |
 * | `price` | `instant` (the switch) / `rfq`  | `pricePath`               |
 * | `sort`  | order; the default is omitted   | `sort`                    |
 * | `style` | the quick view that is open     | — (a client overlay)      |
 *
 * Defaults are never written. The earlier long names (`category`, `useCase`, `pricePath`, …) are
 * still read, so links shared before the redesign keep working; they are written short.
 */

/** The filters that hold a list of values: one facet's values are alternatives (OR). */
export const FACET_KEYS = ["useCase", "materialClass", "closure", "feature", "family"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Every filter as the API names it; `category` is the rail, `pricePath` the instant switch. */
export const FILTER_KEYS = ["category", "pricePath", ...FACET_KEYS] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** The URL's short name for each API name. */
export const URL_NAME: Record<FilterKey, string> = {
  category: "cat",
  pricePath: "price",
  useCase: "use",
  materialClass: "mat",
  closure: "close",
  feature: "feat",
  family: "fam",
};

/**
 * Whether the list API takes several values of one facet (CONTRACT-REQUEST
 * store.styles.multi-facets). Until it does, choosing a value replaces the facet's other value —
 * the URL and the UI already carry lists, so this is the only line that changes when it ships.
 */
export const MULTI_VALUE_FACETS = false;

export const SORTS: readonly StyleSort[] = ["popular", "new", "instant_first", "name"];
export const PRICE_PATHS = ["instant", "rfq"] as const;

export interface ListParams {
  category?: string;
  pricePath?: (typeof PRICE_PATHS)[number];
  useCase: string[];
  materialClass: string[];
  closure: string[];
  feature: string[];
  family: string[];
  q?: string;
  sort?: string;
  /** A style code: its quick view is open over the list. */
  style?: string;
}

type Raw = Record<string, string | string[] | undefined>;

const MAX_VALUES = 20;
const VALUE = /^[\p{L}\p{M}\p{N}_:+.-]{1,80}$/u;
const STYLE_CODE = /^PK-[A-Z]+-\d+$/;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

function list(value: string | string[] | undefined): string[] {
  const parts = (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(","));
  return [...new Set(parts.map((p) => p.trim()).filter((p) => VALUE.test(p)))].slice(0, MAX_VALUES);
}

export const emptyParams = (): ListParams => ({ useCase: [], materialClass: [], closure: [], feature: [], family: [] });

/** The URL's search parameters, kept to what the list understands (short names first, then long). */
export function readParams(raw: Raw): ListParams {
  const out = emptyParams();
  const pick = (key: FilterKey) => raw[URL_NAME[key]] ?? raw[key];

  const category = first(pick("category"));
  if (category && VALUE.test(category)) out.category = category;
  const price = first(pick("pricePath"));
  if (price && (PRICE_PATHS as readonly string[]).includes(price)) out.pricePath = price as ListParams["pricePath"];
  for (const key of FACET_KEYS) out[key] = list(pick(key));

  const q = first(raw["q"]);
  if (q) out.q = q.slice(0, 120);
  const sort = first(raw["sort"]);
  if (sort && ((SORTS as readonly string[]).includes(sort) || sort === "relevance")) out.sort = sort;
  const style = first(raw["style"])?.toUpperCase();
  if (style && STYLE_CODE.test(style)) out.style = style;
  return out;
}

/** The API query for these parameters (the first page). Lists go as their first value until multi-facets ship. */
export function toQuery(params: ListParams, limit: number): StyleListQuery {
  const query: StyleListQuery = { limit };
  if (params.category) query.category = params.category;
  if (params.pricePath) query.pricePath = params.pricePath;
  for (const key of FACET_KEYS) if (params[key][0]) query[key] = params[key][0];
  if (params.q) query.q = params.q;
  if (params.sort) query.sort = params.sort as StyleSort;
  return query;
}

/** The URL's search string for these parameters, short names, defaults left out, lists sorted. */
export function toSearch(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.category) search.set(URL_NAME.category, params.category);
  if (params.q) search.set("q", params.q);
  for (const key of FACET_KEYS)
    if (params[key].length) search.set(URL_NAME[key], [...params[key]].sort().join(","));
  if (params.pricePath) search.set(URL_NAME.pricePath, params.pricePath);
  if (params.sort && params.sort !== defaultSort(params)) search.set("sort", params.sort);
  if (params.style) search.set("style", params.style);
  // Readable commas and colons: `close=tuck_bottom:crash_lock,window:front`.
  return search.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
}

/** The order the API uses without `sort`: relevance for a search, otherwise popular. */
export const defaultSort = (params: Pick<ListParams, "q">) => (params.q ? "relevance" : "popular");

/** The list's URL with a change applied (a value `undefined` or `[]` removes it). */
export function listHref(params: ListParams, change: Partial<ListParams> = {}): string {
  const text = toSearch({ ...params, ...change });
  return text ? `${STYLES_HREF}?${text}` : STYLES_HREF;
}

/** One value of a facet switched on or off — replacing the facet's other value while the API takes one. */
export function toggleValue(params: ListParams, key: FacetKey, value: string): ListParams {
  const current = params[key];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : MULTI_VALUE_FACETS
      ? [...current, value]
      : [value];
  return { ...params, [key]: next };
}

/** Every filter cleared; the search words and the order stay. */
export const clearFilters = (params: ListParams): ListParams => ({
  ...emptyParams(),
  ...(params.q ? { q: params.q } : {}),
  ...(params.sort ? { sort: params.sort } : {}),
});

/** How many filters are on (each facet value and the instant switch; the category is the rail). */
export const activeFilterCount = (params: ListParams) =>
  FACET_KEYS.reduce((n, key) => n + params[key].length, 0) + (params.pricePath ? 1 : 0);

/**
 * Whether the view is filtered or searched — such a view is not a page of its own to index. A
 * category alone is (its rail link is a plain page); the quick view is an overlay, not a filter.
 */
export const isFiltered = (params: ListParams) => activeFilterCount(params) > 0 || !!params.q;
