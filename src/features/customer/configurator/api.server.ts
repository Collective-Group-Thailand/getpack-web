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

/**
 * The signed-in customer's display unit (D-183, `StoreMeDto.displayUnit`) — what the size step
 * opens in. `mm` for a guest or when the profile cannot be read.
 */
export async function getMyDisplayUnit(): Promise<Schemas["DisplayUnit"]> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/me");
    return data?.displayUnit ?? "mm";
  } catch {
    return "mm";
  }
}

export type Draft = Schemas["ConfigurationDraftDto"];

/** One of the signed-in customer's drafts (`store.configurations.get`); `null` when not theirs or gone. */
export async function getMyDraft(draftId: string): Promise<Draft | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/configurations/{draftId}", { params: { path: { draftId } } });
    return data ?? null;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}

/**
 * The signed-in customer's open drafts of one catalogue product, newest first — so the
 * configurator can offer to carry on where they left off (D-185). A draft names its product by
 * id only (CONTRACT-GAP store.catalog-product-ref), so this is where a draft is resumed from.
 */
export async function listMyDraftsOf(catalogProductId: string): Promise<Draft[]> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/configurations", { params: { query: { perPage: 50 } } });
    return (data?.data ?? []).filter((draft) => draft.catalogProductId === catalogProductId && draft.status === "open");
  } catch (error) {
    if (isApiError(error) && error.status === 401) return [];
    throw error;
  }
}
