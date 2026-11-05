/**
 * Points & Deals P4: the back office — factory co-funding offers and contributions (D-506), the monthly programme
 * budget (D-507), the phased rollout (D-510) and the funding split in loyalty analytics.
 *
 * CONTRACT: API-CHANGES-P4. New operations are request definitions until the release is adopted. Published operations
 * that gain fields — `admin.capacityDeals.list` / `admin.promotions.get` (`funding`), the `capacity_deal_publish`
 * approval payload (`funding`), `admin.payables.getStatement` (line kind and total `cofunding`) — are the `…P4` schemas
 * here, read once in `features/shared/loyalty-p4/read.ts`. CONTRACT-REQUEST admin.loyalty.p4-fields.
 *
 * Co-funding never reaches a store response; the free-capacity figure, utilisation and prices are not in any of these.
 */

import { z } from "zod";

import { date, dateTime, money, page, pageMeta, pct, request, userRef, uuid } from "./define";
import {
  contributionStatus,
  COFUNDING_REVERSE_REASONS,
  offerStatus,
  offerTerms,
  shareMode,
} from "./partner-loyalty-p4";

/* ------------------------------------------------------------------------------------- co-funding */

export const adminOffer = z
  .object({
    ...offerTerms,
    proposedBy: userRef(),
    answeredBy: userRef().nullable(),
    withdrawnAt: dateTime().nullable(),
    rowVersion: z.number().int(),
  })
  .meta({ id: "CofundingOfferDto" });

export const offerCandidate = z
  .object({ factoryId: uuid(), name: z.string(), hasLiveOffer: z.boolean() })
  .meta({ id: "CofundingCandidateDto" });

export const offerInput = z
  .object({
    factoryId: uuid(),
    mode: shareMode(),
    sharePct: pct().nullable(),
    fixedAmount: money().nullable(),
    capAmount: money(),
    validFrom: dateTime(),
    validTo: dateTime(),
    respondBy: dateTime().optional(),
    note: z.string().max(500).optional(),
  })
  .meta({ id: "CreateCofundingOfferDto" });

export const adminContribution = z
  .object({
    id: uuid(),
    offerId: uuid(),
    promotionId: uuid(),
    factory: z.object({ id: uuid(), name: z.string() }),
    orderCode: z.string(),
    jobNumber: z.string(),
    discountAmount: money(),
    shareAmount: money(),
    capped: z.boolean(),
    status: contributionStatus(),
    accruedAt: dateTime(),
    nettedAt: dateTime().nullable(),
    billingStatementNumber: z.string().nullable(),
    reversedAt: dateTime().nullable(),
    reverseReason: z.enum(COFUNDING_REVERSE_REASONS).meta({ id: "CofundingReverseReason" }).nullable(),
    refundedAt: dateTime().nullable(),
  })
  .meta({ id: "CofundingContributionDto" });

/** `funding` on capacity-deal items, `admin.promotions.get` `capacityDeal` and the `capacity_deal_publish` payload. */
export const capacityDealFunding = z
  .object({
    defaultFunder: z.literal("getpack"),
    offers: z.array(
      z.object({
        offerId: uuid(),
        factoryName: z.string(),
        status: offerStatus(),
        termsText: z.string(),
        capAmount: money(),
        accruedAmount: money(),
      }),
    ),
    acceptedCount: z.number().int().min(0),
    factoryShareToDate: money(),
  })
  .meta({ id: "CapacityDealFundingDto" });

/* ------------------------------------------------------------------------------- programme budget */

export const PROGRAMME_BUDGET_STATES = ["ok", "warning", "exhausted"] as const;
const month = () => z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const programmeBudget = z
  .object({
    month: month(),
    budget: z.object({
      monthlyBaht: money(),
      override: money().nullable(),
      effective: money(),
      settingVersionId: uuid(),
    }),
    spent: z.object({
      points: money(),
      discounts: money(),
      tierPerks: money(),
      factoryShare: money(),
      total: money(),
    }),
    usedPct: pct(),
    state: z.enum(PROGRAMME_BUDGET_STATES).meta({ id: "ProgrammeBudgetState" }),
    alertPcts: z.array(z.number().int().min(1).max(100)),
    alerts: z.array(z.object({ thresholdPct: z.number().int(), firedAt: dateTime(), budget: money(), spent: money() })),
    pendingOverride: z
      .object({ approvalId: uuid(), amount: money(), requestedBy: userRef(), requestedAt: dateTime() })
      .nullable(),
    asOf: dateTime(),
    currency: z.literal("THB"),
  })
  .meta({ id: "ProgrammeBudgetDto" });

