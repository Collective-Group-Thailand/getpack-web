"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { adminBrowserApis } from "../console";

/**
 * The style families the library holds — what a studio template may name in `styleFamilies`
 * (packio-api refuses any other, D-282). Read from the bases, every page.
 */
export function useStyleFamilies() {
  return useQuery({
    queryKey: queryKeys.list("admin", "style_family", {}),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const api = adminBrowserApis().contract;
      const families = new Set<string>();
      for (let page = 1; ; page++) {
        const { data } = await api.GET("/v1/admin/styles", { params: { query: { page, perPage: 100 } } });
        for (const style of data!.data) families.add(style.family);
        if (page * data!.meta.perPage >= data!.meta.total) break;
      }
      return [...families].sort();
    },
  });
}
