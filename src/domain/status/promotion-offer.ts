import { defineStatusMap } from "./types";
import type { PromotionOfferStatus } from "./contract";

/** A promotion code as the customer holds it (`PromotionOfferDto.status`, D-053). */
export const PROMOTION_OFFER_STATUS = defineStatusMap<PromotionOfferStatus>({
  usable: { tone: "success", icon: "ticket", labelKey: "promotionOffer.usable" },
  not_started: { tone: "info", icon: "calendar", labelKey: "promotionOffer.notStarted" },
  not_applicable: { tone: "neutral", icon: "info", labelKey: "promotionOffer.notApplicable" },
  used_up: { tone: "neutral", icon: "check", labelKey: "promotionOffer.usedUp" },
  expired: { tone: "neutral", icon: "archive", labelKey: "promotionOffer.expired" },
  budget_exhausted: { tone: "neutral", icon: "coins", labelKey: "promotionOffer.budgetExhausted" },
  inactive: { tone: "neutral", icon: "pause", labelKey: "promotionOffer.inactive" },
  disabled: { tone: "neutral", icon: "ban", labelKey: "promotionOffer.disabled" },
  not_yours: { tone: "warning", icon: "lock", labelKey: "promotionOffer.notYours" },
});
