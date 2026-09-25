/**
 * Customers as the back office sees them (F2 2.2 CS create-order, 2.7 customers), from the
 * schema design's `customer_profiles`, `customer_addresses` and `tax_profiles` (§3.6).
 */

import { z } from "zod";

import { date, dateTime, listQuery, page, request, uuid } from "./define";

export const customerType = z.enum(["individual", "juristic", "government"]).meta({ id: "CustomerType" });
export const creationChannel = z.enum(["self", "cs", "line_liff"]).meta({ id: "CreationChannel" });

export const customerSummary = z
  .object({
    id: uuid(),
    customerCode: z.string(),
    displayName: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    customerType,
    companyName: z.string().nullable(),
    createdVia: creationChannel,
    ordersCount: z.number().int(),
    createdAt: dateTime(),
  })
  .meta({ id: "CustomerSummaryDto" });

export const customerAddress = z
  .object({
    id: uuid(),
    kind: z.enum(["delivery", "billing"]).meta({ id: "AddressKind" }),
    label: z.string(),
    recipientName: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    subdistrict: z.string().nullable(),
    district: z.string().nullable(),
    province: z.string(),
    postcode: z.string(),
    isDefault: z.boolean(),
  })
  .meta({ id: "CustomerAddressDto" });

export const taxProfile = z
  .object({
    id: uuid(),
    taxType: customerType,
    name: z.string(),
    taxId: z.string(),
    branchType: z.enum(["head_office", "branch"]).meta({ id: "BranchType" }),
    branchCode: z.string(),
    address: z.string(),
    withholdsTax: z.boolean(),
    isDefault: z.boolean(),
  })
  .meta({ id: "TaxProfileDto" });

export const customerDetail = customerSummary
  .extend({
    addresses: z.array(customerAddress),
    taxProfiles: z.array(taxProfile),
    referralCode: z.string(),
    loyalty: z.object({
      tier: z.enum(["member", "silver", "gold"]).meta({ id: "LoyaltyTier" }),
      availablePoints: z.number().int(),
      spend12m: z.string(),
    }),
    lastOrderAt: dateTime().nullable(),
    birthDate: date().nullable(),
  })
  .meta({ id: "CustomerDetailDto" });

export const createCustomer = z
  .object({
    displayName: z.string().min(1).max(200),
    phone: z.string().regex(/^0\d{8,9}$/),
    email: z.string().email().optional(),
    customerType,
  })
  .meta({ id: "CreateCustomerDto" });

export const createAddress = customerAddress
  .omit({ id: true, isDefault: true, subdistrict: true, district: true })
  .extend({
    subdistrict: z.string().optional(),
    district: z.string().optional(),
    isDefault: z.boolean().optional(),
  });

export const postcodeLookup = z
  .object({
    postcode: z.string(),
    province: z.string(),
    districts: z.array(z.object({ name: z.string(), subdistricts: z.array(z.string()) })),
  })
  .meta({ id: "PostcodeLookupDto" });

export const adminCustomerRequests = {
  "GET /v1/admin/customers": request({
    request: "admin.customers",
    summary: "Customers by name, phone, e-mail or customer code",
    query: listQuery({ customerType: customerType.optional(), createdVia: creationChannel.optional() }),
    response: page(customerSummary),
  }),
  "POST /v1/admin/customers": request({
    request: "admin.customers",
    summary: "CS creates a customer on their behalf (creation channel `cs`); a customer code is issued",
    body: createCustomer,
    response: customerSummary,
    status: 201,
  }),
  "GET /v1/admin/customers/{customerId}": request({
    request: "admin.customers",
    summary: "One customer with addresses, tax profiles and loyalty standing",
    response: customerDetail,
  }),
  "POST /v1/admin/customers/{customerId}/addresses": request({
    request: "admin.customers",
    summary: "Add a delivery or billing address for a customer",
    body: createAddress,
    response: customerAddress,
    status: 201,
  }),
  "GET /v1/admin/geo/postcodes/{postcode}": request({
    request: "admin.geo",
    summary: "Province, districts and subdistricts for a postcode (admin-maintained geography, D-161)",
    decisions: ["D-161"],
    response: postcodeLookup,
  }),
} as const;
