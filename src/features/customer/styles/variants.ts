import type { StyleDetail } from "@/features/customer/catalog/api.server";

/**
 * The variant picker's logic (U3.5 §2), over what the API published: `axes` (each with the values
 * some publishable variant uses) and `variants` (the valid combinations). The picker never offers
 * a combination the API did not publish; an option that cannot go with the rest of the selection
 * names what it conflicts with.
 */

export type Axis = StyleDetail["axes"][number];
export type Variant = StyleDetail["variants"][number];
/** One value per axis; a multi-select axis (pouch features) holds a set. */
export type Selection = Record<string, string | string[]>;

/** A value as a comparable key: a set is sorted and joined by `+`, the empty set is `none` (getpack-api). */
export const keyOf = (value: unknown): string =>
  Array.isArray(value) ? [...value].map(String).sort().join("+") || "none" : String(value);

export const matches = (variant: Variant, selection: Selection) =>
  Object.entries(selection).every(([axis, value]) => keyOf(variant.options[axis]) === keyOf(value));

/** The selection of a variant: its options, sets as arrays. */
export function selectionOf(variant: Variant, axes: readonly Axis[]): Selection {
  const out: Selection = {};
  for (const a of axes) {
    const value = variant.options[a.axis];
    if (value === undefined) continue;
    out[a.axis] = a.multiSelect ? (Array.isArray(value) ? value.map(String) : []) : String(value);
  }
  return out;
}

/** The selection with one axis changed (a multi-select value toggled). */
export function change(selection: Selection, axis: Axis, value: string): Selection {
  if (!axis.multiSelect) return { ...selection, [axis.axis]: value };
  const current = (selection[axis.axis] as string[] | undefined) ?? [];
  return {
    ...selection,
    [axis.axis]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
  };
}

export const variantOf = (variants: readonly Variant[], selection: Selection) =>
  variants.find((v) => matches(v, selection));

export type Option = { value: string; available: true } | { value: string; available: false; conflicts: string[] };

/**
 * Each value of an axis given the rest of the selection: available when a published variant has
 * it with everything else as chosen; otherwise the axes of the closest variant that has it which
 * differ from the selection — "not made with …".
 */
export function optionsOf(axis: Axis, selection: Selection, variants: readonly Variant[]): Option[] {
  return axis.values.map((value) => {
    const next = change(selection, axis, value);
    if (variants.some((v) => matches(v, next))) return { value, available: true as const };
    let best: string[] | null = null;
    for (const v of variants) {
      if (!axis.multiSelect && keyOf(v.options[axis.axis]) !== value) continue;
      const differ = Object.keys(next).filter((a) => a !== axis.axis && keyOf(v.options[a]) !== keyOf(next[a]));
      if (!best || differ.length < best.length) best = differ;
    }
    return { value, available: false as const, conflicts: best ?? [] };
  });
}
