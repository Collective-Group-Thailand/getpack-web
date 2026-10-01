import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

/** `null` for the API's 404 or 409 (not this customer's, or not yet possible) — the page says so. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 409)) return null;
    throw error;
  }
}

/** Whether a claim can be filed on the order now, and on what terms (`store.claims.getForm`, D-082). */
export async function getClaimForm(orderId: string): Promise<Schemas["ClaimFormDto"] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/orders/{orderId}/claim-form", { params: { path: { orderId } } })
      .then(({ data }) => data!),
  );
}

/** One of the customer's claims (`store.claims.get`); `null` for anyone else's. */
export async function getMyClaim(claimId: string): Promise<Schemas["StoreClaimDto"] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/claims/{claimId}", { params: { path: { claimId } } })
      .then(({ data }) => data!),
  );
}

/** The same order at today's price, for its past quantity (`store.claims.previewReorder`, D-153). */
export async function getReorder(orderId: string): Promise<Schemas["ReorderPreviewDto"] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/orders/{orderId}/reorder", { params: { path: { orderId } } })
      .then(({ data }) => data!),
  );
}
