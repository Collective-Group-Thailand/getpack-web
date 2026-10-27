"use client";

import { useEffect } from "react";

import { trackProducts } from "@/lib/analytics/products";

/**
 * `products_search` once the server has answered a search (prompt item 15), with the number of
 * matches — a search with none is the point, so `result_count: 0` is sent. Renders nothing.
 */
export function HubTracker({ query, resultCount }: { query: string | null; resultCount: number }) {
  useEffect(() => {
    if (query) trackProducts("products_search", { query, result_count: resultCount });
  }, [query, resultCount]);
  return null;
}
