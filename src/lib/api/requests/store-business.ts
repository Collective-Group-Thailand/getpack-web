/**
 * Packio for business, from the company's side (F3 3.7; B3.5, B5.2, D-120–D-125).
 *
 * The back office's companies desk (`admin.companies.*`, F2 2.7) holds the same rows: a company
 * that signs up here is the one Finance reviews for KYC, a credit application is the limit request
 * the `credit_limit` policy routes, and the statements are the ones the desk issues. What the
 * company sees is its own: its members and their roles, its branches, what waits for its
 * approver, its credit and what it owes.
 *
 * Every figure is the API's: available credit, aging buckets, overdue days, whether credit orders
 * are blocked (D-122) and whether an order needs the company's approver (D-123).
 */

import { z } from "zod";

import { dateTime, fileRef, money, request, uuid } from "./define";

/* ---------------------------------------------------------------------------------- company */

export const companyRole = z
  .enum(["company_admin", "company_buyer", "company_approver", "company_accountant"])
  .meta({ id: "CompanyRole" });

export const companyMember = z
  .object({
    id: uuid(),
    user: z.object({ id: uuid(), displayName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
    roles: z.array(companyRole),
    status: z.enum(["invited", "active", "removed"]),
    joinedAt: dateTime().nullable(),
  })
  .meta({ id: "CompanyMemberDto" });

export const creditApplication = z
  .object({
    id: uuid(),
    status: z.enum(["submitted", "approved", "rejected"]).meta({ id: "CreditApplicationStatus" }),
    requestedLimit: money(),
    termDays: z.number().int(),
    basis: z.enum(["paid_orders", "financial_review"]).meta({ id: "CreditApplicationBasis" }),
    submittedAt: dateTime(),
    decidedAt: dateTime().nullable(),
    /** What Finance said, in words. */
    note: z.string().nullable(),
    approvedLimit: money().nullable(),
  })
  .meta({ id: "CreditApplicationDto" });

export const brandAsset = z
  .object({
    id: uuid(),
    kind: z.enum(["logo", "guideline", "font", "artwork", "other"]).meta({ id: "BrandAssetKind" }),
    name: z.string(),
    file: fileRef(),
    uploadedBy: z.string(),
    uploadedAt: dateTime(),
  })
  .meta({ id: "BrandAssetDto" });

export const companySpend = z
  .object({
    months: z.number().int(),
    total: money(),
    ordersCount: z.number().int(),
    byMonth: z.array(z.object({ month: z.string(), amount: money() })),
    byMember: z.array(z.object({ name: z.string(), amount: money(), orders: z.number().int() })),
    byBranch: z.array(z.object({ name: z.string(), amount: money() })),
    byProductType: z.array(z.object({ name: z.string(), amount: money() })),
  })
  .meta({ id: "CompanySpendDto" });

export const bulkReorderPreview = z
  .object({
    rows: z.array(
      z.object({
        line: z.number().int(),
        orderCode: z.string(),
        quantity: z.number().int().nullable(),
        status: z.enum(["ok", "error"]).meta({ id: "BulkReorderRowStatus" }),
        message: z.string().nullable(),
        product: z.string().nullable(),
        grossAmount: money().nullable(),
      }),
    ),
    okCount: z.number().int(),
    errorCount: z.number().int(),
    grossAmount: money(),
    /** Hands the rows shown to `bulk-reorders`; only the `ok` rows are added. */
    previewToken: z.string(),
  })
  .meta({ id: "BulkReorderPreviewDto" });

/* ----------------------------------------------------------------------------------- requests */

export const storeBusinessRequests = {
  "PATCH /v1/store/me/company/members/{memberId}": request({
    request: "store.company-members",
    summary: "Change a member's roles; the last admin cannot be demoted (409 company.last_admin)",
    body: z.object({ roles: z.array(companyRole).min(1) }),
    response: companyMember,
  }),
  "GET /v1/store/me/company/brand-assets": request({
    request: "store.company-assets",
    summary: "The company's shared brand assets — logos, guidelines, fonts, approved artwork",
    response: z.object({ data: z.array(brandAsset) }),
  }),
  "POST /v1/store/me/company/brand-assets": request({
    request: "store.company-assets",
    summary: "Share an uploaded file with every member as a brand asset",
    body: z.object({ fileId: uuid(), kind: brandAsset.shape.kind, name: z.string().trim().min(1).max(120) }),
    response: brandAsset,
    status: 201,
  }),
  "DELETE /v1/store/me/company/brand-assets/{assetId}": request({
    request: "store.company-assets",
    summary: "Stop sharing a brand asset",
    response: z.object({ removed: z.literal(true) }),
  }),
  "POST /v1/store/me/company/credit-applications": request({
    request: "store.company-credit",
    summary: "Apply for a credit limit and term (D-121); Finance or C-Level decides by amount",
    decisions: ["D-121"],
    body: z.object({
      requestedLimit: money(),
      termDays: z.number().int(),
      basis: creditApplication.shape.basis,
      financialStatementFileIds: z.array(uuid()).max(5).optional(),
    }),
    response: creditApplication,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/me/company/spend": request({
    request: "store.company-spend",
    summary: "What the company spent: by month, member, branch and product type",
    query: z.object({ months: z.coerce.number().int().min(1).max(24).optional() }),
    response: companySpend,
  }),
  "POST /v1/store/me/company/bulk-reorders/actions/preview": request({
    request: "store.company-reorder",
    summary: "Check CSV rows (order number, quantity) for a bulk reorder: each row re-priced or refused with why",
    decisions: ["D-153"],
    body: z.object({
      rows: z
        .array(
          z.object({ line: z.number().int(), orderCode: z.string().max(40), quantity: z.number().int().nullable() }),
        )
        .min(1)
        .max(200),
    }),
    response: bulkReorderPreview,
  }),
  "POST /v1/store/me/company/bulk-reorders": request({
    request: "store.company-reorder",
    summary: "Add the checked rows to the cart as reorder quotations",
    decisions: ["D-153"],
    body: z.object({ previewToken: z.string() }),
    response: z.object({ cartItemIds: z.array(uuid()) }),
    status: 201,
    idempotent: true,
  }),
} as const;
