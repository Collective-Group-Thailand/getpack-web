import "server-only";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type SavedQuote = ResponseOf<Requests, "GET /v1/store/quotes/{quoteId}">;

/** One of the signed-in customer's quotations; `null` when it is not theirs or gone. */
export async function getMyQuote(quoteId: string): Promise<SavedQuote | null> {
  try {
    return await (await serverRequests("customer")).call("GET /v1/store/quotes/{quoteId}", { path: { quoteId } });
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}
