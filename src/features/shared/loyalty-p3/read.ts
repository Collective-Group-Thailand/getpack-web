/**
 * Loyalty P3: the fields P3 adds to operations that are already published, read from their published responses.
 *
 * The generated types do not know them yet (CONTRACT-REQUEST store.loyalty.p3-fields / admin.loyalty.p3-fields). Each
 * is read here, once: a response without them — an API before P3 — reads as "nothing new" (no perks, no multiplier
 * list, a manual v1 promotion, a credit with no uplift), never as an error. The shapes are the zod schemas' (type-only
 * imports); the checks are plain code so no screen pulls zod into its JavaScript. `read.test.ts` holds them to the
 * schemas. After `pnpm gen:api --adopt`, they become plain property reads and this file goes (as P2's did).
 */

import type {
  CampaignAudience,
  CapacityDealRef,
  CreditOrigin,
  CreditUplift,
  CreditVersionP3Fields,
  LoyaltyCampaignListP3Fields,
  PromotionOrigin,
  PromotionP3Fields,
} from "@/lib/api/requests/admin-loyalty-p3";
import type {
  ActiveMultiplier,
  LoyaltyPerk,
  LoyaltySummaryP3Fields,
  LoyaltyTierP3,
} from "@/lib/api/requests/store-loyalty-p3";

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string";
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const MONEY = /^-?\d+\.\d{2}$/;
const money = (value: unknown) => (isString(value) && MONEY.test(value) ? value : null);
const stringOrNull = (value: unknown) => (isString(value) ? value : null);

const TIERS = new Set<LoyaltyTierP3>(["member", "silver", "gold", "platinum"]);
const tierOf = (value: unknown): LoyaltyTierP3 | null =>
  TIERS.has(value as LoyaltyTierP3) ? (value as LoyaltyTierP3) : null;

const PERK_CODES = new Set<LoyaltyPerk["code"]>([
  "quarterly_free_shipping",
  "free_shipping_every_order",
  "priority_support",
  "quarterly_free_rush",
  "priority_production_slot",
]);
const PERK_STATUSES = new Set<LoyaltyPerk["status"]>(["active", "granted", "used", "next_quarter"]);
const MULTIPLIER_SOURCES = new Set<ActiveMultiplier["source"]>([
  "tier",
  "anniversary",
  "campaign",
  "reorder",
  "payment",
]);

function perksOf(value: unknown): LoyaltyPerk[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((perk): LoyaltyPerk[] => {
    if (!isObject(perk) || !PERK_CODES.has(perk.code as LoyaltyPerk["code"])) return [];
    if (!PERK_STATUSES.has(perk.status as LoyaltyPerk["status"])) return [];
    return [
      {
        code: perk.code as LoyaltyPerk["code"],
        status: perk.status as LoyaltyPerk["status"],
        ...(isString(perk.period) ? { period: perk.period } : {}),
        ...(isString(perk.redemptionId) ? { redemptionId: perk.redemptionId } : {}),
        ...(isString(perk.couponExpiresAt) ? { couponExpiresAt: perk.couponExpiresAt } : {}),
      },
    ];
  });
}

function multipliersOf(value: unknown): ActiveMultiplier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ActiveMultiplier[] => {
    if (!isObject(item) || !MULTIPLIER_SOURCES.has(item.source as ActiveMultiplier["source"])) return [];
    if (!isString(item.multiplier)) return [];
    return [
      {
        source: item.source as ActiveMultiplier["source"],
        multiplier: item.multiplier,
        ...(isString(item.name) ? { name: item.name } : {}),
        ...(isString(item.endsOn) ? { endsOn: item.endsOn } : {}),
        ...(isString(item.endsAt) ? { endsAt: item.endsAt } : {}),
      },
    ];
  });
}

export type LoyaltySummaryP3 = LoyaltySummaryP3Fields & { tier: LoyaltyTierP3; nextTier: LoyaltyTierP3 | null };

/** `store.loyalty.get`'s P3 fields, and `tier` / `nextTier` widened to Platinum. */
export function loyaltyP3Of(summary: object): LoyaltySummaryP3 {
  const raw = summary as Loose;
  const month = raw.anniversaryMonth;
  return {
    tier: tierOf(raw.tier) ?? "member",
    nextTier: tierOf(raw.nextTier),
    perks: perksOf(raw.perks),
    nextTierPerks: perksOf(raw.nextTierPerks),
    activeMultipliers: multipliersOf(raw.activeMultipliers),
    maxCombinedMultiplier: isString(raw.maxCombinedMultiplier) ? raw.maxCombinedMultiplier : "3.00",
    anniversaryMonth: isInt(month) && month >= 1 && month <= 12 ? month : null,
    rewardCoupons: isInt(raw.rewardCoupons) && raw.rewardCoupons >= 0 ? raw.rewardCoupons : 0,
  };
}

