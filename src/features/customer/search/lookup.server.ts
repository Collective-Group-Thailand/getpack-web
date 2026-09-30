import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { getActor } from "@/lib/auth/actor";

import { mightBeOrderCode, orderCodeOf } from "./match";

export type OrderLookup = Schemas["OrderDto"];

/**
 * The signed-in customer's order with this code (`store.orders.getByCode`), or `null` — for a
 * guest, for a query that is not a code, and for a code that is not theirs (the API answers 404
 * either way). With the customer's own token: never cached, never shared.
 */
export async function findOwnOrder(q: string): Promise<OrderLookup | null> {
  if (!mightBeOrderCode(q)) return null;
  const actor = await getActor("customer");
  if (!actor) return null;
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/orders/by-code/{orderCode}", {
      params: { path: { orderCode: orderCodeOf(q) } },
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}
