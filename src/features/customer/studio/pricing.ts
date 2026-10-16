"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { useDebounced } from "@/features/customer/configurator/pricing";
import { canonicalJson } from "@/features/designer/lib/json-patch";
import type { BoxFields } from "@/features/designer/data/api";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

export type StudioQuote = Schemas["StudioQuoteDto"];
export type PriceChangeReason = Schemas["PriceChangeReason"];

/** The dock waits this long after the last change before asking for a price (ms). */
export const DOCK_DEBOUNCE_MS = 400;

/** `store.studio.quote` (D-277): the saved version's spec priced, with why it changed since `previousSpecHash`. */
export async function studioQuote(
  designId: string,
  body: Schemas["StudioQuoteRequestDto"],
  signal?: AbortSignal,
): Promise<StudioQuote> {
  const { data } = await browserApi().POST("/v1/store/studio/{designId}/quote", {
    params: { path: { designId } },
    body,
    signal,
  });
  return data!;
}

/**
 * The studio's live price: the version the box was last saved with, at the quantity on the dock.
 *
 * The query is keyed by the **spec** (the box fields and calculator configuration that version
 * holds, canonical JSON) and the quantity — so a version that only moved artwork is never priced
 * again, and going back to a spec already priced is answered from the cache. getpack-api caches by
 * the same spec's `specHash` (D-277). Each request is debounced, and cancelled when it goes stale
 * (its signal is handed to `fetch`). The hash of the price on screen travels as `previousSpecHash`,
 * so the answer explains what changed.
 */
export function useStudioQuote(input: {
  designId: string | null;
  versionNo: number | null;
  box: BoxFields | null;
  quantity: number | null;
  postcode?: string;
}) {
  const shown = useRef<string | null>(null);
  const ready = input.designId && input.versionNo && input.box?.spec && input.quantity;
  const key = ready ? `${canonicalJson(input.box)}|${input.quantity}|${input.postcode ?? ""}` : null;
  const settledKey = useDebounced(key, DOCK_DEBOUNCE_MS);
  const settled = settledKey === key ? input : null;
  const query = useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-quote", input.designId, settledKey],
    queryFn: async ({ signal }) => {
      const quote = await studioQuote(
        settled!.designId!,
        {
          quantities: [settled!.quantity!],
          versionNo: settled!.versionNo!,
          ...(settled!.postcode ? { deliveryPostcode: settled!.postcode } : {}),
          ...(shown.current ? { previousSpecHash: shown.current } : {}),
        },
        signal,
      );
      shown.current = quote.specHash;
      return quote;
    },
    enabled: !!settledKey && !!settled,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60_000,
  });
  return { ...query, pending: key !== settledKey || query.isFetching };
}
