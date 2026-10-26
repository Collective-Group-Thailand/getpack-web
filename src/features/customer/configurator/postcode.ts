"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";

import { POSTCODE } from "./state";

const KEY = "getpack.postcode";

/**
 * The delivery postcode remembered in this browser (U5.1 §1): a convenience for the next
 * configuration, never data. The contract has no account setting for it (`store.me.updatePreferences`
 * takes the display unit only), so a signed-in customer's is kept the same way. Only a complete
 * postcode is kept; storage that is blocked (a private window) simply remembers nothing.
 */
export function rememberedPostcode(next?: string): string | null {
  try {
    if (next !== undefined && POSTCODE.test(next)) window.localStorage.setItem(KEY, next);
    const value = window.localStorage.getItem(KEY);
    return value !== null && POSTCODE.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The area the API resolves a postcode to (`geo/postcodes/{postcode}`): the district and province,
 * the only place name the contract gives for a postcode (the calculation carries no shipping-zone
 * name). One cached read per postcode, shared by the step and the summary.
 */
export function usePostcodeArea(postcode: string) {
  const complete = POSTCODE.test(postcode);
  const lookup = useQuery({
    queryKey: [...queryKeys.zone("customer"), "postcode", postcode],
    queryFn: async ({ signal }) =>
      (
        await browserApi().GET("/v1/store/catalog/geo/postcodes/{postcode}", {
          params: { path: { postcode } },
          signal,
        })
      ).data ?? [],
    enabled: complete,
    staleTime: Infinity,
  });
  return {
    area: lookup.data?.[0] ?? null,
    unknown: complete && lookup.isSuccess && lookup.data.length === 0,
  };
}
