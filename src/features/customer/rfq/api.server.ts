import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type StoreRfq = ResponseOf<Requests, "GET /v1/store/rfqs/{rfqId}">;
export type StoreRfqList = ResponseOf<Requests, "GET /v1/store/rfqs">;
export type StoreRfqMessage = ResponseOf<Requests, "GET /v1/store/rfqs/{rfqId}/messages">["data"][number];

/** The signed-in customer's RFQs — never cached: one customer's data (`catalog/api.server.ts`). */
export async function listMyRfqs(page = 1): Promise<StoreRfqList> {
  return (await serverRequests("customer")).call("GET /v1/store/rfqs", { query: { page, perPage: 20 } });
}

/** One of their RFQs with its thread; `null` when it is not theirs (the API's 404). */
export async function getMyRfq(rfqId: string): Promise<{ rfq: StoreRfq; messages: StoreRfqMessage[] } | null> {
  const requests = await serverRequests("customer");
  try {
    const [rfq, messages] = await Promise.all([
      requests.call("GET /v1/store/rfqs/{rfqId}", { path: { rfqId } }),
      requests.call("GET /v1/store/rfqs/{rfqId}/messages", { path: { rfqId } }),
    ]);
    return { rfq, messages: messages.data };
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
