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
