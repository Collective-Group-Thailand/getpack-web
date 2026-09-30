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

/** A company action the desk can offer: the KYC decisions and the status actions (`Schemas["CompanyAction"]`). */
export type AdminCompanyActionKey = "approve-kyc" | "reject-kyc" | Schemas["CompanyAction"];

export interface AdminCompanyAction {
  key: AdminCompanyActionKey;
  /** Suspending and closing are confirmed by typing the company code. */
  destructive?: boolean;
  /** `ReasonDto`: every action but approve-kyc is sent with a reason. */
  needsReason: boolean;
}

/**
 * The actions staff are offered on a B2B company, from its status and what the actor may do.
 *
 * CONTRACT-GAP admin.companies — `AdminCompanyDto` carries no `allowedActions` (packio-api
 * U-B0.2), so the desk reads the status here (D-120): a company under review is approved or sent
 * back (`companies.kyc_review`, as the operations require); an active one can be suspended, a
 * suspended one reactivated, and any open one closed (`companies.manage`). The API still refuses
 * what the workflow does not allow (`companies.invalid_status`, `companies.kyc_incomplete`).
 */
export function adminCompanyActions(
  status: Schemas["CompanyStatus"],
  can: (permission: string) => boolean,
): AdminCompanyAction[] {
  const actions: AdminCompanyAction[] = [];
  if (status === "kyc_review" && can("companies.kyc_review")) {
    actions.push({ key: "approve-kyc", needsReason: false }, { key: "reject-kyc", needsReason: true });
  }
  if (can("companies.manage")) {
    if (status === "active") actions.push({ key: "suspend", destructive: true, needsReason: true });
    if (status === "suspended") actions.push({ key: "reactivate", needsReason: true });
    if (status !== "closed") actions.push({ key: "close", destructive: true, needsReason: true });
  }
  return actions;
}

/* ---------------------------------------------------------------------------------------- RFQs */

/** What the back office knows about an RFQ when it decides what to offer (from `StaffRfqDto`). */
export interface AdminRfqFacts {
  status: Schemas["RfqStatus"];
  /** A draft quotation version exists (at most one, D-100). */
  hasDraft: boolean;
  /** A line of the draft is below the margin floor (D-012). */
  draftBelowMarginFloor: boolean;
  /** A version was sent to the customer and still stands. */
  hasSent: boolean;
  /** The customer's acceptance made a saved quotation (`acceptedQuoteId`). */
  hasAcceptedQuotation: boolean;
}

export type AdminRfqBlock = "below_margin_floor";

export interface AdminRfqAction {
  key: `rfq.${string}`;
  irreversible?: boolean;
  blockedBy?: AdminRfqBlock;
}

const RFQ_OPEN: readonly Schemas["RfqStatus"][] = ["submitted", "in_review", "need_info"];

/**
 * The actions staff are offered on an RFQ, from its facts and what the actor may do.
 *
 * CONTRACT-GAP entity.next-actions — the published `StaffRfqDto` carries no `nextActions`
 * (packio-api U-B0.3), so the RFQ desk reads the status here, in one place, and offers what the
 * B2.5 workflow would: `submitted → in_review → need_info → quoted → accepted | declined`. Every
 * RFQ action needs `rfqs.manage` (the operations' `x-required-permissions`); ordering from the
 * accepted quotation is CS create-order (`carts.manage_on_behalf`). It only decides which buttons
 * to show: every action is still the API's to refuse. Delete this when the RFQ carries its own list.
 */
