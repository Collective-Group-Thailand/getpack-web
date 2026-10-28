import type { CheckoutStep } from "@/lib/analytics/checkout";
import type { Schemas } from "@/lib/api/types";

/**
 * The four steps of buying (checkout redesign Phase 1 item 1): ตะกร้า → ที่อยู่และการจัดส่ง → ใบกำกับภาษีและชำระเงิน →
 * ทบทวนและยืนยัน. The cart is `/cart`; the other three are one page, `/checkout?step=…`, so the checkout preview, the
 * idempotency key and the cart's ETag queue stay with the customer between them. Going back is always allowed; going
 * forward only when every step before it is valid. Which steps are valid is decided here, from what the API said —
 * nothing is priced in the browser.
 */
export const CHECKOUT_STEPS = ["cart", "address", "payment", "review"] as const satisfies readonly CheckoutStep[];
export type { CheckoutStep };
export type CheckoutPageStep = Exclude<CheckoutStep, "cart">;

export function stepHref(step: CheckoutStep): string {
  return step === "cart" ? "/cart" : `/checkout?step=${step}`;
}

/** `?step=` of the checkout page; anything else is its first step. */
export function parseStep(value: string | null | undefined): CheckoutPageStep {
  return value === "payment" || value === "review" ? value : "address";
}

export const stepIndex = (step: CheckoutStep) => CHECKOUT_STEPS.indexOf(step);
export const nextStep = (step: CheckoutStep): CheckoutStep | null => CHECKOUT_STEPS[stepIndex(step) + 1] ?? null;
export const previousStep = (step: CheckoutStep): CheckoutStep | null =>
  stepIndex(step) > 0 ? CHECKOUT_STEPS[stepIndex(step) - 1]! : null;

/** Why a step cannot be left forward — one entry per thing the customer must do (summary "ก่อนไปต่อ"). */
export type BlockerReason =
  | "empty"
  | "reprice"
  | "address"
  | "split_total"
  | "shipping_unavailable"
  | "preview"
  | "po_required"
  | "tax_profile"
  | "terms";

export interface Blocker {
  step: CheckoutStep;
  reason: BlockerReason;
  /** The cart line it is about, when it is about one. */
  itemId?: string;
}

type Cart = { items: readonly Pick<Schemas["CartItemDto"], "destinations">[] };
type Item = Pick<
  Schemas["CartItemDto"],
  "id" | "priceLocked" | "pendingReprice" | "destinations" | "destinationsComplete" | "quantity"
>;

/** Step 1: a cart with something in it whose prices are confirmed. Addresses are step 2's (no longer the cart's). */
export function cartBlockers(cart: { items: readonly Item[] }): Blocker[] {
  if (cart.items.length === 0) return [{ step: "cart", reason: "empty" }];
  return cart.items
    .filter((item) => !item.priceLocked || item.pendingReprice)
    .map((item) => ({ step: "cart", reason: "reprice", itemId: item.id }));
}

/**
 * Step 2: every line delivered in full. With one address (the default) a line misses only its address; split, a
 * line whose rows do not add up to its quantity says so. A preview the API refuses for delivery says why.
 */
export function addressBlockers(
  cart: { items: readonly Item[] },
  split: boolean,
  previewError: string | null,
): Blocker[] {
  const lines: Blocker[] = cart.items
    .filter((item) => !item.destinationsComplete)
    .map((item) => {
      const placed = item.destinations.reduce((sum, destination) => sum + destination.quantity, 0);
      const missingAddress = item.destinations.length === 0 || item.destinations.some((d) => !d.addressId);
      return {
        step: "address",
        reason: split && !missingAddress && placed !== item.quantity ? "split_total" : "address",
        itemId: item.id,
      } as const;
    });
  if (lines.length > 0) return lines;
  if (previewError === "checkout.shipping_unavailable" || previewError === "checkout.rfq_destination_fixed")
    return [{ step: "address", reason: "shipping_unavailable" }];
  return [];
}

/** Step 3: what the company's PO policy asks (D-123) and, with a tax invoice asked for, a chosen tax profile. */
export function paymentBlockers(input: {
  poRequired: boolean;
  poNumber: string;
  taxInvoice: boolean;
  taxProfileId: string | null;
  previewReady: boolean;
}): Blocker[] {
  return [
    ...(input.taxInvoice && !input.taxProfileId ? [{ step: "payment", reason: "tax_profile" } as const] : []),
    ...(input.poRequired && input.poNumber.trim() === "" ? [{ step: "payment", reason: "po_required" } as const] : []),
    ...(!input.previewReady ? [{ step: "payment", reason: "preview" } as const] : []),
  ];
}

export function reviewBlockers(agreed: boolean): Blocker[] {
  return agreed ? [] : [{ step: "review", reason: "terms" }];
}

/** The blockers that keep `step` from going forward: its own and any earlier step's (forward only when valid). */
export function blockersUpTo(step: CheckoutStep, all: readonly Blocker[]): Blocker[] {
  return all.filter((blocker) => stepIndex(blocker.step) <= stepIndex(step));
}

/** The furthest step the customer may open: the first step that still has a blocker (or the last). */
export function furthestStep(all: readonly Blocker[]): CheckoutStep {
  const first = CHECKOUT_STEPS.find((step) => all.some((blocker) => blocker.step === step));
  return first ?? "review";
}

/** One address for every line, or a split (any line over several addresses, or lines to different ones). */
export function isSplit(cart: Cart): boolean {
  const ids = new Set<string | null>();
  for (const item of cart.items) {
    if (item.destinations.length > 1) return true;
    for (const destination of item.destinations) ids.add(destination.addressId);
  }
  return ids.size > 1;
}

/** The address every line goes to, whole, when there is one. */
export function sharedAddressId(cart: Cart): string | null {
  const ids = new Set(
    cart.items.map((item) => (item.destinations.length === 1 ? item.destinations[0]!.addressId : null)),
  );
  const [only] = [...ids];
  return ids.size === 1 && only ? only : null;
}
