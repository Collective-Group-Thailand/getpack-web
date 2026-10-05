import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Thread = Schemas["StoreThreadDto"];

/** My threads, latest activity first (`store.conversations.list`, D-300). */
export async function listThreads(): Promise<Thread[]> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/conversations");
  return data ?? [];
}

/** One of my threads, or null when it is not mine (the API answers 404 either way). */
export async function getThread(conversationId: string): Promise<Thread | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/conversations/{conversationId}", { params: { path: { conversationId } } });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
