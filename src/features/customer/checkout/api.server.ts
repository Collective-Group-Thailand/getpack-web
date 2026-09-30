import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Payment = Schemas["PaymentDto"];

/** One of the customer's payments (`store.payments.get`); `null` for another customer's (the API's 404). */
export async function getMyPayment(paymentId: string): Promise<Payment | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/payments/{paymentId}", {
      params: { path: { paymentId } },
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
