import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Basket = Schemas["RfqBasketDto"];

/** My draft basket — one per customer, created on first use (`store.rfqBaskets.getDraft`, D-301). */
export async function getDraftBasket(): Promise<Basket> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/rfq-baskets/draft");
  return data!;
}

/** My baskets, newest first, without discarded drafts (`store.rfqBaskets.list`). */
export async function listBaskets(): Promise<Basket[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/rfq-baskets");
  return data ?? [];
}

export async function getBasket(basketId: string): Promise<Basket | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/rfq-baskets/{basketId}", { params: { path: { basketId } } });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
