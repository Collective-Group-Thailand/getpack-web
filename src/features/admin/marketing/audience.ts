/**
 * Loyalty P2 (conditions v2, D-494): the promotion editor's audience draft and the bundle draft, and how each becomes
 * the v2 fields of `admin.promotions.update`. The API validates again (422 `exclusive`, `bundle_pair`,
 * `listing_requires_audience`, publish guard `bundle_items` / `bundle_unpriceable` / `audience_words`).
 */

import type { BundlePresetItem, PromotionAudience } from "@/features/shared/loyalty-p2/types";

export type Criterion = "newCustomer" | "tiers" | "businessTypes" | "inactiveDays" | "orderedTypes";
export const CRITERIA: readonly Criterion[] = ["newCustomer", "tiers", "businessTypes", "inactiveDays", "orderedTypes"];

export interface AudienceDraft {
  on: Record<Criterion, boolean>;
  tiers: string[];
  businessTypes: string[];
  inactiveDays: string;
  orderedTypes: string[];
}

/** The saved audience as a draft; a criterion is on when the audience carries it. */
export function audienceDraftOf(audience: PromotionAudience | null): AudienceDraft {
  return {
    on: {
      newCustomer: audience?.newCustomer === true,
      tiers: Boolean(audience?.tiers?.length),
      businessTypes: Boolean(audience?.businessTypes?.length),
      inactiveDays: typeof audience?.inactiveDaysGte === "number",
      orderedTypes: Boolean(audience?.orderedProductTypeCodes?.length),
    },
    tiers: audience?.tiers ?? [],
    businessTypes: audience?.businessTypes ?? [],
    inactiveDays: audience?.inactiveDaysGte ? String(audience.inactiveDaysGte) : "90",
    orderedTypes: audience?.orderedProductTypeCodes ?? [],
  };
}

/**
 * The draft as `conditions.audience`: only the criteria that are on and say something (AND across keys, OR inside
 * a key). Nothing on → null: everyone.
 */
export function audienceOf(draft: AudienceDraft): PromotionAudience | null {
  const days = Math.trunc(Number(draft.inactiveDays));
  const audience: PromotionAudience = {
    ...(draft.on.newCustomer ? { newCustomer: true } : {}),
    ...(draft.on.tiers && draft.tiers.length ? { tiers: [...draft.tiers] as PromotionAudience["tiers"] } : {}),
    ...(draft.on.businessTypes && draft.businessTypes.length
      ? { businessTypes: [...draft.businessTypes] as PromotionAudience["businessTypes"] }
      : {}),
    ...(draft.on.inactiveDays && Number.isFinite(days) && days >= 1 ? { inactiveDaysGte: days } : {}),
    ...(draft.on.orderedTypes && draft.orderedTypes.length ? { orderedProductTypeCodes: [...draft.orderedTypes] } : {}),
  };
  return Object.keys(audience).length ? audience : null;
}

/** A criterion that is on but says nothing yet (no tier picked): the editor marks it, the save leaves it out. */
export function incompleteCriteria(draft: AudienceDraft): Criterion[] {
  return CRITERIA.filter((criterion) => {
    if (!draft.on[criterion]) return false;
    if (criterion === "tiers") return !draft.tiers.length;
    if (criterion === "businessTypes") return !draft.businessTypes.length;
    if (criterion === "orderedTypes") return !draft.orderedTypes.length;
    if (criterion === "inactiveDays") return !(Math.trunc(Number(draft.inactiveDays)) >= 1);
    return false;
  });
}

export interface BundleRowDraft {
  productTypeCode: string;
  /** The preset as JSON text, as copied from the configurator or a quotation. */
  configuration: string;
  quantity: string;
}

export const blankBundleRow = (): BundleRowDraft => ({ productTypeCode: "", configuration: "{}", quantity: "" });

export function bundleDraftOf(items: readonly BundlePresetItem[]): BundleRowDraft[] {
  return items.length
    ? items.map((item) => ({
        productTypeCode: item.productTypeCode,
        configuration: JSON.stringify(item.configuration, null, 2),
        quantity: String(item.quantity),
      }))
    : [blankBundleRow(), blankBundleRow()];
}

export type BundleRowProblem = "type" | "configuration" | "quantity";

/** What is wrong with each row before anything is sent; an empty list means the rows can be sent. */
export function bundleRowProblems(row: BundleRowDraft): BundleRowProblem[] {
  const problems: BundleRowProblem[] = [];
  if (!row.productTypeCode) problems.push("type");
  if (parseConfiguration(row.configuration) === null) problems.push("configuration");
  const quantity = Number(row.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) problems.push("quantity");
  return problems;
}

export function parseConfiguration(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function bundleItemsOf(rows: readonly BundleRowDraft[]): BundlePresetItem[] {
  return rows.map((row) => ({
    productTypeCode: row.productTypeCode,
    configuration: parseConfiguration(row.configuration) ?? {},
    quantity: Math.trunc(Number(row.quantity)),
  }));
}

/** The bundle's own rules (D-494): 2–4 items, and at least as many distinct types as the cart must hold. */
export function bundleChecks(rows: readonly BundleRowDraft[], minTypes: number) {
  const types = new Set(rows.map((row) => row.productTypeCode).filter(Boolean));
  return {
    count: rows.length >= 2 && rows.length <= 4,
    types: types.size >= Math.max(2, minTypes),
    rows: rows.every((row) => bundleRowProblems(row).length === 0),
  };
}

/** A preset's keys and values in one line ("lengthMm 300 · flute B"), for the row's summary. */
export function configurationSummary(text: string): string {
  const value = parseConfiguration(text);
  if (!value) return "";
  return Object.entries(value)
    .map(([key, entry]) => `${key} ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`)
    .join(" · ");
}
