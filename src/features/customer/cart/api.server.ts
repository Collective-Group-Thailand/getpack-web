import "server-only";

import { getAddressBook } from "@/features/customer/account/api.server";
import type { Address, TaxProfile } from "@/features/customer/account/address";
import { serverApi } from "@/lib/api/server";

import type { Cart } from "./cart";

export type { Address, Cart, TaxProfile };

/** The signed-in customer's cart (`store.cart.get`) and address book — per customer, never cached. */
export async function getCartAndBook(): Promise<{ cart: Cart; addresses: Address[]; taxProfiles: TaxProfile[] }> {
  const api = await serverApi("customer");
  const [cart, book] = await Promise.all([api.GET("/v1/store/cart"), getAddressBook()]);
  return { cart: cart.data!, ...book };
}