const pendingApproval = z.object({ approvalId: uuid(), status: z.literal("pending") });

/* ---------------------------------------------------------------------------------------- rollout */

export const ROLLOUT_STAGES = ["internal", "uat", "percent", "all"] as const;
export const ROLLOUT_GATE_METRICS = [
  "redemption_rate",
  "points_liability",
  "margin_after_promotions",
  "budget_use",
] as const;
export const ROLLOUT_GATE_STATUSES = ["pass", "attention", "unknown"] as const;
export const COHORT_REASONS = [
  "stage_all",
  "allowlisted_company",
  "allowlisted_user",
  "bucket_below_percent",
  "bucket_above_percent",
  "not_allowlisted",
] as const;

const stageSchema = z.enum(ROLLOUT_STAGES).meta({ id: "LoyaltyRolloutStage" });
const stage = () => stageSchema;

export const rolloutTarget = z.object({
  stage: stage(),
  percent: z.number().int().min(0).max(99),
  allowlistCompanyIds: z.array(uuid()).max(500),
  allowlistUserIds: z.array(uuid()).max(500),
});

export const rolloutChange = rolloutTarget.extend({ reason: z.string().trim().min(10).max(500) });

export const loyaltyRollout = z
  .object({
    current: rolloutTarget.extend({ settingVersionId: uuid(), effectiveFrom: dateTime() }),
    cohort: z.object({
      companies: z.number().int(),
      companiesTotal: z.number().int(),
      usersWithoutCompany: z.number().int(),
      usersWithoutCompanyTotal: z.number().int(),
    }),
    gates: z.array(
      z.object({
        metric: z.enum(ROLLOUT_GATE_METRICS).meta({ id: "RolloutGateMetric" }),
        value: z.string().nullable(),
        target: z.string(),
        direction: z.enum(["min", "max"]),
        status: z.enum(ROLLOUT_GATE_STATUSES).meta({ id: "RolloutGateStatus" }),
        window: z.enum(["3m", "now", "month"]),
      }),
    ),
    pendingAdvance: z
      .object({
        approvalId: uuid(),
        target: rolloutTarget,
        reason: z.string(),
        requestedBy: userRef(),
        requestedAt: dateTime(),
      })
      .nullable(),
    history: z.array(
      z.object({
        settingVersionId: uuid(),
        stage: stage(),
        percent: z.number().int(),
        kind: z.enum(["advance", "rollback", "seed"]),
        reason: z.string().nullable(),
        by: userRef().nullable(),
        approvedBy: userRef().nullable(),
        effectiveFrom: dateTime(),
      }),
    ),
  })
  .meta({ id: "LoyaltyRolloutDto" });

export const cohortLookup = z
  .object({
    key: z.enum(["company", "user"]),
    keyId: uuid(),
    bucket: z.number().int().min(0).max(99),
    inCohort: z.boolean(),
    reason: z.enum(COHORT_REASONS).meta({ id: "CohortReason" }),
  })
  .meta({ id: "LoyaltyCohortLookupDto" });

/* -------------------------------------------------------------------------------- funding analytics */

export const fundingRow = z
  .object({
    promotionId: uuid(),
    name: z.string(),
    productTypeName: z.string(),
    weekStart: date(),
    orders: z.number().int(),
    discountTotal: money(),
    factoryShare: money(),
    getpackShare: money(),
    reversed: money(),
    factoryCount: z.number().int(),
    offersAccepted: z.number().int(),
  })
  .meta({ id: "LoyaltyFundingRowDto" });

export const fundingSplit = z
  .object({
    data: z.array(fundingRow),
    meta: pageMeta.extend({
      totals: z.object({ discountTotal: money(), factoryShare: money(), getpackShare: money() }),
    }),
    asOf: dateTime(),
    currency: z.literal("THB"),
  })
  .meta({ id: "LoyaltyFundingSplitDto" });

const listPage = {
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
};