const ORIGINS = new Set<PromotionOrigin>(["manual", "system", "capacity_deal"]);
const APPROVALS = new Set(["pending", "approved", "rejected", "withdrawn"]);

function capacityDealOf(value: unknown): CapacityDealRef | null {
  if (!isObject(value) || !isString(value.weekStart) || !isString(value.productTypeCode) || !isString(value.freePct))
    return null;
  const approval = value.approval;
  return {
    weekStart: value.weekStart,
    productTypeCode: value.productTypeCode,
    freePct: value.freePct,
    approval:
      isObject(approval) && isString(approval.id) && APPROVALS.has(approval.status as string)
        ? { id: approval.id, status: approval.status as NonNullable<CapacityDealRef["approval"]>["status"] }
        : null,
  };
}

/** `PromotionDto`'s P3 fields: a promotion without them is a manual v1 promotion. */
export function promotionP3Of(promotion: object): PromotionP3Fields {
  const raw = promotion as Loose;
  return {
    benefitSchemaVersion: raw.benefitSchemaVersion === 2 ? 2 : 1,
    origin: ORIGINS.has(raw.origin as PromotionOrigin) ? (raw.origin as PromotionOrigin) : "manual",
    capacityDeal: capacityDealOf(raw.capacityDeal),
  };
}

/** A benefit's v2 fields, whatever its published type says. */
export function benefitV2FieldsOf(benefit: object): { daysSaved: number | null; addonCode: string | null } {
  const raw = benefit as Loose;
  return {
    daysSaved: isInt(raw.daysSaved) ? raw.daysSaved : null,
    addonCode: stringOrNull(raw.addonCode),
  };
}

const CREDIT_ORIGINS = new Set<CreditOrigin>(["request", "tier_uplift", "tier_uplift_override"]);
const MODES = new Set<CreditUplift["mode"]>(["auto", "frozen", "off"]);

/** A credit-limit version's P3 fields: without them, a version is a request (as every version before P3). */
export function creditVersionP3Of(version: object): CreditVersionP3Fields {
  const raw = version as Loose;
  return {
    origin: CREDIT_ORIGINS.has(raw.origin as CreditOrigin) ? (raw.origin as CreditOrigin) : "request",
    baseVersionId: stringOrNull(raw.baseVersionId),
    upliftFactor: stringOrNull(raw.upliftFactor),
    companyTier: tierOf(raw.companyTier),
  };
}

/** `AdminCompanyCreditDto.uplift`; null when the API sends none (before P3, or no uplift data). */
export function creditUpliftOf(credit: object): CreditUplift | null {
  const value = (credit as Loose).uplift;
  if (!isObject(value) || !MODES.has(value.mode as CreditUplift["mode"])) return null;
  const spend = money(value.companySpend12m);
  if (spend === null) return null;
  return {
    mode: value.mode as CreditUplift["mode"],
    modeReason: stringOrNull(value.modeReason),
    baseLimit: money(value.baseLimit),
    companyTier: tierOf(value.companyTier),
    companySpend12m: spend,
    target: money(value.target),
    capped: value.capped === true,
    aboveCapTarget: money(value.aboveCapTarget),
  };
}

function audienceOf(value: unknown): CampaignAudience | null {
  if (!isObject(value)) return null;
  const strings = (list: unknown) => (Array.isArray(list) ? list.filter(isString) : undefined);
  const tiers = strings(value.tiers)?.filter((tier): tier is LoyaltyTierP3 => TIERS.has(tier as LoyaltyTierP3));
  return {
    ...(value.newCustomer === true ? { newCustomer: true } : {}),
    ...(tiers?.length ? { tiers } : {}),
    ...(strings(value.businessTypes)?.length ? { businessTypes: strings(value.businessTypes) } : {}),
    ...(isInt(value.inactiveDaysGte) ? { inactiveDaysGte: value.inactiveDaysGte } : {}),
    ...(strings(value.orderedProductTypeCodes)?.length
      ? { orderedProductTypeCodes: strings(value.orderedProductTypeCodes) }
      : {}),
  };
}

const CAMPAIGN_KINDS = new Set(["reorder_bonus", "winback", "admin", "admin_rule", "anniversary"]);

/** `admin.loyaltyCampaigns.list` items' P3 fields; the P2 kinds read as they were. */
export function campaignP3Of(row: object): Required<LoyaltyCampaignListP3Fields> {
  const raw = row as Loose;
  const creator = raw.createdBy;
  return {
    kind: (CAMPAIGN_KINDS.has(raw.kind as string)
      ? raw.kind
      : "admin") as Required<LoyaltyCampaignListP3Fields>["kind"],
    name: stringOrNull(raw.name),
    productTypeCodes: Array.isArray(raw.productTypeCodes) ? raw.productTypeCodes.filter(isString) : null,
    audience: audienceOf(raw.audience),
    createdBy:
      isObject(creator) && isString(creator.id) && isString(creator.displayName)
        ? { id: creator.id, displayName: creator.displayName }
        : null,
  };
}