export function adminRfqActions(rfq: AdminRfqFacts, can: (permission: string) => boolean): AdminRfqAction[] {
  const actions: AdminRfqAction[] = [];
  if (rfq.status === "accepted") {
    if (rfq.hasAcceptedQuotation && can("carts.manage_on_behalf")) actions.push({ key: "rfq.create_order" });
    return actions;
  }
  if (!can("rfqs.manage")) return actions;
  // Sending a draft priced under the floor waits for approval (D-012), so it is offered blocked.
  const send: AdminRfqAction = {
    key: "rfq.send_quote",
    irreversible: true,
    ...(rfq.draftBelowMarginFloor ? { blockedBy: "below_margin_floor" as const } : {}),
  };
  const compose: AdminRfqAction = { key: rfq.hasDraft ? "rfq.edit_quote" : "rfq.compose_quote" };
  switch (rfq.status) {
    case "submitted":
      actions.push({ key: "rfq.start_review" }, { key: "rfq.assign" }, { key: "rfq.request_info" });
      break;
    case "in_review":
    case "need_info":
      if (rfq.hasDraft) actions.push(send);
      actions.push({ key: "rfq.request_factory_cost" }, compose, { key: "rfq.request_info" }, { key: "rfq.assign" });
      break;
    case "quoted":
      if (rfq.hasSent) actions.push({ key: "rfq.record_acceptance", irreversible: true });
      if (rfq.hasDraft) actions.push(send);
      actions.push(compose, { key: "rfq.assign" });
      break;
    default:
      break;
  }
  if (RFQ_OPEN.includes(rfq.status) || rfq.status === "quoted")
    actions.push({ key: "rfq.decline", irreversible: true });
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

/* ------------------------------------------------------------------------------------ prepress */

/** What the prepress workspace knows about an order's artwork when it decides what to offer. */
export interface AdminPrepressFacts {
  artworkStatus: Schemas["ArtworkStatus"];
  /** The newest artwork submission's status, `null` before the first one. */
  latestSubmission: Schemas["SubmissionStatus"] | null;
  /** The newest proof's status, `null` before the first one. */
  latestProof: Schemas["ProofStatus"] | null;
  /** The hired design's status, `null` when the order did not hire one (or it is not found). */
  designService: Schemas["DesignServiceStatus"] | null;
}

export interface AdminPrepressAction {
  key: `prepress.${string}`;
  irreversible?: boolean;
}

/**
 * The actions prepress is offered on an order's workspace (F2 2.4, B4.1).
 *
 * CONTRACT-GAP admin.prepress — no workspace aggregate and no `nextActions` are published; the
 * workspace is composed from the artwork, proof, template and design-service resources, so what it
 * offers is read here from their statuses, in one place: a proof once the newest file is accepted
 * and no proof waits (D-070), a design round while one is in progress, a requote while the design
 * is open (D-071), the template while the order waits for it or for files. Assigning is still a
 * request (`admin.prepress-actions`). Every action stays the API's to refuse.
 */
export function adminPrepressActions(
  facts: AdminPrepressFacts,
  can: (permission: string) => boolean,
): AdminPrepressAction[] {
  const actions: AdminPrepressAction[] = [];
  const review = can("prepress.review");
  const design = can("design_services.manage");
  if (
    review &&
    facts.latestSubmission === "accepted_for_proof" &&
    (facts.latestProof === null || facts.latestProof === "changes_requested")
  ) {
    actions.push({ key: "prepress.upload_proof", irreversible: true });
  }
  if (design && facts.designService === "in_progress") {
    actions.push({ key: "prepress.deliver_round", irreversible: true });
  }
  if (review && (facts.artworkStatus === "awaiting_template" || facts.artworkStatus === "awaiting_upload")) {
    actions.push({ key: "prepress.send_template", irreversible: true });
  }
  // Routine and exceptional actions follow the stage's own work, so neither leads the header.
  if (review) actions.push({ key: "prepress.assign" });
  if (can("drawings.generate")) actions.push({ key: "prepress.draw_dieline" });
  if (design && (facts.designService === "in_progress" || facts.designService === "revision_requested")) {
    actions.push({ key: "prepress.requote_design", irreversible: true });
  }
  return actions;
}

/** Why a submission cannot be accepted yet — a code the screen puts into words. */
export type AdminSubmissionBlock = "preflight_blocked" | "preflight_pending";

export interface AdminSubmissionAction {
  key: "submission.accept" | "submission.reject";
  blockedBy?: AdminSubmissionBlock;
}

/**
 * Accept or send back one artwork submission (D-070): only a submitted file, only for
 * `prepress.review`. A blocking preflight result cannot be accepted, nor one still running —
 * packio-api answers `artwork.preflight_blocked` / `artwork.preflight_pending` to both.
 */
export function adminSubmissionActions(
  submission: Pick<Schemas["ArtworkSubmissionDto"], "status" | "preflightStatus">,
  can: (permission: string) => boolean,
): AdminSubmissionAction[] {
  if (submission.status !== "submitted" || !can("prepress.review")) return [];
  const blockedBy: AdminSubmissionBlock | undefined =
    submission.preflightStatus === "blocked"
      ? "preflight_blocked"
      : submission.preflightStatus === "pending" || submission.preflightStatus === "running"
        ? "preflight_pending"
        : undefined;
  return [{ key: "submission.accept", ...(blockedBy ? { blockedBy } : {}) }, { key: "submission.reject" }];
}

export interface AdminDesignActions {
  /** Saving in the designer (`admin.designs.save`, `catalog.manage`). */
  save: boolean;
  /** Making a staff copy (a request, `admin.design-documents`). */
  copy: boolean;
}

/**
 * What staff may do with a design opened in the back office (F4 C.2).
 *
 * CONTRACT-GAP admin.design-documents — the published design carries no `editable` flag and no
 * owner, and saving is allowed only on the staff author's own designs. The designer is therefore
 * editable for whoever holds the save permission, and packio-api refuses a save on anyone else's
 * design (the designer shows the failed save). Copying is offered to prepress.
 */
export function adminDesignActions(can: (permission: string) => boolean): AdminDesignActions {
  return { save: can("catalog.manage"), copy: can("prepress.review") };
}
