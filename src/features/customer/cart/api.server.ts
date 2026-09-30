import "server-only";

import { getAddressBook } from "@/features/customer/account/api.server";
import type { Address, TaxProfile } from "@/features/customer/account/address";
import { getProductTypes } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { serverApi } from "@/lib/api/server";

import type { Cart } from "./cart";

export type { Address, Cart, TaxProfile };

/**
 * The signed-in customer's cart (`store.cart.get`) and address book — per customer, never cached —
 * plus each product type's name from the public catalogue, since a published cart line names its
 * type only (CONTRACT-GAP store.cart).
 */
export async function getCartAndBook(locale: string): Promise<{
  cart: Cart;
  addresses: Address[];
  taxProfiles: TaxProfile[];
  typeNames: Record<string, string>;
}> {
  const api = await serverApi("customer");
  const [cart, book, types] = await Promise.all([api.GET("/v1/store/cart"), getAddressBook(), getProductTypes()]);
  const typeNames = Object.fromEntries(types.map((type) => [type.code, pick(locale, type.nameTh, type.nameEn)]));
  return { cart: cart.data!, ...book, typeNames };
}
