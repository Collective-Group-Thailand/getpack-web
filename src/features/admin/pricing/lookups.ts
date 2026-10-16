"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis, useCan } from "../console";

type Named = { id: string; code: string; nameTh: string; nameEn: string };

const named = (locale: string) => (row: Named) => (locale === "en" ? row.nameEn : row.nameTh);

/** Print types of every product type (D-100), for the margin tables' names and pickers. */
export function usePrintTypes() {
  const locale = useLocale();
  const query = useQuery({
    enabled: useCan("catalog.read"),
    queryKey: queryKeys.list("admin", "print_type", { perPage: 100 }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/catalog/print-types", { params: { query: { perPage: 100 } } }))
        .data!,
    staleTime: STALE_TIME.reference,
  });
  const rows = query.data?.data ?? [];
  return {
    rows,
    labelOf: (id: string | null) => {
      const row = id ? rows.find((candidate) => candidate.id === id) : undefined;
      return row ? named(locale)(row) : (id ?? "");
    },
    optionsFor: (productTypeId: string) =>
      rows
        .filter((row) => row.productTypeId === productTypeId)
        .map((row) => ({ value: row.id, label: named(locale)(row) })),
  };
}

/** Difficulty levels (D-005): a margin line may apply to one level only. */
export function useDifficultyLevels() {
  const locale = useLocale();
  const query = useQuery({
    enabled: useCan("catalog.read"),
    queryKey: queryKeys.list("admin", "difficulty_level", { perPage: 100 }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/catalog/difficulty-levels", {
          params: { query: { perPage: 100 } },
        })
      ).data!,
    staleTime: STALE_TIME.reference,
  });
  const rows = query.data?.data ?? [];
  return {
    rows,
    options: rows.map((row) => ({ value: row.id, label: `${named(locale)(row)} (${row.code})` })),
    labelOf: (id: string | null) => {
      const row = id ? rows.find((candidate) => candidate.id === id) : undefined;
      return row ? named(locale)(row) : (id ?? "");
    },
  };
}

/** Re-reads everything the pricing desk shows after a write. */
export function useRefreshPricing() {
  const queryClient = useQueryClient();
  return () => {
    for (const resource of ["sell_margin_table", "payment_schedule_template", "guarantee_policy"]) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
    }
  };
}
