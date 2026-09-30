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

/* -------------------------------------------------------------------------------- shipments */

/** What the logistics desk knows about a shipment when it decides what to offer. */
export interface AdminShipmentFacts {
  status: Schemas["ShipmentStatus"];
  carrier: Schemas["CarrierCode"];
  hasPod: boolean;
  /** The POD was accepted or rejected in this session (the shipment carries no review state). */
  podReviewed: boolean;
}

export interface AdminShipmentAction {
  key: `shipment.${string}`;
  irreversible?: boolean;
}

/**
 * The actions the logistics desk is offered on a shipment, from its status and what the actor may
 * do (`shipments.manage`).
 *
 * CONTRACT-GAP admin.shipments — `AdminShipmentDto` carries no `allowedActions` (U-B0.2) and no POD
 * review state, so the desk reads the status here: split before pick-up, book a fallback carrier
 * while the factory's own fleet is still named (D-013, D-114), resolve a failed or returned
 * delivery, review a recorded POD. Every action is still the API's to refuse.
 */
export function adminShipmentActions(
  shipment: AdminShipmentFacts,
  can: (permission: string) => boolean,
): AdminShipmentAction[] {
  if (!can("shipments.manage")) return [];
  const actions: AdminShipmentAction[] = [];
  if (shipment.status === "draft" || shipment.status === "ready") actions.push({ key: "shipment.split" });
  if (shipment.status === "ready" && shipment.carrier === "factory_fleet") {
    actions.push({ key: "shipment.book_carrier", irreversible: true });
  }
  if (shipment.status === "failed" || shipment.status === "returned") {
    actions.push({ key: "shipment.resolve_exception" });
  }
  if (shipment.status === "delivered" && shipment.hasPod && !shipment.podReviewed) {
    actions.push({ key: "shipment.accept_pod", irreversible: true }, { key: "shipment.reject_pod" });
  }
  return actions;
}

/* ----------------------------------------------------------------------------------- claims */

/** What the claims desk knows about a claim when it decides what to offer. */
export interface AdminClaimFacts {
  status: Schemas["ClaimStatus"];
}

/** One published claim operation each (`admin.claims.*`), in the order the desk shows them. */
export type AdminClaimActionKey =
  | "claim.resolve"
  | "claim.review"
  | "claim.request_info"
  | "claim.send_to_factory"
  | "claim.approve"
  | "claim.reject"
  | "claim.close"
  | "claim.override_liability";

export interface AdminClaimAction {
  key: AdminClaimActionKey;
  irreversible?: boolean;
}

const BEFORE_DECISION: readonly Schemas["ClaimStatus"][] = ["submitted", "under_review", "need_info", "factory_review"];

/**
 * The actions staff are offered on a claim, from its status and what the actor may do: moving it
 * (`claims.manage`), executing a resolution once approved (`claims.resolve`), and overriding the
 * liability the rule gave, before the decision only (`claims.override_liability`, D-083).
 *
 * CONTRACT-GAP admin.claims — `AdminClaimDto` carries no `allowedActions` (U-B0.2); this follows
 * the D-082 flow. Approving still needs a determined liability, which the API checks
 * (`claims.liability_undetermined`).
 */
export function adminClaimActions(claim: AdminClaimFacts, can: (permission: string) => boolean): AdminClaimAction[] {
  const actions: AdminClaimAction[] = [];
  if (claim.status === "approved" && can("claims.resolve")) actions.push({ key: "claim.resolve", irreversible: true });
  if (can("claims.manage")) {
    if (claim.status === "submitted" || claim.status === "need_info") actions.push({ key: "claim.review" });
    if (claim.status === "under_review") {
      actions.push({ key: "claim.request_info" }, { key: "claim.send_to_factory" });
    }
    if (claim.status === "under_review" || claim.status === "factory_review") {
      actions.push({ key: "claim.approve", irreversible: true });
    }
    if (BEFORE_DECISION.includes(claim.status)) actions.push({ key: "claim.reject", irreversible: true });
    if (claim.status === "approved" || claim.status === "rejected" || claim.status === "resolved") {
      actions.push({ key: "claim.close", irreversible: true });
    }
  }
  if (BEFORE_DECISION.includes(claim.status) && can("claims.override_liability")) {
    actions.push({ key: "claim.override_liability" });
  }
  return actions;
}

/**
 * The resolutions offered for an approved claim, by who is liable (D-083): a factory's fault is
 * re-produced or deducted from its payout, a carrier's is recovered from the carrier, and the
 * customer is refunded or credited in every case.
 *
 * CONTRACT-GAP admin.claims — no `allowedResolutions` on the claim (U-B0.2); the API still refuses
 * one it does not allow (`claims.action_not_allowed`).
 */
export function adminClaimResolutions(liability: Schemas["ClaimLiability"]): Schemas["ClaimAction"][] {
  if (liability === "factory") return ["reproduction_job", "refund", "credit_note", "factory_deduction"];
  if (liability === "carrier") return ["refund", "credit_note", "carrier_recovery"];
  return ["refund", "credit_note", "store_credit"];
}