export const adminLoyaltyP4Requests = {
  "GET /v1/admin/promotions/{promotionId}/cofunding-candidates": request({
    request: "admin.cofunding-offers",
    summary:
      "Active factories with an active capability for the capacity deal's product type (no capacity, utilisation or price)",
    decisions: ["D-506"],
    response: page(offerCandidate),
  }),
  "GET /v1/admin/promotions/{promotionId}/cofunding-offers": request({
    request: "admin.cofunding-offers",
    summary: "The co-funding offers of one capacity deal",
    decisions: ["D-506"],
    query: z.object({ status: offerStatus().optional(), ...listPage }),
    response: page(adminOffer),
  }),
  "POST /v1/admin/promotions/{promotionId}/cofunding-offers": request({
    request: "admin.cofunding-offers",
    summary:
      "Propose a voluntary co-funding offer to one factory (pct of the deal discount or fixed per order, cap, window, respond-by)",
    decisions: ["D-506"],
    idempotent: true,
    status: 201,
    body: offerInput,
    response: adminOffer,
  }),
  "POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw": request({
    request: "admin.cofunding-offers",
    summary: "Withdraw a proposed or accepted offer with a reason; shares already accrued stay",
    decisions: ["D-506"],
    concurrency: true,
    body: z.object({ reason: z.string().trim().min(10).max(500) }),
    response: adminOffer,
  }),
  "GET /v1/admin/cofunding-contributions": request({
    request: "admin.cofunding-contributions",
    summary: "Co-funding contributions, one per order and deal, with their netting on the billing statement",
    decisions: ["D-506"],
    query: z.object({
      promotionId: uuid().optional(),
      offerId: uuid().optional(),
      factoryId: uuid().optional(),
      status: contributionStatus().optional(),
      from: date().optional(),
      to: date().optional(),
      ...listPage,
    }),
    response: page(adminContribution),
  }),
  "GET /v1/admin/loyalty/programme-budget": request({
    request: "admin.programme-budget",
    summary: "The month's programme budget, spend by part, alerts fired and a pending override",
    decisions: ["D-507"],
    query: z.object({ month: month().optional() }),
    response: programmeBudget,
  }),
  "POST /v1/admin/loyalty/programme-budget/overrides": request({
    request: "admin.programme-budget",
    summary:
      "Ask to raise this or next month's budget (approval programme_budget_override: Finance Manager, then C-Level)",
    decisions: ["D-507"],
    idempotent: true,
    status: 202,
    body: z.object({ month: month(), amount: money(), reason: z.string().trim().min(10).max(500) }),
    response: pendingApproval,
  }),
  "GET /v1/admin/loyalty/rollout": request({
    request: "admin.loyalty-rollout",
    summary:
      "The rollout stage in force, cohort size, advisory gate metrics, a pending advance and the last 10 versions",
    decisions: ["D-510"],
    response: loyaltyRollout,
  }),
  "POST /v1/admin/loyalty/rollout/actions/advance": request({
    request: "admin.loyalty-rollout",
    summary: "Propose a rollout that grows the cohort (approval loyalty_rollout_advance: Finance Manager)",
    decisions: ["D-510"],
    idempotent: true,
    status: 202,
    body: rolloutChange,
    response: pendingApproval,
  }),
  "POST /v1/admin/loyalty/rollout/actions/rollback": request({
    request: "admin.loyalty-rollout",
    summary: "Shrink the cohort at once (no approval); an open advance is withdrawn first",
    decisions: ["D-510"],
    idempotent: true,
    body: rolloutChange,
    response: loyaltyRollout,
  }),
  "GET /v1/admin/loyalty/rollout/cohort": request({
    request: "admin.loyalty-rollout",
    summary: "Whether one company or account is in the cohort, its bucket and why (for support)",
    decisions: ["D-510"],
    query: z.object({ companyId: uuid().optional(), userId: uuid().optional() }),
    response: cohortLookup,
  }),
  "GET /v1/admin/loyalty/analytics/funding": request({
    request: "admin.loyalty-analytics.funding",
    summary: "Per capacity deal: orders, discount, factory share, getpack share and reversed (Finance read-only)",
    decisions: ["D-506"],
    query: z.object({ from: month().optional(), to: month().optional(), ...listPage }),
    response: fundingSplit,
  }),
} as const;

export type AdminCofundingOffer = z.infer<typeof adminOffer>;
export type CofundingCandidate = z.infer<typeof offerCandidate>;
export type CofundingOfferInput = z.input<typeof offerInput>;
export type AdminCofundingContribution = z.infer<typeof adminContribution>;
export type CapacityDealFunding = z.infer<typeof capacityDealFunding>;
export type ProgrammeBudget = z.infer<typeof programmeBudget>;
export type ProgrammeBudgetState = (typeof PROGRAMME_BUDGET_STATES)[number];
export type LoyaltyRollout = z.infer<typeof loyaltyRollout>;
export type RolloutTarget = z.infer<typeof rolloutTarget>;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];
export type RolloutGate = LoyaltyRollout["gates"][number];
export type CohortLookup = z.infer<typeof cohortLookup>;
export type FundingSplit = z.infer<typeof fundingSplit>;
export type FundingRow = z.infer<typeof fundingRow>;
