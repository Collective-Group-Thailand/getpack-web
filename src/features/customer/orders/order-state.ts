import type { Schemas } from "@/lib/api/types";

type Order = Schemas["OrderDto"];

/** The fields of an order this module reads — so a list row, a detail and a test can all pass one. */
export type OrderStateInput = Pick<
  Order,
  "customerStatus" | "artworkStatus" | "artworkOwner" | "artworkNoteTh" | "deliveryDateBasis" | "payment" | "receipt" | "openClaims"
>;

/** What the customer is told about the artwork step, when the step has a plain next step to explain (D-438). */
export type ArtworkNote = "team_dieline" | "customer_upload" | null;

/**
 * The step owner and the next step in words. Only the two states the "รอแบบไดคัท" split made are
 * explained here; every other artwork state is read from its own chip. The owner is the API's
 * (`artworkOwner`); this only picks which sentence goes with it.
 */
export function artworkNoteOf(order: Pick<OrderStateInput, "artworkStatus" | "artworkOwner">): ArtworkNote {
  if (order.artworkOwner === "team" && order.artworkStatus === "awaiting_template") return "team_dieline";
  if (order.artworkOwner === "customer" && order.artworkStatus === "awaiting_upload") return "customer_upload";
  return null;
}

/**
 * The API's own sentence under the artwork status ("ไฟล์ได้รับแล้ว ทีมงานจะตรวจหลังชำระเงิน"). The
 * contract has Thai only, so other languages show nothing rather than an invented translation; an
 * older API without the field reads as null.
 */
export function artworkNoteTextOf(locale: string, order: { artworkNoteTh?: string | null }): string | null {
  return locale === "th" && order.artworkNoteTh ? order.artworkNoteTh : null;
}

/** An unpaid order's dates are the plan made at placement and may be in the past: the API says so (D-439). */
export function deliveryDatesOf(order: Pick<OrderStateInput, "deliveryDateBasis">): "after_payment" | "planned" {
  return order.deliveryDateBasis === "after_payment" ? "after_payment" : "planned";
}

/** Delivered, not completed, and a claim is open: completion waits for the claim (D-437). */
export function isHeldByClaim(order: Pick<OrderStateInput, "customerStatus" | "receipt" | "openClaims">): boolean {
  return (
    order.receipt.completionHeldByClaim || order.customerStatus === "claim_in_review" || order.openClaims.length > 0
  );
}

/** The auto-confirm date is shown only when the API sent one and no claim holds completion. */
export function showAutoComplete(order: Pick<OrderStateInput, "customerStatus" | "receipt" | "openClaims">): boolean {
  const { receipt } = order;
  return Boolean(receipt.deliveredAt && !receipt.completedAt && receipt.autoCompleteAt) && !isHeldByClaim(order);
}

/** Past the payment deadline and unpaid (D-436): never cancelled — the customer re-quotes, then pays. */
export function isPaymentOverdue(order: Pick<OrderStateInput, "payment">): boolean {
  return order.payment.overdue;
}

/** This order's share and the group's total, shown separately only when the group has more than one order. */
export function paymentShareOf(order: Pick<OrderStateInput, "payment">): {
  orderGross: string;
  groupGross: string;
  shared: boolean;
  groupCode: string;
  groupOrderCount: number;
} {
  const { payment } = order;
  return {
    orderGross: payment.orderGrossAmount,
    groupGross: payment.groupGrossAmount,
    shared: payment.groupOrderCount > 1,
    groupCode: payment.groupCode,
    groupOrderCount: payment.groupOrderCount,
  };
}

/**
 * The actions to draw. The API offers them (`nextActions`, §3 of the account contract); this is a
 * guard for a stale list, never a source: no "ส่งไฟล์งาน" unless the customer owns the artwork step,
 * no "ยืนยันรับของ" while a claim is open.
 */
export function visibleActions<T extends { key: string }>(order: OrderStateInput, actions: readonly T[]): T[] {
  return actions.filter((action) => {
    if (action.key === "order.upload_artwork") return order.artworkOwner === "customer";
    if (action.key === "order.confirm_receipt") return !isHeldByClaim(order);
    return true;
  });
}
