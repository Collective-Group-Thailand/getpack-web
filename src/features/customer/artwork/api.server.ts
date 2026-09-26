import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";

import type { Artwork } from "./ArtworkWorkspace";

export { designerHrefOf } from "./designer";

/** One of the customer's orders' artwork; `null` for anyone else's (the API's 404). Never cached. */
export async function getMyArtwork(orderId: string): Promise<Artwork | null> {
  try {
    return await (
      await serverRequests("customer")
    ).call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId } });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
