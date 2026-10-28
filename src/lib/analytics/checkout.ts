import { pushToDataLayer } from "./datalayer";

/**
 * The cart and checkout steps (checkout redesign Phase 1 item 7) — through the same channel as the catalogue's
 * events (GLOBAL-RULES §5): GTM's `dataLayer`, only once the visitor accepted analytics (`pk_consent`). The D-102
 * funnel events (`checkout_started`, `order_placed`) still go to getpack-api through `track`. Nothing identifies a
 * person: a step, a quantity, a payment method and plan, why the step is blocked — never a name, address or tax id.
 */
export type CheckoutStep = "cart" | "address" | "payment" | "review";

export interface CheckoutEvents {
  /** A step was shown. */
  checkout_step_view: { step: CheckoutStep };
  /** A cart line took another quantity (stepper or typed). */
  checkout_qty_change: { from: number; to: number };
  /** "เปลี่ยนเป็น n" on the tier hint. */
  checkout_tier_hint_accept: { from: number; to: number };
  /** "บันทึกไว้ทีหลัง": the line left the cart; its quotation stays saved in the account. */
  checkout_save_for_later: { productType: string };
  /** "แบ่งส่งหลายที่อยู่" turned on or off. */
  checkout_split_toggle: { on: boolean };
  /** "ขอใบกำกับภาษีเต็มรูปแบบ" turned on or off. */
  checkout_tax_invoice_toggle: { on: boolean };
  /** A payment method was chosen; `plan` is the schedule the rules chose (D-020), not a customer choice. */
  checkout_payment_select: { method: string; plan: string };
  /** A discount code was entered. */
  checkout_code_apply: { result: "validated" | "rejected" | "error" };
  /** The primary action was pressed while the step was blocked, with the first reason. */
  checkout_blocked: { step: CheckoutStep; reason: string };
  /** "ยืนยันคำสั่งซื้อและชำระเงิน" was confirmed. */
  checkout_confirm: { method: string | null; plan: string };
}

export type CheckoutEventName = keyof CheckoutEvents;

export function trackCheckout<K extends CheckoutEventName>(event: K, properties: CheckoutEvents[K]): void {
  pushToDataLayer(event, properties);
}
