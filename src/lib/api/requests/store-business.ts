/**
 * Packio for business, from the company's side (F3 3.7; B3.5, B5.2, D-120–D-125).
 *
 * The back office's companies desk (`admin-companies.ts`, F2 2.7) holds the same rows: a company
 * that signs up here is the one Finance reviews for KYC, a credit application is the limit request
 * the `credit_limit` policy routes, and the statements are the ones the desk issues. What the
 * company sees is its own: its members and their roles, its branches, what waits for its
 * approver, its credit and what it owes.
 *
 * Every figure is the API's: available credit, aging buckets, overdue days, whether credit orders
 * are blocked (D-122) and whether an order needs the company's approver (D-123).
 */

import { z } from "zod";

import {
  companyBranch,
  companyKycDocType,
  companyKycStatus,
  companyMember,
  companyReceivables,
  companyRole,
  companyStatement,
  companyStatus,
  creditStatus,
  poNumberPolicy,
} from "./admin-companies";
import { dateTime, fileRef, money, page, pct, request, uuid } from "./define";
import { checkoutInput } from "./store-checkout";
import { signedUrl } from "./store-quotes";

/* ---------------------------------------------------------------------------------- company */

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

export const companyNotice = z
  .object({
    /** D-122: 7 days before, on the due date, and overdue (credit orders blocked after 7 days). */
    kind: z.enum(["due_soon", "due_today", "overdue", "credit_blocked"]).meta({ id: "CompanyNoticeKind" }),
    statementId: uuid().nullable(),
    period: z.string().nullable(),
    amount: money(),
    dueAt: dateTime().nullable(),
    daysOverdue: z.number().int(),
  })
  .meta({ id: "CompanyNoticeDto" });

export const storeCompany = z
  .object({
    id: uuid(),
    companyCode: z.string(),
    legalName: z.string(),
    taxId: z.string(),
    status: companyStatus,
    isVatRegistered: z.boolean(),
    /** The signed-in member's roles in this company. */
    myRoles: z.array(companyRole),
    /** What those roles allow here — the API's reading of them. */
    can: z.object({
      manageMembers: z.boolean(),
      manageSettings: z.boolean(),
      approveOrders: z.boolean(),
      viewFinance: z.boolean(),
      order: z.boolean(),
    }),
    poNumberPolicy,
    /** D-123: orders above it wait for the approver; `null` = no approval step. */
    orderApprovalThreshold: money().nullable(),
    /** D-124: the company's agreed discount, when there is one. */
    discountPct: pct().nullable(),
    credit: z.object({
      status: creditStatus,
      limitAmount: money(),
      availableAmount: money(),
      termDays: z.number().int().nullable(),
      /** D-121: eligible after 3 paid orders or a financial-statement review. */
      eligible: z.boolean(),
      paidOrdersCount: z.number().int(),
      paidOrdersNeeded: z.number().int(),
      /** The terms Finance offers (setting `b2b.credit_terms`). */
      allowedTerms: z.array(z.number().int()),
      application: creditApplication.nullable(),
    }),
    receivables: companyReceivables,
    notices: z.array(companyNotice),
    kyc: z.array(
      z.object({
        docType: companyKycDocType,
        status: companyKycStatus,
        note: z.string().nullable(),
        uploadedAt: dateTime(),
      }),
    ),
    /** Why the company is not active yet, in words, while KYC is under review or was returned. */
    statusNote: z.string().nullable(),
  })
  .meta({ id: "StoreCompanyDto" });

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

export const companyApproval = z
  .object({
    id: uuid(),
    requestNo: z.string(),
    status: z.enum(["pending", "approved", "rejected", "expired"]).meta({ id: "CompanyApprovalStatus" }),
    requestedBy: z.object({ id: uuid(), displayName: z.string() }),
    requestedAt: dateTime(),
    grossAmount: money(),
    /** The company threshold it went over (D-123). */
    threshold: money(),
    poNumber: z.string().nullable(),
    branch: z.string().nullable(),
    items: z.array(z.object({ name: z.string(), quantity: z.number().int(), unit: z.string(), grossAmount: money() })),
    scheduleLabel: z.string(),
    note: z.string().nullable(),
    decidedBy: z.object({ id: uuid(), displayName: z.string() }).nullable(),
    decidedAt: dateTime().nullable(),
    reason: z.string().nullable(),
    /** Once approved: the orders it placed. */
    orders: z.array(z.object({ id: uuid(), orderCode: z.string() })),
    /** An approval waits this long before it lapses and the price must be checked again. */
    expiresAt: dateTime(),
  })
  .meta({ id: "CompanyApprovalDto" });

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

