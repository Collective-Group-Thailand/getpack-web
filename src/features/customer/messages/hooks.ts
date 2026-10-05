"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { uploadFile } from "@/features/shared/files/upload";
import type { Draft } from "@/features/shared/conversations/ThreadView";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

/** `conversation.*` realtime events invalidate this key (src/lib/realtime/events.ts); polling is the fallback. */
export const threadKey = (id: string) => queryKeys.related("customer", "conversation", id, "messages");

/** A thread's messages, oldest first (the API pages newest first). Reading moves my read position. */
export function useThreadMessages(conversationId: string) {
  return useQuery({
    queryKey: threadKey(conversationId),
    queryFn: async () => {
      const { data } = await browserApi().GET("/v1/store/conversations/{conversationId}/messages", {
        params: { path: { conversationId }, query: { limit: 100 } },
      });
      return [...(data?.data ?? [])].reverse();
    },
    refetchInterval: 20_000,
  });
}

export function usePostMessage(conversationId: string) {
  const client = useQueryClient();
  return async (draft: Draft & { contextCard?: Schemas["ContextCardInputDto"] }) => {
    await browserApi().POST("/v1/store/conversations/{conversationId}/messages", {
      params: { path: { conversationId }, header: { "Idempotency-Key": newIdempotencyKey() } },
      body: {
        ...(draft.body ? { body: draft.body } : {}),
        ...(draft.fileIds.length ? { fileIds: draft.fileIds } : {}),
        ...(draft.contextCard ? { contextCard: draft.contextCard } : {}),
      },
    });
    await client.invalidateQueries({ queryKey: threadKey(conversationId) });
  };
}

/** Attachments go up as `evidence` (private, scanned — D-300 keeps them in the files module). */
export async function uploadAttachment(file: File) {
  const uploaded = await uploadFile("customer", file, "evidence");
  return { id: uploaded.id, name: file.name };
}
