/**
 * Customers as the back office sees them. The customer, its addresses, tax profiles and points are
 * published (`admin.customers.*`, `admin.loyalty.*`, U-F0.3); what is left here is the staff read
 * of a customer's consent records (PDPA), which packio-api builds in U-B0.2.
 */

import { z } from "zod";

import { dateTime, request } from "./define";

export const customerConsent = z
  .object({
    purpose: z.string(),
    required: z.boolean(),
    /** Latest decision; `null` = never asked. */
    granted: z.boolean().nullable(),
    versionNo: z.number().int().nullable(),
    /** The latest decision was for an older text version. */
    outdated: z.boolean(),
    source: z.enum(["web", "line_liff", "cs", "partner_zone"]).nullable(),
    recordedAt: dateTime().nullable(),
  })
  .meta({ id: "CustomerConsentDto" });

export const adminCustomerRequests = {
  "GET /v1/admin/customers/{customerId}/consents": request({
    request: "admin.customer-consents",
    summary: "The customer's latest decision per consent purpose (PDPA), read-only for staff",
    response: z.array(customerConsent),
  }),
} as const;
