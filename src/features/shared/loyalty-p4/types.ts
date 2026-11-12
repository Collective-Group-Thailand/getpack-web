/**
 * Points & Deals P4: factory co-funding, the programme budget, the rollout, the surfaces and company one-offs, from the
 * generated contract (getpack-api `feat/loyalty-p4-cofunding-controls`, pinned in `contract.lock.json`).
 *
 * Money is a decimal string, points are integers, percentages the API's decimal strings: the web formats them and
 * never computes one. The terms of an offer are the API's `termsText`; the web composes none. Co-funding never reaches
 * a store response, and no store shape here names a cohort, a stage or a budget (D-440, D-510).
 */

import type { Schemas } from "@/lib/api/types";

/* ---------------------------------------------------------------------------------------------- store */

export type LoyaltySurfaces = Schemas["LoyaltySurfacesDto"];
export type StoreLoyaltySurface = keyof LoyaltySurfaces;
export type LoyaltyTaskStatusP4 = Schemas["LoyaltyTaskStatus"];

/** The flags a store response carries, in the setting's order without `capacityDeals`. */
export const STORE_LOYALTY_SURFACES = [
  "deals",
  "dealsLiff",
  "redeem",
  "tierPerks",
  "checklist",
  "pointsLiff",
  "quoteRecovery",
] as const satisfies readonly StoreLoyaltySurface[];

/** Every gated surface closed — what a failed read means (the balance and the ledger always stay). */
export const SURFACES_CLOSED: LoyaltySurfaces = {
  deals: false,
  dealsLiff: false,
  redeem: false,
  tierPerks: false,
  checklist: false,
  pointsLiff: false,
  quoteRecovery: false,
};

/** `params.surface` of the problem `loyalty.feature_disabled` (404). `capacityDeals` only on admin responses. */
export const LOYALTY_SURFACE_PROBLEMS = ["deals", "redeem", "tierPerks", "checklist", "capacityDeals"] as const;

/** A checklist task the customer's company already claimed (D-508): a muted row without points or a link. */
export const isClaimedByCompany = (task: { status: LoyaltyTaskStatusP4 }) => task.status === "claimed_by_company";

/* ---------------------------------------------------------------------------------------- co-funding */

export type CofundingShareMode = Schemas["CofundingShareMode"];
export type CofundingOfferStatus = Schemas["CofundingOfferStatus"];
export type CofundingContributionStatus = Schemas["CofundingContributionStatus"];
export type CofundingReverseReason = Schemas["CofundingReverseReason"];
export type AdminCofundingOffer = Schemas["CofundingOfferDto"];
export type CofundingCandidate = Schemas["CofundingCandidateDto"];
export type CofundingOfferInput = Schemas["CreateCofundingOfferDto"];
export type AdminCofundingContribution = Schemas["CofundingContributionDto"];
export type CapacityDealFunding = Schemas["CapacityDealFundingDto"];
export type PartnerCofundingOffer = Schemas["CofundingOfferPartnerDto"];
export type PartnerCofundingOfferDetail = Schemas["CofundingOfferPartnerDetailDto"];
export type PartnerCofundingOrder = Schemas["CofundingOrderDto"];

export const COFUNDING_SHARE_MODES = [
  "pct_of_discount",
  "fixed_per_order",
] as const satisfies readonly CofundingShareMode[];
export const COFUNDING_OFFER_STATUSES = [
  "proposed",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
  "ended",
] as const satisfies readonly CofundingOfferStatus[];
/** Why a share was reversed; `no_payable`: nothing was left of the order's payable to net it from (getpack funds it). */
export const COFUNDING_REVERSE_REASONS = [
  "order_cancelled",
  "order_refunded",
  "job_reassigned",
  "job_rejected",
  "offer_withdrawn_before_job",
  "no_payable",
] as const satisfies readonly CofundingReverseReason[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `funding` of a `capacity_deal_publish` approval's payload (a snapshot at request time) — the one open object left:
 * approval payloads are untyped in the contract. Typed reads (`admin.capacityDeals.list`, `admin.promotions.get`) use
 * the property.
 */
export function approvalFundingOf(payload: unknown): CapacityDealFunding | null {
  const funding = isRecord(payload) ? payload.funding : null;
  if (!isRecord(funding) || funding.defaultFunder !== "getpack" || !Array.isArray(funding.offers)) return null;
  return funding as unknown as CapacityDealFunding;
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
] as const satisfies readonly Schemas["BillingStatementLineKind"][];

/** A statement's co-funding total (≤ 0), or null when it is zero. */
export const cofundingTotalOf = (totals: { cofunding: string }): string | null =>
  Number(totals.cofunding) !== 0 ? totals.cofunding : null;

/* ---------------------------------------------------------------------------------- programme budget */

export type ProgrammeBudget = Schemas["ProgrammeBudgetDto"];
export type ProgrammeBudgetState = Schemas["ProgrammeBudgetState"];
export const PROGRAMME_BUDGET_STATES = [
  "ok",
  "warning",
  "exhausted",
] as const satisfies readonly ProgrammeBudgetState[];

/* ------------------------------------------------------------------------------------------- rollout */

export type LoyaltyRollout = Schemas["LoyaltyRolloutDto"];
export type RolloutTarget = Schemas["RolloutTargetDto"];
export type RolloutChange = Schemas["RolloutChangeDto"];
export type RolloutStage = Schemas["LoyaltyRolloutStage"];
export type RolloutGate = Schemas["RolloutGateDto"];
export type CohortLookup = Schemas["CohortDto"];

export const ROLLOUT_STAGES = ["internal", "uat", "percent", "all"] as const satisfies readonly RolloutStage[];
export const ROLLOUT_GATE_METRICS = [
  "redemption_rate",
  "points_liability",
  "margin_after_promotions",
  "budget_use",
] as const satisfies readonly Schemas["RolloutGateMetric"][];

/* --------------------------------------------------------------------------------- funding analytics */

export type FundingSplit = Schemas["LoyaltyFundingDto"];
export type FundingRow = Schemas["DealFundingDto"];
