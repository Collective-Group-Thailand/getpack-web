import "server-only";

import { getAddressBook } from "@/features/customer/account/api.server";
import type { Address, TaxProfile } from "@/features/customer/account/address";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type Cart = ResponseOf<Requests, "GET /v1/store/cart">;
export type { Address, TaxProfile };

/** The signed-in customer's cart and address book — per customer, never cached. */
export async function getCartAndBook(): Promise<{ cart: Cart; addresses: Address[]; taxProfiles: TaxProfile[] }> {
  const requests = await serverRequests("customer");
  const [cart, book] = await Promise.all([requests.call("GET /v1/store/cart"), getAddressBook()]);
  return { cart, ...book };
}
