/**
 * Points & Deals P2: the engagement, lifecycle, segment and analytics shapes, from the generated contract
 * (getpack-api `feat/loyalty-p2-lifecycle`, pinned in `contract.lock.json`).
 *
 * Money is a decimal string the web only formats; points are integers; multipliers are the API's decimal strings. The
 * web never computes any of them.
 */

import type { Schemas } from "@/lib/api/types";

/* ---------------------------------------------------------------------------------------------- store */

export type ForYouReason = Schemas["DealForYouReason"];
export type DealBundle = Schemas["DealBundleDto"];
export type DealBundleItem = Schemas["DealBundleItemDto"];
export type DealP2Fields = Pick<Schemas["DealDto"], "forYou" | "forYouReason" | "bundle">;
export type BonusLot = Schemas["BonusLotDto"];
export type LoyaltySummaryP2Fields = Pick<Schemas["LoyaltySummaryDto"], "bonusLots" | "activeCampaigns">;
/** The multipliers behind an order's points (API-CHANGES-P2 deviation 10: the contract's `EntryMultipliersDto`). */
export type PointsMultipliers = Schemas["EntryMultipliersDto"];
export type LedgerEntryP2Fields = Pick<Schemas["PointsEntryDto"], "bonusReason" | "multipliers">;
export type ReorderSuggestionP2Fields = Pick<Schemas["StoreReorderSuggestionDto"], "predictedStockOutOn" | "bonus">;
/**
 * The checkout preview's points. `toEarn` never includes the QR / transfer bonus (no method is declared before
 * payment, API-CHANGES-P2 deviation 2): it is offered as `paymentBonus` + `toEarnWithPaymentBonus`.
 */
export type CheckoutPointsP2Fields = Pick<
  Schemas["PointsPreviewDto"],
  "multipliers" | "paymentBonus" | "toEarnWithPaymentBonus"
>;
export type LoyaltyCampaign = Schemas["LoyaltyCampaignDto"];
export type SurveyInstance = Schemas["SurveyInstanceDto"];
export type SurveyQuestion = Schemas["SurveyQuestionViewDto"];
export type SurveyAnswers = Schemas["SubmitSurveyDto"]["answers"];
export type DataRefresh = Schemas["DataRefreshDto"];
export type ShowcaseConsent = Schemas["ShowcaseConsentDto"];
export type ShowcaseScope = Schemas["ShowcaseScope"];
export type P2TaskCode = Extract<Schemas["LoyaltyTaskCode"], "data_refresh" | "showcase_consent" | "first_sample">;

export const FOR_YOU_REASONS = [
  "new_customer",
  "tier",
  "ordered_product_type",
] as const satisfies readonly ForYouReason[];
export const SHOWCASE_SCOPES = [
  "brand_name",
  "logo",
  "packaging_photos",
  "review_quote",
] as const satisfies readonly ShowcaseScope[];
export const SURVEY_QUESTION_KINDS = [
  "rating",
  "single",
  "multi",
  "text",
] as const satisfies readonly Schemas["SurveyQuestionKind"][];

/* ---------------------------------------------------------------------------------------------- admin */

export type PromotionAudience = Schemas["PromotionAudienceDto"];
export type BundlePresetItem = Schemas["BundlePresetItemDto"];
export type RefAgentP2Fields = Pick<
  Schemas["PromotionRefAgentDto"],
  "signups" | "customers" | "orderGroups" | "grossAmount" | "discountAmount" | "redemptions"
>;
export type PointsLiabilityMemo = Schemas["PointsLiabilityMemoDto"];
export type LoyaltyAnalytics = Schemas["LoyaltyAnalyticsDto"];
export type AgentPerformanceRow = Schemas["AgentPerformanceDto"];
export type AdminLoyaltyCampaign = Schemas["AdminLoyaltyCampaignDto"];
export type SurveyTemplate = Schemas["SurveyTemplateDto"];
export type SurveyTemplateInput = Schemas["CreateSurveyTemplateDto"];
export type SurveyTemplateQuestion = Schemas["SurveyQuestionDto"];
export type SurveyResults = Schemas["SurveyResultsDto"];
export type SurveyTemplateAction = Schemas["SurveyTemplateAction"];

export const LOYALTY_TIERS = ["member", "silver", "gold"] as const satisfies readonly Schemas["LoyaltyTier"][];
/** The audience's business types are the packaging profile's product categories. */
export const BUSINESS_TYPES = [
  "food",
  "beverage",
  "cosmetics",
  "apparel",
  "electronics",
  "ecommerce",
  "industrial",
  "other",
] as const satisfies readonly Schemas["PackagingProductCategory"][];
