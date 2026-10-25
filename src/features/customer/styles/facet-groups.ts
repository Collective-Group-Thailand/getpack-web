import type { StyleList } from "@/features/customer/catalog/api.server";

import { VARIANT_GROUPS } from "./variant-query";
import type { FacetKey, ListParams } from "./query";

/** One value of a facet as the sidebar shows it: its API value, its count, whether it is on. */
export interface FacetItem {
  value: string;
  count: number;
  selected: boolean;
  /** For an option facet (`axis:value`), the part after the axis — the label without its prefix. */
  option?: string;
}

/** A heading over some items: an option axis ("ก้นกล่อง"), or the facet itself for flat facets. */
export interface FacetSubGroup {
  /** The axis (`tuck_bottom`), or `null` for a flat facet. */
  axis: string | null;
  items: FacetItem[];
}

export interface FacetGroup {
  key: FacetKey;
  subGroups: FacetSubGroup[];
  /** Values selected in this group, across its sub-groups. */
  selected: number;
}

/**
 * The sidebar's order of facets (styles redesign, PLAN.md §c): closures, features, what it suits,
 * material, family. Only the order is decided here — which facets and values exist, their counts
 * and their order within a facet come from the API, so staff changes appear without a release.
 */
export const GROUP_ORDER: readonly FacetKey[] = ["closure", "feature", "useCase", "materialClass", "family"];

/** Option axes in the order the variants grid already uses; any other axis follows in the API's order. */
const AXIS_ORDER: string[] = VARIANT_GROUPS.flatMap((group) => group.axes);

/** `tuck_bottom:crash_lock` → [`tuck_bottom`, `crash_lock`]; a value without an axis is its own option. */
export function splitOption(value: string): [axis: string, option: string] {
  const at = value.indexOf(":");
  return at < 0 ? ["", value] : [value.slice(0, at), value.slice(at + 1)];
}

const isOptionFacet = (key: FacetKey) => key === "closure" || key === "feature";

/**
 * The API's facets as the sidebar's groups: option facets split into one sub-group per axis (so
 * "ก้นกล่อง:" heads its values once instead of prefixing each), flat facets as one sub-group.
 * Values with no match are left out unless selected — a filter that is on can always be turned off.
 */
export function groupFacets(facets: StyleList["facets"], params: ListParams): FacetGroup[] {
  const groups: FacetGroup[] = [];
  for (const key of GROUP_ORDER) {
    const chosen = new Set(params[key]);
    const values = [...(facets[key] ?? [])];
    // A selected value the API no longer counts (another filter excludes it) stays visible at 0.
    for (const value of chosen) if (!values.some((v) => v.value === value)) values.push({ value, count: 0 });
    const items = values
      .filter((v) => v.count > 0 || chosen.has(v.value))
      .map((v) => ({ value: v.value, count: v.count, selected: chosen.has(v.value) }));
    if (items.length === 0) continue;

    let subGroups: FacetSubGroup[];
    if (isOptionFacet(key)) {
      const byAxis = new Map<string, FacetItem[]>();
      for (const item of items) {
        const [axis, option] = splitOption(item.value);
        const list = byAxis.get(axis) ?? [];
        list.push({ ...item, option });
        byAxis.set(axis, list);
      }
      const rank = (axis: string) => {
        const at = AXIS_ORDER.indexOf(axis);
        return at < 0 ? AXIS_ORDER.length : at;
      };
      subGroups = [...byAxis.entries()]
        .map(([axis, list], index) => ({ axis: axis || null, items: list, index }))
        .sort((a, b) => rank(a.axis ?? "") - rank(b.axis ?? "") || a.index - b.index)
        .map(({ axis, items: list }) => ({ axis, items: list }));
    } else {
      subGroups = [{ axis: null, items }];
    }
    groups.push({ key, subGroups, selected: chosen.size });
  }
  return groups;
}

/** How many items a sub-group shows before "ดูเพิ่มอีก N รายการ" — selected ones always show. */
export const VISIBLE_ITEMS = 5;

/** The items shown while a sub-group is folded: the first five, plus any selected beyond them. */
export function foldedItems<T extends { selected: boolean }>(
  items: T[],
  limit = VISIBLE_ITEMS,
): { shown: T[]; hidden: number } {
  if (items.length <= limit) return { shown: items, hidden: 0 };
  const shown = items.filter((item, index) => index < limit || item.selected);
  return { shown, hidden: items.length - shown.length };
}
