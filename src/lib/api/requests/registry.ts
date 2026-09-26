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
import { storeCatalogRequests } from "./store-catalog";

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
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
