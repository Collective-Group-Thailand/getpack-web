/**
 * Every contract request, keyed `"<METHOD> <path template>"` — the same spelling the backend's
 * OpenAPI document uses, so retiring one is a search.
 *
 * Add a domain by adding its file and spreading it in here; `registry.test.ts` then checks the
 * entry is well-formed and not already in the contract.
 */

import { adminConsoleRequests } from "./admin-console";
import { adminCustomerRequests } from "./admin-customers";
import { adminOrderRequests } from "./admin-orders";
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
} as const;

export type Requests = typeof REQUESTS;
export type RequestKey = keyof Requests & string;
