/** The customer list and types, in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";

import { defineList } from "../console/resource";

export type Customer = Schemas["AdminCustomerDto"];
export type CustomerAddress = Schemas["AddressDto"];
export type CustomerTaxProfile = Schemas["TaxProfileDto"];
export type Loyalty = Schemas["LoyaltySummaryDto"];
export type PointsEntry = Schemas["PointsEntryDto"];
export type CustomerConsent = Schemas["AdminConsentDto"];
export type Referral = Schemas["AdminReferralDto"];

/**
 * The customer screen's tabs, for the page to validate `?tab=` against. The referrals tab is the
 * referral list kept to this referrer (`admin.referrals.list?referrerId`, v0.5.0).
 */
export const CUSTOMER_TABS = ["profile", "orders", "points", "referrals", "consents"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

export const customersList = defineList<Customer>({
  key: "customer",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/customers", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.customerCode ?? row.displayName,
  defaults: { filterKeys: ["customerType", "createdVia"] },
});
