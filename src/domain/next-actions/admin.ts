import type { Schemas } from "@/lib/api/types";

/** What the back office knows about an order when it decides what to offer. */
export interface AdminOrderFacts {
  status: Schemas["OrderStatus"];
  artworkStatus: Schemas["ArtworkStatus"];
  /** A slip of the order's group waits for Finance (read from the slip queue, `payments.verify_slip`). */
  slipToReview: boolean;
}

/** Why an offered action cannot be taken yet — a code the screen puts into words. */
export type AdminOrderBlock = "artwork_not_approved";

export interface AdminOrderAction {
  key: `order.${string}`;
  irreversible?: boolean;
  blockedBy?: AdminOrderBlock;
}

const BEFORE_PRODUCTION: readonly Schemas["OrderStatus"][] = [
  "waiting_payment",
  "paid_for_production",
  "artwork_approved",
];

/**
 * The actions staff are offered on an order, from its facts and what the actor may do.
 *
 * CONTRACT-GAP entity.next-actions — the published `AdminOrderDto` carries no `nextActions`
 * (packio-api delivers them in U-B0.3), so until then the order desk reads the status here, in one
 * place, and offers what the workflow would (D-060 cancel before production, D-061 slip review,
 * D-073 manual start as an exception). It only decides which buttons to show: every action is
 * still the API's to refuse, and the problem it answers is shown. Delete this when the order
 * carries its own list.
 */
export function adminOrderActions(order: AdminOrderFacts, can: (permission: string) => boolean): AdminOrderAction[] {
  const actions: AdminOrderAction[] = [];
  if (order.slipToReview && can("payments.verify_slip")) {
    actions.push({ key: "order.approve_slip", irreversible: true }, { key: "order.reject_slip" });
  }
  if (order.status === "waiting_payment" && can("orders.manage")) {
    actions.push({ key: "order.send_payment_reminder" }, { key: "order.record_slip", irreversible: true });
  }
  if (
    (order.status === "paid_for_production" || order.status === "artwork_approved") &&
    can("production.start_manual")
  ) {
    actions.push({
      key: "order.start_production",
      irreversible: true,
      ...(order.artworkStatus === "approved" ? {} : { blockedBy: "artwork_not_approved" as const }),
    });
  }
  if (BEFORE_PRODUCTION.includes(order.status) && can("orders.cancel")) {
    actions.push({ key: "order.cancel", irreversible: true });
  }
  return actions;
}

/**
 * A lifecycle action on a campaign or a promotion, as the published operations name them
 * (`activate | pause | end`). `activate` on a paused one resumes it, so the screen words it
 * "resume" — the contract has no separate `resume` (triage `admin.campaigns`, `admin.promotions`).
 */
export interface AdminLifecycleAction {
  action: Schemas["PromotionAction"];
  resumes?: boolean;
}

const CAMPAIGN_LIFECYCLE: Record<Schemas["CampaignStatus"], readonly Schemas["PromotionAction"][]> = {
  draft: ["activate"],
  scheduled: ["pause", "end"],
  active: ["pause", "end"],
  paused: ["activate", "end"],
  exhausted: ["end"],
  ended: [],
};

const PROMOTION_LIFECYCLE: Record<Schemas["PromotionStatus"], readonly Schemas["PromotionAction"][]> = {
  draft: ["activate"],
  active: ["pause", "end"],
  paused: ["activate", "end"],
  ended: [],
};

const lifecycle = (actions: readonly Schemas["PromotionAction"][], paused: boolean): AdminLifecycleAction[] =>
  actions.map((action) => (paused && action === "activate" ? { action, resumes: true } : { action }));

/**
 * The actions a campaign offers (D-154), from its status and `campaigns.manage`.
 *
 * CONTRACT-GAP admin.campaigns — `CampaignDto` carries no `allowedActions` (packio-api U-B0.2), so
 * the campaign screen decides here what the workflow allows. An exhausted campaign is reopened by
 * raising its budget, not by an action. The API still refuses what it will not do.
 */
export function adminCampaignActions(
  status: Schemas["CampaignStatus"],
  can: (permission: string) => boolean,
): AdminLifecycleAction[] {
  return can("campaigns.manage") ? lifecycle(CAMPAIGN_LIFECYCLE[status], status === "paused") : [];
}

/**
 * The actions a promotion offers (D-053), from its status and `promotions.manage`.
 *
 * CONTRACT-GAP admin.promotions — `PromotionDto` carries no `allowedActions` (packio-api U-B0.2).
 * A coupon promotion without codes is still offered `activate`: the API answers
 * `promotions.no_codes`, and the screen shows it.
 */
export function adminPromotionActions(
  status: Schemas["PromotionStatus"],
  can: (permission: string) => boolean,
): AdminLifecycleAction[] {
  return can("promotions.manage") ? lifecycle(PROMOTION_LIFECYCLE[status], status === "paused") : [];
}

/**
 * What can be done to one coupon code (`admin.promotions.setCouponStatus`): an active code can be
 * disabled (leaked, misused), a disabled one enabled again; a used-up code has nothing left to
 * stop. Never on an ended promotion, and only with `promotions.manage`.
 */
export function adminCouponActions(
  coupon: { status: Schemas["CouponStatus"] },
  promotionStatus: Schemas["PromotionStatus"],
  can: (permission: string) => boolean,
): Schemas["CouponAction"][] {
  if (promotionStatus === "ended" || !can("promotions.manage")) return [];
  if (coupon.status === "active") return ["disable"];
  return coupon.status === "disabled" ? ["enable"] : [];
}
