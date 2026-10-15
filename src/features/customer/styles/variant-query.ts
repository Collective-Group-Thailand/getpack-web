import type { StyleVariantListQuery, StyleVariantSort } from "@/features/customer/catalog/api.server";

import { STYLES_HREF } from "./paths";

/**
 * The "every variant" view of the library (D-410), `/styles?view=variants`: the variants grid's
 * filters as they appear in the URL — options (`option=axis:value`, repeated: one axis's values are
 * alternatives, different axes all apply), category, material, a search and an order.
 */
export const VARIANTS_VIEW = "variants";

/** The option groups of the grid's sidebar, in this order: each a heading over one or more axes. */
export const VARIANT_GROUPS: { id: string; axes: string[]; none?: boolean }[] = [
  { id: "filterTop", axes: ["tuck_top", "closure_rigid"] },
  { id: "filterBottom", axes: ["tuck_bottom"] },
  { id: "filterWindow", axes: ["window"], none: true },
  { id: "filterHang", axes: ["hang"], none: true },
  { id: "filterMore", axes: ["handle", "insert", "hand_holes"] },
];

export const VARIANT_SORTS: readonly StyleVariantSort[] = ["popular", "instant_first", "name"];

export interface VariantParams {
  q?: string;
  category?: string;
  materialClass?: string;
  sort?: string;
  option: string[];
}

type Raw = Record<string, string | string[] | undefined>;
const OPTION = /^[a-z0-9_]+:[a-z0-9_+]+$/;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Whether the URL asks for the variants view. */
export const isVariantsView = (raw: Raw) => one(raw["view"]) === VARIANTS_VIEW;

/** The URL's parameters, kept to what the grid understands. */
export function readVariantParams(raw: Raw): VariantParams {
  const options = raw["option"];
  const out: VariantParams = {
    option: [...new Set((Array.isArray(options) ? options : options ? [options] : []).flatMap((o) => o.split(",")))]
      .map((o) => o.trim())
      .filter((o) => OPTION.test(o))
      .slice(0, 20),
  };
  for (const key of ["q", "category", "materialClass", "sort"] as const) {
    const value = one(raw[key]);
    if (value) out[key] = value.slice(0, 120);
  }
  if (out.sort && !(VARIANT_SORTS as readonly string[]).includes(out.sort)) delete out.sort;
  return out;
}

/** The API query for these parameters (the first page). */
export function toVariantQuery(params: VariantParams, limit: number): StyleVariantListQuery {
  const { sort, option, ...rest } = params;
  return {
    ...rest,
    ...(option.length ? { option } : {}),
    ...(sort ? { sort: sort as StyleVariantSort } : {}),
    limit,
  };
}

/** The grid's URL with a change: a parameter set or removed, or one option toggled. */
export function variantsHref(params: VariantParams, change: Partial<VariantParams> & { toggle?: string } = {}) {
  const { toggle, ...set } = change;
  const next: VariantParams = { ...params, ...set, option: set.option ?? params.option };
  if (toggle)
    next.option = next.option.includes(toggle) ? next.option.filter((o) => o !== toggle) : [...next.option, toggle];
  const search = new URLSearchParams({ view: VARIANTS_VIEW });
  for (const key of ["q", "category", "materialClass", "sort"] as const) {
    const value = next[key];
    if (value) search.set(key, value);
  }
  for (const option of [...next.option].sort()) search.append("option", option);
  return `${STYLES_HREF}?${search.toString()}`;
}

/** Whether anything narrows the grid. */
export const isVariantsFiltered = (params: VariantParams) =>
  params.option.length > 0 || !!params.q || !!params.category || !!params.materialClass;
