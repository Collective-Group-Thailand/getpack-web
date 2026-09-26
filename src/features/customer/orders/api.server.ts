import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type OrderSummary = ResponseOf<Requests, "GET /v1/store/orders">["data"][number];
export type OrderDetail = ResponseOf<Requests, "GET /v1/store/orders/{orderId}">;
export type OrderView = "active" | "completed" | "cancelled";

/** The customer's orders — one customer's data, never cached. */
export async function listMyOrders(view?: OrderView, page = 1) {
  return (await serverRequests("customer")).call("GET /v1/store/orders", {
    query: { ...(view ? { view } : {}), page, perPage: 20 },
  });
}

/** One of their orders; `null` for anyone else's (the API's 404). */
export async function getMyOrder(orderId: string): Promise<OrderDetail | null> {
  try {
    return await (await serverRequests("customer")).call("GET /v1/store/orders/{orderId}", { path: { orderId } });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
