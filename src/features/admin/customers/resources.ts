/** The customer list and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type { customerConsent } from "@/lib/api/requests/admin-customers";
import type { Schemas } from "@/lib/api/types";

import { defineList } from "../console/resource";

export type Customer = Schemas["AdminCustomerDto"];
export type CustomerAddress = Schemas["AddressDto"];
export type CustomerTaxProfile = Schemas["TaxProfileDto"];
export type Loyalty = Schemas["LoyaltySummaryDto"];
export type PointsEntry = Schemas["PointsEntryDto"];
export type CustomerConsent = z.output<typeof customerConsent>;

/**
 * The customer screen's tabs, for the page to validate `?tab=` against. There is no referrals
 * tab: the published referral list cannot be filtered by referrer (CONTRACT-GAP admin.referrals),
 * so a customer's own referrals cannot be listed without listing everyone's.
 */
export const CUSTOMER_TABS = ["profile", "orders", "points", "consents"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

export const customersList = defineList<Customer>({
  key: "customer",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/customers", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.customerCode ?? row.displayName,
  // CONTRACT-GAP admin.customers: no customerType / createdVia filters on the published list.
});
