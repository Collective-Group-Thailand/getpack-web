"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { useCan } from "./actor";
import { adminBrowserApis } from "./api";

/**
 * The product types of D-100 from the published catalogue (`GET /v1/admin/catalog/product-types`,
 * B2.1), as `{ value: code, label }` in the current locale — for filters and pickers that must
 * offer exactly the types the catalogue holds, never a list of our own. It needs `catalog.read`;
 * without it the list is empty and a caller leaves its filter out.
 */
export function useProductTypes() {
  const locale = useLocale();
  const allowed = useCan("catalog.read");
  const query = useQuery({
    enabled: allowed,
    queryKey: queryKeys.list("admin", "product_type", { perPage: 100 }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/catalog/product-types", {
          params: { query: { perPage: 100 } },
        })
      ).data!,
    staleTime: STALE_TIME.reference,
  });
  const types = query.data?.data ?? [];
  const options = types.map((type) => ({ value: type.code, label: locale === "en" ? type.nameEn : type.nameTh }));
  return {
    ...query,
    types,
    options,
    /** The type's name, or its code while the list loads or when the role cannot read the catalogue. */
    labelOf: (code: string) => options.find((option) => option.value === code)?.label ?? code,
  };
}
