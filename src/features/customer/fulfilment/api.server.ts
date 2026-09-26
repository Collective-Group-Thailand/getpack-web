import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";

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

export async function getMyClaim(orderId: string, claimId: string) {
  return orNull(
    (await serverRequests("customer")).call("GET /v1/store/orders/{orderId}/claims/{claimId}", {
      path: { orderId, claimId },
    }),
  );
}

export async function getReorder(orderId: string) {
  return orNull(
    (await serverRequests("customer")).call("GET /v1/store/orders/{orderId}/reorder", { path: { orderId } }),
  );
}
