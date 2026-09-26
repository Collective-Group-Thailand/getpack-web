"use client";

import { useQueries } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { adminBrowserApis } from "../console/api";
import { listRows, rowLabel } from "./api";
import { tableByKey } from "./tables";

/**
 * The rows of the tables a screen refers to (a material's family, a finish's group), as
 * `{ value: id, label }` options and an id → label map. One page of 100 per table: reference
 * tables are small, and a reference outside it still renders, as its id.
 */
export function useRefs(tableKeys: readonly string[]) {
  const locale = useLocale();
  const keys = [...new Set(tableKeys)].filter((key) => tableByKey(key));
  const results = useQueries({
    queries: keys.map((key) => ({
      queryKey: queryKeys.list("admin", `catalog_${key.replace(/-/g, "_")}`, { perPage: 100, ref: true }),
      queryFn: () => listRows(adminBrowserApis().contract, tableByKey(key)!.path, { perPage: 100 }),
      staleTime: STALE_TIME.reference,
    })),
  });
  const options: Record<string, { value: string; label: string }[]> = {};
  const labels: Record<string, Map<string, string>> = {};
  keys.forEach((key, index) => {
    const rows = results[index]?.data?.data ?? [];
    options[key] = rows.map((row) => ({ value: row.id, label: rowLabel(row, locale) }));
    labels[key] = new Map(options[key].map((option) => [option.value, option.label]));
  });
  return { options, labels };
}
