import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";
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

export async function getClaimForm(orderId: string) {
  return orNull(
    (await serverRequests("customer")).call("GET /v1/store/orders/{orderId}/claim-form", { path: { orderId } }),
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

export async function getReorder(orderId: string) {
  return orNull(
    (await serverRequests("customer")).call("GET /v1/store/orders/{orderId}/reorder", { path: { orderId } }),
  );
}
