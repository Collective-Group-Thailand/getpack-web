/**
 * Loyalty P2: the fields P2 adds to operations that are already published, read from their published responses.
 *
 * The generated types do not know them yet (CONTRACT-REQUEST store.loyalty.p2-fields / admin.loyalty.p2-fields). Each
 * is read here, once: a response without them — an API before P2 — reads as "nothing new" (no reason line, no bundle,
 * no bonus), never as an error. The shapes are the zod schemas' (type-only imports); the checks are plain code, so the
 * deal cards do not pull zod into the storefront's JavaScript (the `/deals` Lighthouse budget). `read.test.ts` holds
 * these readers to the schemas. After `pnpm gen:api --adopt`, they become plain property reads and this file goes.
 */

import type {
  PointsLiabilityMemo,
  PromotionAudience,
  PromotionP2Fields,
  RefAgentP2Fields,
} from "@/lib/api/requests/admin-loyalty-p2";
import type {
  BonusLot,
  CheckoutPointsP2Fields,
  DealBundle,
  DealP2Fields,
  ForYouReason,
  LedgerEntryP2Fields,
  LoyaltySummaryP2Fields,
  PointsMultipliers,
  ReorderSuggestionP2Fields,
} from "@/lib/api/requests/store-loyalty-p2";

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string";
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const MONEY = /^-?\d+\.\d{2}$/;

const FOR_YOU = new Set<ForYouReason>(["new_customer", "tier", "ordered_product_type"]);

function bundleOf(value: unknown): DealBundle | null {
  if (!isObject(value) || !Array.isArray(value.items)) return null;
  const items = value.items.filter(
    (item): item is DealBundle["items"][number] =>
      isObject(item) &&
      isString(item.productTypeCode) &&
      isString(item.productTypeName) &&
      isString(item.summary) &&
      isInt(item.quantity) &&
      isString(item.unit) &&
      isString(item.unitPrice) &&
      MONEY.test(item.unitPrice),
  );
  if (items.length < 2 || items.length !== value.items.length) return null;
  const saving = value.estimatedSaving;
  return { items, estimatedSaving: isString(saving) && MONEY.test(saving) ? saving : null };
}

/** `forYou`, `forYouReason` and `bundle` of a deal; none when the API does not send them. */
export function dealP2Of(deal: object): DealP2Fields {
  const raw = deal as Loose;
  const reason = raw.forYouReason;
  return {
    forYou: raw.forYou === true,
    forYouReason: isString(reason) && FOR_YOU.has(reason as ForYouReason) ? (reason as ForYouReason) : null,
    bundle: bundleOf(raw.bundle),
  };
}

/** The win-back lots and the active campaign count of `store.loyalty.get`. */
export function loyaltySummaryP2Of(summary: object): LoyaltySummaryP2Fields {
  const raw = summary as Loose;
  const lots = Array.isArray(raw.bonusLots)
    ? raw.bonusLots.filter(
        (lot): lot is BonusLot =>
          isObject(lot) &&
          isInt(lot.points) &&
          lot.points > 0 &&
          isString(lot.expiresAt) &&
          ["first_order", "winback", "promotion"].includes(String(lot.reason)),
      )
    : [];
  return { bonusLots: lots, activeCampaigns: isInt(raw.activeCampaigns) ? raw.activeCampaigns : 0 };
}

function multipliersOf(value: unknown): PointsMultipliers | null {
  if (!isObject(value)) return null;
  const keys = ["tier", "paymentMethod", "reorderCampaign", "promotion", "combined"] as const;
  if (!keys.every((key) => isString(value[key])) || typeof value.capped !== "boolean") return null;
  return value as unknown as PointsMultipliers;
}

/** `bonusReason` and `multipliers` of a ledger entry. */
export function ledgerEntryP2Of(entry: object): LedgerEntryP2Fields {
  const raw = entry as Loose;
  const reason = raw.bonusReason;
  return {
    bonusReason: reason === "first_order" || reason === "winback" || reason === "promotion" ? reason : null,
    multipliers: multipliersOf(raw.multipliers),
  };
}

