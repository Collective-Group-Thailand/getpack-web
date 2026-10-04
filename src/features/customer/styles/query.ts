import type { StyleListQuery, StyleSort } from "@/features/customer/catalog/api.server";

import { STYLES_HREF } from "./paths";

/** The list's filters as they appear in the URL — one value per facet, as the API takes them. */
export const FILTER_KEYS = [
  "category",
  "family",
  "closure",
  "feature",
  "materialClass",
  "pricePath",
  "useCase",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const SORTS: readonly StyleSort[] = ["popular", "new", "instant_first", "name"];

export type ListParams = Partial<Record<FilterKey | "q" | "sort", string>>;

type Raw = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** The URL's search parameters, kept to what the list understands. */
export function readParams(raw: Raw): ListParams {
  const out: ListParams = {};
  for (const key of [...FILTER_KEYS, "q", "sort"] as const) {
    const value = one(raw[key]);
    if (value) out[key] = value.slice(0, 120);
  }
  if (out.sort && !(SORTS as readonly string[]).includes(out.sort) && out.sort !== "relevance") delete out.sort;
  if (out.pricePath && out.pricePath !== "instant" && out.pricePath !== "rfq") delete out.pricePath;
  return out;
}

/** The API query for these parameters (the first page). */
export function toQuery(params: ListParams, limit: number): StyleListQuery {
  const { pricePath, sort, ...rest } = params;
  return {
    ...rest,
    ...(pricePath ? { pricePath: pricePath as StyleListQuery["pricePath"] } : {}),
    ...(sort ? { sort: sort as StyleSort } : {}),
    limit,
  };
}

/** The list's URL with one parameter set (or removed with `undefined`). */
export function listHref(params: ListParams, change: ListParams = {}): string {
  const next = { ...params, ...change };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `${STYLES_HREF}?${text}` : STYLES_HREF;
}

/** Whether the view is filtered or searched — such a view is not a page of its own to index. */
export const isFiltered = (params: ListParams) => FILTER_KEYS.some((k) => k !== "category" && params[k]) || !!params.q;
