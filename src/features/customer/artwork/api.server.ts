import "server-only";

import { serverApi } from "@/lib/api/server";

import { loadArtwork, type Artwork } from "./artwork";

/** One of the customer's orders' artwork; `null` for anyone else's (the API's 404). Never cached. */
export async function getMyArtwork(orderId: string): Promise<Artwork | null> {
  return loadArtwork(await serverApi("customer"), orderId);
}
