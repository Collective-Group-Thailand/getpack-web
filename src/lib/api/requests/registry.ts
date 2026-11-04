/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { storeAssistantRequests } from "./store-assistant";
import { storeContentRequests } from "./store-content";
import { storeHomeRequests } from "./store-home";
import { storeLoyaltyRequests } from "./store-loyalty";
import { storeDealsRequests } from "./store-deals";
import { adminPromotionsRequests } from "./admin-promotions";
import { adminStructuralRequests } from "./admin-structural";
import { storeSupportRequests } from "./store-support";

export const REQUESTS = {
  ...storeSupportRequests,
  ...storeContentRequests,
  ...storeAssistantRequests,
  ...storeHomeRequests,
  ...storeLoyaltyRequests,
  ...storeDealsRequests,
  ...adminPromotionsRequests,
  ...adminStructuralRequests,
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