/** The D-492 prediction and the active ×1.5 bonus of a reorder suggestion. */
export function reorderSuggestionP2Of(suggestion: object): ReorderSuggestionP2Fields {
  const raw = suggestion as Loose;
  const day = raw.predictedStockOutOn;
  const bonus = raw.bonus;
  return {
    predictedStockOutOn: isString(day) && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    bonus:
      isObject(bonus) && isString(bonus.multiplier) && isString(bonus.endsAt)
        ? { multiplier: bonus.multiplier, endsAt: bonus.endsAt }
        : null,
  };
}

/** The multipliers and the QR / transfer bonus of the checkout's `points`. */
export function checkoutPointsP2Of(points: object | null | undefined): CheckoutPointsP2Fields {
  const raw = (points ?? {}) as Loose;
  const bonus = raw.paymentBonus;
  return {
    multipliers: multipliersOf(raw.multipliers),
    paymentBonus:
      isObject(bonus) && isString(bonus.multiplier) && Array.isArray(bonus.methods)
        ? { multiplier: bonus.multiplier, methods: bonus.methods.filter(isString) }
        : null,
    toEarnWithPaymentBonus: isInt(raw.toEarnWithPaymentBonus) ? raw.toEarnWithPaymentBonus : null,
  };
}

/** Conditions v2 (audience, bundle count) and display v2 (listing, bundle presets) of an admin `PromotionDto`. */
export function promotionP2Of(promotion: object): {
  audience: PromotionAudience | null;
  cartProductTypeCountGte: number | null;
  listing: "everyone" | "matching_only";
  bundleItems: NonNullable<NonNullable<NonNullable<PromotionP2Fields["display"]>["bundle"]>["items"]>;
} {
  const raw = promotion as Loose;
  const conditions = isObject(raw.conditions) ? raw.conditions : {};
  const display = isObject(raw.display) ? raw.display : {};
  const bundle = isObject(display.bundle) && Array.isArray(display.bundle.items) ? display.bundle.items : [];
  return {
    audience: isObject(conditions.audience) ? (conditions.audience as PromotionAudience) : null,
    cartProductTypeCountGte: isInt(conditions.cartProductTypeCountGte) ? conditions.cartProductTypeCountGte : null,
    listing: display.listing === "matching_only" ? "matching_only" : "everyone",
    bundleItems: bundle.filter(
      (item): item is { productTypeCode: string; configuration: Record<string, unknown>; quantity: number } =>
        isObject(item) && isString(item.productTypeCode) && isObject(item.configuration) && isInt(item.quantity),
    ),
  };
}

/** The performance fields of one `refAgents[]` row; null for an API before P2. */
export function refAgentP2Of(row: object): RefAgentP2Fields | null {
  const raw = row as Loose;
  const counts = ["signups", "customers", "orderGroups", "redemptions"] as const;
  if (!counts.every((key) => isInt(raw[key]))) return null;
  if (!isString(raw.grossAmount) || !isString(raw.discountAmount)) return null;
  return raw as unknown as RefAgentP2Fields;
}

/** The P&L's points-liability memo; null when the API does not send it. */
export function pointsLiabilityOf(report: object | null | undefined): PointsLiabilityMemo | null {
  const memo = (report as Loose | null | undefined)?.pointsLiability;
  if (!isObject(memo)) return null;
  const money = ["faceValue", "estimatedLiability", "ledgerBalance2330", "pointsExpenseInPeriod"] as const;
  if (!money.every((key) => isString(memo[key]) && MONEY.test(memo[key] as string))) return null;
  if (!isInt(memo.outstandingPoints) || !isString(memo.asOf) || !isString(memo.expectedRedemptionRatePct)) return null;
  return memo as unknown as PointsLiabilityMemo;
}
