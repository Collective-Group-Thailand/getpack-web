import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type SavedQuote = Schemas["SavedQuoteDto"];

/** One of the signed-in customer's quotations (`store.quotes.get`); `null` when it is not theirs or gone. */
export async function getMyQuote(quoteId: string): Promise<SavedQuote | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/quotes/{quoteId}", {
      params: { path: { quoteId } },
    });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}
