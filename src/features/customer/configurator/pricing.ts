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
 * The published `store.quotes.calculate`: every calculator's own configuration (`./build.ts`), the
 * basis it was entered on (D-182) and the optional target (D-247, answered as `target` per quantity).
 */
export async function calculate(body: CalculateBody, signal?: AbortSignal): Promise<Calculation> {
  const { data } = await browserApi().POST("/v1/store/quotes/actions/calculate", { body, signal });
  return data!;
}

export type SavedQuote = Schemas["SavedQuoteDto"];

/**
 * `store.quotes.save`: keeps a price for its validity (D-051) — `calculate`'s body with the one
 * quantity the customer chose (the saved quotation holds one option per quantity it was given),
 * the target (write-once, D-247) and the Structure Advisor's recommendation when a board was taken
 * from it (D-240; the API refuses a different board).
 */
export async function saveQuote(
  body: CalculateBody & Pick<Schemas["SaveQuoteDto"], "advisoryRecommendationId" | "anonymousId">,
): Promise<SavedQuote> {
  const { data } = await browserApi().POST("/v1/store/quotes", { body });
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
 * `delay` is the pause first (the home page's Studio panel asks after 250 ms — a chip is one click,
 * not a keystroke). The key is the body itself, so the same configuration is never priced twice, and TanStack
 * aborts the request of a configuration the customer has already moved on from (its signal is
 * handed to `fetch`). The previous price stays on screen while the next is fetched, marked as
 * updating, so the dock never flashes empty between keystrokes.
 */
export function useLivePrice(body: CalculateBody | null, delay: number = PRICE_DEBOUNCE_MS) {
  const key = body ? JSON.stringify(body) : null;
  const settledKey = useDebounced(key, delay);
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
