/**
 * The style commercial fields as the back office edits them (styles redesign C0, C1c — DECISIONS-
 * STAGE-A §11.1, §11.5): inside fit range per dimension (mm), MOQ, recyclable, plastic-free,
 * certification codes. Text in the form, the contract's shape out; the API validates again and owns
 * every rule — this only stops a save that cannot pass. Pure.
 */

import type { Schemas } from "@/lib/api/types";

export type Commercial = Schemas["StyleCommercialDto"];
export type FitSource = Schemas["StyleFitRangeSource"];
export type FitBackfillSource = Schemas["StyleFitBackfillSource"];
export type FitBasis = Schemas["StyleFitBasis"];
export type FitBounds = Schemas["FitRangeBoundSourcesDto"];

export const DIMENSIONS = [
  { dim: "length", min: "fitMinLMm", max: "fitMaxLMm" },
  { dim: "width", min: "fitMinWMm", max: "fitMaxWMm" },
  { dim: "height", min: "fitMinHMm", max: "fitMaxHMm" },
] as const;

export type Dimension = (typeof DIMENSIONS)[number]["dim"];
export type FitKey = (typeof DIMENSIONS)[number]["min"] | (typeof DIMENSIONS)[number]["max"];
export type Tri = "unknown" | "yes" | "no";

export interface CommercialForm {
  fit: Record<FitKey, string>;
  moqUnits: string;
  recyclable: Tri;
  plasticFree: Tri;
  certifications: string[];
}

/** The admin field bounds (`StyleCommercialDto`). */
export const MAX_FIT_MM = 5000;
export const MAX_MOQ = 10_000_000;
export const CERTIFICATION_CODE = /^[a-z][a-z0-9_]*$/;

const tri = (v: boolean | null): Tri => (v === null ? "unknown" : v ? "yes" : "no");
const fromTri = (v: Tri): boolean | null => (v === "unknown" ? null : v === "yes");
const str = (v: number | null) => (v === null ? "" : String(v));

export function formOf(c: Commercial): CommercialForm {
  return {
    fit: {
      fitMinLMm: str(c.fitMinLMm),
      fitMaxLMm: str(c.fitMaxLMm),
      fitMinWMm: str(c.fitMinWMm),
      fitMaxWMm: str(c.fitMaxWMm),
      fitMinHMm: str(c.fitMinHMm),
      fitMaxHMm: str(c.fitMaxHMm),
    },
    moqUnits: str(c.moqUnits),
    recyclable: tri(c.recyclable),
    plasticFree: tri(c.plasticFree),
    certifications: [...c.certifications],
  };
}

export type FormError =
  | { field: FitKey; code: "whole" | "range" }
  | { field: Dimension; code: "order" }
  | { field: "moqUnits"; code: "whole" | "range" }
  | { field: "certifications"; code: "code" };

const whole = (v: string): number | null | "bad" => {
  const t = v.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : "bad";
};

/** The form as the PATCH body's `commercial`, or the reasons it cannot be saved. */
export function toCommercial(form: CommercialForm): { value: Commercial; errors: [] } | { value: null; errors: FormError[] } {
  const errors: FormError[] = [];
  const fit = {} as Record<FitKey, number | null>;
  for (const { dim, min, max } of DIMENSIONS) {
    for (const key of [min, max] as const) {
      const n = whole(form.fit[key]);
      if (n === "bad") errors.push({ field: key, code: "whole" });
      else if (n !== null && (n < 1 || n > MAX_FIT_MM)) errors.push({ field: key, code: "range" });
      fit[key] = n === "bad" ? null : n;
    }
    if (fit[min] !== null && fit[max] !== null && fit[min]! > fit[max]!) errors.push({ field: dim, code: "order" });
  }
  const moq = whole(form.moqUnits);
  if (moq === "bad") errors.push({ field: "moqUnits", code: "whole" });
  else if (moq !== null && (moq < 1 || moq > MAX_MOQ)) errors.push({ field: "moqUnits", code: "range" });
  const certifications = [...new Set(form.certifications.map((c) => c.trim()).filter(Boolean))];
  if (certifications.some((c) => !CERTIFICATION_CODE.test(c))) errors.push({ field: "certifications", code: "code" });
  if (errors.length) return { value: null, errors };
  return {
    value: {
      ...fit,
      moqUnits: moq === "bad" ? null : moq,
      recyclable: fromTri(form.recyclable),
      plasticFree: fromTri(form.plasticFree),
      certifications,
    },
    errors: [],
  };
}

/** True when the form's fit range differs from the saved one (a save then makes it business data). */
export function fitChanged(form: CommercialForm, saved: Commercial): boolean {
  return DIMENSIONS.some(({ min, max }) => form.fit[min].trim() !== str(saved[min]) || form.fit[max].trim() !== str(saved[max]));
}

export interface DimensionSource {
  /** Where this dimension's bounds came from; `null` = no range. */
  source: FitSource | null;
  basis: FitBasis[];
}

/**
 * Each dimension's source as the admin shows it: a business range is `business` throughout; a
 * backfilled one names its per-bound source (C1c `fitRangeBounds`), or the summary source for a C0b
 * recipe range stored before bounds were recorded.
 */
export function dimensionSources(
  style: Pick<Schemas["AdminStyleBaseDetailDto"], "fitRangeSource" | "fitRangeBounds" | "commercial">,
): Record<Dimension, DimensionSource> {
  const out = {} as Record<Dimension, DimensionSource>;
  for (const { dim, min, max } of DIMENSIONS) {
    const empty = style.commercial[min] === null && style.commercial[max] === null;
    if (empty || style.fitRangeSource === null) {
      out[dim] = { source: null, basis: [] };
      continue;
    }
    const bounds = style.fitRangeBounds;
    if (style.fitRangeSource === "business" || !bounds) {
      out[dim] = { source: style.fitRangeSource, basis: [] };
      continue;
    }
    const lo = bounds[min];
    const hi = bounds[max];
    out[dim] =
      lo.source === hi.source
        ? { source: lo.source, basis: [...new Set([...lo.basis, ...hi.basis])] }
        : { source: "combined", basis: [...new Set([...lo.basis, ...hi.basis])] };
  }
  return out;
}

/** C1e (DECISIONS-STAGE-A §13.2): how the size search reads a style (set by the backfill, read-only here). */
export type SizeClass = Schemas["StyleSizeClass"];

/** True when the size search applies to the style (a `not_applicable` style has no range to edit). */
export const sizeSearchApplies = (sizeClass: SizeClass | null | undefined) => sizeClass !== "not_applicable";

/**
 * The label key of a dimension under the style's size class: a bag's length is its width and its width the gusset
 * (depth); a round style's length and width are both its diameter (the footprint's bounding square).
 */
export function dimensionLabelKey(sizeClass: SizeClass | null | undefined, dim: Dimension): string {
  if (sizeClass === "bag" && dim !== "height") return `bag.${dim}`;
  if (sizeClass === "cylinder" && dim !== "height") return "cylinder.diameter";
  return dim;
}
