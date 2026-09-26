/** The customer list and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type { customerConsent, customerDetail, customerSummary, pointsEntry } from "@/lib/api/requests/admin-customers";

import { defineList } from "../console/resource";

export type CustomerSummary = z.output<typeof customerSummary>;
export type Customer = z.output<typeof customerDetail>;
export type PointsEntry = z.output<typeof pointsEntry>;
export type CustomerConsent = z.output<typeof customerConsent>;

/** The customer screen's tabs, for the page to validate `?tab=` against. */
export const CUSTOMER_TABS = ["profile", "orders", "points", "referrals", "consents"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

export const customersList = defineList<CustomerSummary>({
  key: "customer",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/customers", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.customerCode,
  defaults: { filterKeys: ["customerType", "createdVia"] },
});
