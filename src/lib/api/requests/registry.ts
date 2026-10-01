/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { adminAnalyticsRequests } from "./admin-analytics";
import { adminConsoleRequests } from "./admin-console";
import { adminCustomerRequests } from "./admin-customers";
import { adminFinanceRequests } from "./admin-finance";
import { adminLogisticsRequests } from "./admin-logistics";
import { adminMarketingRequests } from "./admin-marketing";
import { adminOrderRequests } from "./admin-orders";
import { adminPrepressRequests } from "./admin-prepress";
import { adminRfqRequests } from "./admin-rfq";
import { partnerJobRequests } from "./partner-jobs";
import { partnerShipmentRequests } from "./partner-shipments";
import { storeFulfilmentRequests } from "./store-fulfilment";
import { storeSupportRequests } from "./store-support";
import { storeBusinessRequests } from "./store-business";
import { storeCatalogRequests } from "./store-catalog";
import { storeCheckoutRequests } from "./store-checkout";
import { storeDesignRequests } from "./store-designs";
import { storeOrderRequests } from "./store-orders";
import { storeQuoteRequests } from "./store-quotes";
import { storeRfqRequests } from "./store-rfq";

export const REQUESTS = {
  ...adminConsoleRequests,
  ...adminOrderRequests,
  ...adminCustomerRequests,
  ...adminRfqRequests,
  ...adminPrepressRequests,
  ...adminMarketingRequests,
  ...adminLogisticsRequests,
  ...adminAnalyticsRequests,
  ...adminFinanceRequests,
  ...storeCatalogRequests,
  ...storeQuoteRequests,
  ...storeRfqRequests,
  ...storeCheckoutRequests,
  ...storeOrderRequests,
  ...storeFulfilmentRequests,
  ...storeSupportRequests,
  ...storeBusinessRequests,
  ...storeDesignRequests,
  ...partnerJobRequests,
  ...partnerShipmentRequests,
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
