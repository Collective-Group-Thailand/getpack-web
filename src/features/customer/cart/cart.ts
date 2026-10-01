import type { Schemas } from "@/lib/api/types";

export type Cart = Schemas["CartDto"];
export type CartItem = Schemas["CartItemDto"];

/**
 * What a line itself shows is missing before checkout: a price to confirm, or destinations that do
 * not cover its quantity. Whether the whole cart can be placed is the checkout preview's word
 * (`readyForCheckout` and its blockers moved there, U-B0.1); this only decides what the cart asks for.
 */
export function lineBlockers(item: CartItem): ("reprice" | "destinations")[] {
  return [
    ...(!item.priceLocked || item.pendingReprice ? (["reprice"] as const) : []),
    ...(!item.destinationsComplete ? (["destinations"] as const) : []),
  ];
}
