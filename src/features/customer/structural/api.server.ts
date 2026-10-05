import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type StructuralRequest = Schemas["StructuralRequestDto"];

/** My structural design requests, newest first (`store.structuralRequests.list`, D-273). */
export async function listMyStructuralRequests(): Promise<StructuralRequest[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/structural-requests", {});
  return data ?? [];
}

/** One of my requests, or `null` when it is not mine (404). */
export async function getMyStructuralRequest(requestId: string): Promise<StructuralRequest | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/structural-requests/{requestId}", { params: { path: { requestId } } });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
