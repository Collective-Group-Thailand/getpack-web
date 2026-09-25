/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { adminCompanyRequests } from "./admin-companies";
import { adminConsoleRequests } from "./admin-console";
import { adminCustomerRequests } from "./admin-customers";
import { adminMarketingRequests } from "./admin-marketing";
import { adminOrderRequests } from "./admin-orders";
import { adminPartnerRequests } from "./admin-partners";
import { adminPrepressRequests } from "./admin-prepress";
import { adminRfqRequests } from "./admin-rfq";
import { adminSalesRequests } from "./admin-sales";

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
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
