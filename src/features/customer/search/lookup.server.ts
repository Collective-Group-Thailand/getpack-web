import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";
import type { ResponseOf, Requests } from "@/lib/api/requests";
import { getActor } from "@/lib/auth/actor";

import { mightBeOrderCode, orderCodeOf } from "./match";

export type OrderLookup = ResponseOf<Requests, "GET /v1/store/orders/by-code/{orderCode}">;

/**
 * The signed-in customer's order with this code, or `null` — for a guest, for a query that is
 * not a code, and for a code that is not theirs (the API answers 404 either way). With the
 * customer's own token: never cached, never shared.
 */
export async function findOwnOrder(q: string): Promise<OrderLookup | null> {
  if (!mightBeOrderCode(q)) return null;
  const actor = await getActor("customer");
  if (!actor) return null;
  try {
    const requests = await serverRequests("customer");
    return await requests.call("GET /v1/store/orders/by-code/{orderCode}", { path: { orderCode: orderCodeOf(q) } });
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}
