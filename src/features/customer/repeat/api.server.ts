import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Suggestion = Schemas["ReorderSuggestionDto"];
export type CallOff = Schemas["CallOffAgreementDto"];
export type CustomerDocument = Schemas["CustomerDocumentDto"];

/** When to order again, per product type, with why (`store.reorderSuggestions.list`, D-288). */
export async function listSuggestions(): Promise<Suggestion[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/reorder-suggestions");
  return data ?? [];
}

/** My call-off agreements with their releases (`store.callOffs.list`, D-290). */
export async function listCallOffs(): Promise<CallOff[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/call-off-agreements");
  return data ?? [];
}

export async function getCallOff(agreementId: string): Promise<CallOff | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/call-off-agreements/{agreementId}", {
      params: { path: { agreementId } },
    });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** My latest documents (tax invoices, receipts, notes), newest first (`store.documents.list`). */
export async function latestDocuments(count = 5): Promise<CustomerDocument[]> {
  const { data } = await (
    await serverApi("customer")
  ).GET("/v1/store/documents", {
    params: { query: { perPage: count, sort: "documentDate", order: "desc" } },
  });
  return data?.data ?? [];
}
