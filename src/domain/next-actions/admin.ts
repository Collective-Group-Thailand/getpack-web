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
