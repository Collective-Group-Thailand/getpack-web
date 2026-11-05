/**
 * Loyalty P4: the fields P4 adds to **published** reads, read once here without zod at run time, so a response
 * without them reads as "nothing new" (as `features/shared/loyalty-p3/read.ts` did for P3). CONTRACT-REQUEST
 * store.loyalty.p4-fields, admin.loyalty.p4-fields, partner.loyalty.p4-fields. On adoption (`pnpm gen:api --adopt`)
 * these become plain property reads and this file goes.
 */

import type { CapacityDealFunding } from "@/lib/api/requests/admin-loyalty-p4";
import type { LoyaltySurfaces, LoyaltyTaskStatusP4 } from "@/lib/api/requests/store-loyalty-p4";

/** Every gated surface closed — what a failed or missing read means (the balance and the ledger always stay). */
export const SURFACES_CLOSED: LoyaltySurfaces = {
  deals: false,
  dealsLiff: false,
  redeem: false,
  tierPerks: false,
  checklist: false,
  pointsLiff: false,
  quoteRecovery: false,
};

const SURFACE_KEYS = Object.keys(SURFACES_CLOSED) as (keyof LoyaltySurfaces)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Seven booleans from an answer; anything missing or not a boolean reads as closed. `capacityDeals` is ignored. */
export function surfacesOf(value: unknown): LoyaltySurfaces {
  if (!isRecord(value)) return SURFACES_CLOSED;
  return Object.fromEntries(SURFACE_KEYS.map((key) => [key, value[key] === true])) as LoyaltySurfaces;
}

/** `store.publicConfig.get` `loyaltySurfaces` (the anonymous view); closed when the field is not there yet. */
export function publicConfigSurfacesOf(config: unknown): LoyaltySurfaces {
  return isRecord(config) ? surfacesOf(config.loyaltySurfaces) : SURFACES_CLOSED;
}

/** A checklist task's status, `claimed_by_company` included (D-508). */
export function taskStatusOf(task: { status: string }): LoyaltyTaskStatusP4 {
  return task.status as LoyaltyTaskStatusP4;
}

export const isClaimedByCompany = (task: { status: string }) => task.status === "claimed_by_company";

/** `funding` of a capacity deal (list item, `capacityDeal` of a promotion, the approval payload), or null. */
export function fundingOf(value: unknown): CapacityDealFunding | null {
  const funding = isRecord(value) ? value.funding : null;
  if (!isRecord(funding) || funding.defaultFunder !== "getpack" || !Array.isArray(funding.offers)) return null;
  return funding as unknown as CapacityDealFunding;
}

/** `totals.cofunding` of a billing statement (≤ 0), or null when the field is not there or is zero. */
export function cofundingTotalOf(totals: unknown): string | null {
  const value = isRecord(totals) ? totals.cofunding : null;
  return typeof value === "string" && Number(value) !== 0 ? value : null;
}

/** Statement line kinds in display order, `cofunding` after the deductions (D-506). */
export const STATEMENT_LINE_KINDS_P4 = [
  "production",
  "shipping",
  "mockup",
  "design",
  "reproduction",
  "deduction",
  "cofunding",
] as const;