const kycFile = z.object({
  docType: companyKycDocType,
  fileId: uuid(),
  /** The certificate must be at most 6 months old (D-120). */
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const storeBusinessRequests = {
  "POST /v1/store/companies": request({
    request: "store.companies",
    summary:
      "Sign a company up with its KYC documents (D-120); it waits for Finance's review, and the applicant becomes its admin",
    decisions: ["D-120"],
    body: z.object({
      legalName: z.string().trim().min(2).max(200),
      taxId: z.string().regex(/^\d{13}$/),
      isVatRegistered: z.boolean(),
      headOffice: z.object({ address: z.string().trim().min(10).max(500) }),
      signatory: z.object({ name: z.string().trim().min(1).max(120), position: z.string().trim().min(1).max(120) }),
      contactPhone: z.string().regex(/^0\d{8,9}$/),
      documents: z.array(kycFile).min(2).max(10),
    }),
    response: storeCompany,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/me/company": request({
    request: "store.companies",
    summary: "The signed-in member's company: roles, credit, what is owed, notices (404 when not a member)",
    decisions: ["D-121", "D-122", "D-123"],
    response: storeCompany,
  }),
  "PATCH /v1/store/me/company": request({
    request: "store.companies",
    summary: "Company settings its admin sets: the approval threshold (D-123) and the PO number policy (D-125)",
    decisions: ["D-123", "D-125"],
    body: z.object({
      orderApprovalThreshold: money().nullable().optional(),
      poNumberPolicy: poNumberPolicy.optional(),
    }),
    response: storeCompany,
  }),
  "GET /v1/store/me/company/members": request({
    request: "store.company-members",
    summary: "The company's members and their roles",
    response: z.object({ data: z.array(companyMember) }),
  }),
  "POST /v1/store/me/company/members": request({
    request: "store.company-members",
    summary: "Invite a member by phone with their roles; they join on their next sign-in",
    body: z.object({
      name: z.string().trim().min(1).max(120),
      phone: z.string().regex(/^0\d{8,9}$/),
      email: z.string().email().max(254).optional(),
      roles: z.array(companyRole).min(1),
    }),
    response: companyMember,
    status: 201,
  }),
  "PATCH /v1/store/me/company/members/{memberId}": request({
    request: "store.company-members",
    summary: "Change a member's roles; the last admin cannot be demoted (409 company.last_admin)",
    body: z.object({ roles: z.array(companyRole).min(1) }),
    response: companyMember,
  }),
  "DELETE /v1/store/me/company/members/{memberId}": request({
    request: "store.company-members",
    summary: "Remove a member; their orders stay the company's",
    response: z.object({ removed: z.literal(true) }),
  }),
  "GET /v1/store/me/company/branches": request({
    request: "store.company-branches",
    summary: "Head office and branches — a tax invoice per branch (D-125)",
    decisions: ["D-125"],
    response: z.object({ data: z.array(companyBranch) }),
  }),
  "POST /v1/store/me/company/branches": request({
    request: "store.company-branches",
    summary: "Add a branch with its 5-digit branch code",
    body: z.object({
      branchCode: z.string().regex(/^\d{5}$/),
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().min(10).max(500),
    }),
    response: companyBranch,
    status: 201,
  }),
  "DELETE /v1/store/me/company/branches/{branchId}": request({
    request: "store.company-branches",
    summary: "Remove a branch (never the head office)",
    response: z.object({ removed: z.literal(true) }),
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
  "POST /v1/store/me/company/approvals": request({
    request: "store.company-approvals",
    summary:
      "Send a checkout over the company threshold to its approver instead of placing it (D-123); the preview token holds the price",
    decisions: ["D-123"],
    body: checkoutInput.extend({ previewToken: z.string() }),
    response: companyApproval,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/me/company/approvals": request({
    request: "store.company-approvals",
    summary: "What waits for approval, or what was decided",
    query: z.object({
      status: z.enum(["pending", "decided"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
    }),
    response: page(companyApproval),
  }),
  "POST /v1/store/me/company/approvals/{approvalId}/actions/approve": request({
    request: "store.company-approvals",
    summary: "Approve: the orders are placed as the requester checked them out, and they are told to pay",
    decisions: ["D-123"],
    response: companyApproval,
    idempotent: true,
  }),
  "POST /v1/store/me/company/approvals/{approvalId}/actions/reject": request({
    request: "store.company-approvals",
    summary: "Reject with a reason the requester sees; the cart stays theirs",
    body: z.object({ reason: z.string().trim().min(3).max(500) }),
    response: companyApproval,
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
    response: storeCompany,
    status: 201,
    idempotent: true,
  }),
  "GET /v1/store/me/company/statements": request({
    request: "store.company-credit",
    summary: "Monthly statements with aging (D-125) — what is open, due and overdue",
    decisions: ["D-122", "D-125"],
    response: z.object({
      data: z.array(companyStatement),
      aging: z.object({
        current: money(),
        days1to30: money(),
        days31to60: money(),
        days61to90: money(),
        over90: money(),
      }),
      receivables: companyReceivables,
    }),
  }),
  "POST /v1/store/me/company/statements/{statementId}/actions/download": request({
    request: "store.company-credit",
    summary: "A statement's PDF as a signed URL",
    response: signedUrl,
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
