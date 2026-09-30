import type { Schemas } from "@/lib/api/types";

export type Cart = Schemas["CartDto"];
export type CartItem = Schemas["CartItemDto"];

/**
 * Whether a line can go to checkout, from what the line itself says (CONTRACT-GAP store.cart: the
 * published cart has no `readyForCheckout` or blockers). The checkout preview is still the word
 * that counts — it refuses a cart that is not ready — so this only decides what the page asks for.
 */
export function lineBlockers(item: CartItem): ("reprice" | "destinations")[] {
  return [
    ...(!item.priceLocked || item.pendingReprice ? (["reprice"] as const) : []),
    ...(!item.destinationsComplete ? (["destinations"] as const) : []),
  ];
}
