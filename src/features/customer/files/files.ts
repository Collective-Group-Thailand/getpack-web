"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";

/** A signed URL lasts minutes (api-conventions §3); ask again well before it lapses. */
const FRESH_MS = 2 * 60_000;

/** A file of the customer's through `store.files.download`, re-signed while the page stays open. */
export function useFileUrl(fileId: string | null | undefined): string | null {
  return (
    useQuery({
      queryKey: queryKeys.related("customer", "files", fileId ?? "none", "download"),
      queryFn: async () =>
        (await browserApi().GET("/v1/store/files/{fileId}/download", { params: { path: { fileId: fileId! } } })).data!
          .url,
      enabled: Boolean(fileId),
      staleTime: FRESH_MS,
      refetchInterval: FRESH_MS,
    }).data ?? null
  );
}
