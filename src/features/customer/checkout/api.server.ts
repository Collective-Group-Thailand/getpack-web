import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type Payment = ResponseOf<Requests, "GET /v1/store/payments/{paymentId}">;

/** One of the customer's payments; `null` for another customer's (the API's 404). */
export async function getMyPayment(paymentId: string): Promise<Payment | null> {
  try {
    return await (await serverRequests("customer")).call("GET /v1/store/payments/{paymentId}", { path: { paymentId } });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
