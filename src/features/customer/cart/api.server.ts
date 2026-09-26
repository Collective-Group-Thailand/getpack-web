import "server-only";

import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type Cart = ResponseOf<Requests, "GET /v1/store/cart">;
export type Address = ResponseOf<Requests, "GET /v1/store/me/addresses">["data"][number];
export type TaxProfile = ResponseOf<Requests, "GET /v1/store/me/tax-profiles">["data"][number];

/** The signed-in customer's cart and address book — per customer, never cached. */
export async function getCartAndBook(): Promise<{ cart: Cart; addresses: Address[]; taxProfiles: TaxProfile[] }> {
  const requests = await serverRequests("customer");
  const [cart, addresses, taxProfiles] = await Promise.all([
    requests.call("GET /v1/store/cart"),
    requests.call("GET /v1/store/me/addresses"),
    requests.call("GET /v1/store/me/tax-profiles"),
  ]);
  return { cart, addresses: addresses.data, taxProfiles: taxProfiles.data };
}
