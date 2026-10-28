/**
 * Free shipping (owner, C2b 2026-10-28, DECISIONS-STAGE-A §15.4): a priced shipment whose amount the API sends as
 * exactly `"0.00"` reads "ส่งฟรี" / "Free shipping" instead of "฿0.00". A string comparison on the API value — no
 * arithmetic — and never for a shipment that is pending or unpriced (`null` / missing stays the caller's own text).
 */
export function isFreeShipping(amount: string | null | undefined): boolean {
  return amount === "0.00";
}

/** The shipping amount as shown: the free label for `"0.00"`, else whatever `thb` makes of the amount (incl. null). */
export function shippingAmountText<T extends string | null | undefined>(
  amount: T,
  thb: (amount: T) => string,
  freeLabel: string,
): string {
  return isFreeShipping(amount) ? freeLabel : thb(amount);
}
