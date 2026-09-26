/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { adminAnalyticsRequests } from "./admin-analytics";
import { adminCompanyRequests } from "./admin-companies";
import { adminConsoleRequests } from "./admin-console";
import { adminCustomerRequests } from "./admin-customers";
import { adminLogisticsRequests } from "./admin-logistics";
import { adminMarketingRequests } from "./admin-marketing";
import { adminOrderRequests } from "./admin-orders";
import { adminPartnerRequests } from "./admin-partners";
import { adminPrepressRequests } from "./admin-prepress";
import { adminRfqRequests } from "./admin-rfq";
import { adminSalesRequests } from "./admin-sales";
import { storeAccountRequests } from "./store-account";
import { storeArtworkRequests } from "./store-artwork";
import { storeCartRequests } from "./store-cart";
import { storeCatalogRequests } from "./store-catalog";
import { storeCheckoutRequests } from "./store-checkout";
import { storeOrderRequests } from "./store-orders";
import { storeQuoteRequests } from "./store-quotes";
import { storeRfqRequests } from "./store-rfq";

export const REQUESTS = {
  ...adminConsoleRequests,
  ...adminOrderRequests,
  ...adminCustomerRequests,
  ...adminSalesRequests,
  ...adminRfqRequests,
  ...adminPrepressRequests,
  ...adminPartnerRequests,
  ...adminMarketingRequests,
  ...adminCompanyRequests,
  ...adminLogisticsRequests,
  ...adminAnalyticsRequests,
  ...storeCatalogRequests,
  ...storeAccountRequests,
  ...storeQuoteRequests,
  ...storeRfqRequests,
  ...storeCartRequests,
  ...storeCheckoutRequests,
  ...storeOrderRequests,
  ...storeArtworkRequests,
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
