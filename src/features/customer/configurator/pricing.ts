"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import type { CalculateBody } from "./build";

export type Calculation = Schemas["QuoteCalculationDto"];
export type PriceStep = Schemas["QuoteStepDto"];

/** How long the customer must pause before the price is asked for again. */
export const PRICE_DEBOUNCE_MS = 400;

/**
 * The published `store.quotes.calculate` (packio-api B2.3).
 *
 * The one place the storefront's body meets the generated type: for folding it is the published
 * `FoldingConfigurationDto` apart from the quote part's assemblies (the contract kept the wrong
 * `AssemblyDto`); for the six other calculators it is CONTRACT-REQUEST
 * store.quote-configurations. Both are described in `./build.ts`.
 */
export async function calculate(body: CalculateBody, signal?: AbortSignal): Promise<Calculation> {
  const { data } = await browserApi().POST("/v1/store/quotes/actions/calculate", {
    body: body as unknown as Schemas["CalculateQuoteDto"],
    signal,
  });
  return data!;
}

/** `value`, once it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * The live price for a configuration: debounced, and cancelled when it goes stale.
 *
 * The key is the body itself, so the same configuration is never priced twice, and TanStack
 * aborts the request of a configuration the customer has already moved on from (its signal is
 * handed to `fetch`). The previous price stays on screen while the next is fetched, marked as
 * updating, so the dock never flashes empty between keystrokes.
 */
export function useLivePrice(body: CalculateBody | null) {
  const key = body ? JSON.stringify(body) : null;
  const settledKey = useDebounced(key, PRICE_DEBOUNCE_MS);
  const settled = settledKey ? (JSON.parse(settledKey) as CalculateBody) : null;
  const query = useQuery({
    queryKey: [...queryKeys.zone("customer"), "quote-price", settledKey],
    queryFn: ({ signal }) => calculate(settled!, signal),
    enabled: settled !== null,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
  return {
    ...query,
    /** The customer has changed something the shown price does not reflect yet. */
    pending: key !== settledKey || query.isFetching,
  };
}
