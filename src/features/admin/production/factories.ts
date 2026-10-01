"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis, useCan } from "../console";

/**
 * The factories as filter options (`admin.factories.list`, `partners.read`), for the board, the
 * inspections and the logistics desk's `?factoryId` filters. A role that may not read partners
 * gets no options, and the screen leaves the filter out.
 */
export function useFactoryOptions(): { value: string; label: string }[] {
  const allowed = useCan("partners.read");
  const factories = useQuery({
    queryKey: queryKeys.list("admin", "factory", { perPage: 100, sort: "code" }),
    enabled: allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories", {
          params: { query: { perPage: 100, sort: "code", order: "asc" } },
        })
      ).data!.data,
    staleTime: STALE_TIME.reference,
  });
  return (factories.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.code} · ${item.tradeName ?? item.legalName}`,
  }));
}
