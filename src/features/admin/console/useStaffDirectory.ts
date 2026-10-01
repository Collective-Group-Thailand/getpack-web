"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis } from "./api";

/** Characters a name search needs before the API takes it (`admin.staffDirectory.list`, `q` ≥ 2). */
const MIN_QUERY = 2;

/**
 * Active staff by name for a picker (`admin.staffDirectory.list`, D-140): assign a queue item,
 * delegate an approval, @mention a colleague. Any staff member may read it, and it carries no
 * contact details. `permission` keeps only the people who hold it, so nobody certain to be
 * refused is offered. A one-letter query is not sent as a filter: the API needs two.
 */
export function useStaffDirectory({ q, permission, limit = 20 }: { q: string; permission?: string; limit?: number }) {
  const name = q.trim().length >= MIN_QUERY ? q.trim() : undefined;
  return useQuery({
    queryKey: queryKeys.list("admin", "staff_directory", { q: name, permission, limit }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/staff-directory", {
          params: { query: { q: name, permission, limit } },
        })
      ).data!,
    staleTime: STALE_TIME.reference,
  });
}
