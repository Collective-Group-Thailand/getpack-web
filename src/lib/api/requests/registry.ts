/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { adminAnalyticsRequests } from "./admin-analytics";
import { storeSupportRequests } from "./store-support";
import { storeQuoteRequests } from "./store-quotes";

export const REQUESTS = {
  ...adminAnalyticsRequests,
  ...storeQuoteRequests,
  ...storeSupportRequests,
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
