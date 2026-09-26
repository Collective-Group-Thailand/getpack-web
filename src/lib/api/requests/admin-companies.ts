/**
 * B2B companies as the back office sees them (F2 2.7) — packio-api B3.5, not published yet.
 * Shaped by schema-design §3 "Companies" (`companies`, `company_branches`, `company_members`,
 * `company_kyc_documents`, `company_credit_limits`, `company_discounts`) and B5.2's statements.
 *
 * Credit is prepaid until approved (D-121): a limit is requested with its basis and routed by
 * the `credit_limit` approval policy (≤ THB 100,000 Finance, above C-Level); terms are the ones
 * the setting `b2b.credit_terms` allows. Available credit, overdue days and the credit block
 * (D-122) are the API's figures.
 */

import { z } from "zod";

import { date, dateTime, fileRef, listQuery, money, page, pct, request, userRef, uuid } from "./define";

export const companyStatus = z
  .enum(["applied", "kyc_review", "active", "suspended", "closed"])
  .meta({ id: "CompanyStatus" });
export const creditStatus = z.enum(["prepaid", "eligible", "credit", "blocked_overdue"]).meta({ id: "CreditStatus" });
export const poNumberPolicy = z.enum(["required", "optional", "none"]).meta({ id: "PoNumberPolicy" });
export const companyAction = z
  .enum(["approve-kyc", "return-kyc", "suspend", "reinstate", "close"])
  .meta({ id: "CompanyAction" });
export const companyRole = z
  .enum(["company_admin", "company_buyer", "company_approver", "company_accountant"])
  .meta({ id: "CompanyRole" });
export const companyKycDocType = z
  .enum(["company_certificate", "vat_registration_pp20", "signatory_id", "financial_statement"])
  .meta({ id: "CompanyKycDocType" });
export const companyKycStatus = z.enum(["pending", "verified", "rejected", "expired"]).meta({ id: "CompanyKycStatus" });

/** Receivables the company owes now (B5.2): what decides a credit block (D-122). */
export const companyReceivables = z.object({
  openAmount: money(),
  overdueAmount: money(),
  /** Days past due of the oldest unpaid invoice; `0` when nothing is overdue. */
  oldestOverdueDays: z.number().int(),
  nextDueAt: dateTime().nullable(),
  creditOrdersBlocked: z.boolean(),
});

export const companySummary = z
  .object({
    id: uuid(),
    companyCode: z.string(),
    legalName: z.string(),
    taxId: z.string(),
    status: companyStatus,
    creditStatus,
    membersCount: z.number().int(),
    paidOrdersCount: z.number().int(),
    receivables: companyReceivables,
    createdAt: dateTime(),
  })
  .meta({ id: "CompanySummaryDto" });

export const creditLimitVersion = z.object({
  versionNo: z.number().int(),
  limitAmount: money(),
  termDays: z.number().int(),
  status: z.enum(["proposed", "approved", "rejected", "withdrawn"]),
  basis: z.enum(["paid_orders", "financial_review"]),
  reason: z.string(),
  effectiveFrom: dateTime(),
  approvalRequestId: uuid().nullable(),
  requestedBy: userRef(),
  createdAt: dateTime(),
});

export const companyDetail = companySummary
  .extend({
    isVatRegistered: z.boolean(),
    poNumberPolicy,
    /** Set by the company's own admin (D-123); shown, never edited here. */
    orderApprovalThreshold: money().nullable(),
    kycApprovedAt: dateTime().nullable(),
    credit: z.object({
      limitAmount: money(),
      termDays: z.number().int().nullable(),
      availableAmount: money(),
      /** Whether a prepaid company meets D-121 (paid orders from `b2b.credit_eligibility_paid_orders`). */
      eligible: z.boolean(),
      eligibleReason: z.enum(["paid_orders", "financial_review", "not_yet"]),
      versions: z.array(creditLimitVersion),
    }),
    discount: z
      .object({ pct: pct(), discountMemoId: uuid(), memoCode: z.string(), validTo: date().nullable() })
      .nullable(),
    allowedActions: z.array(companyAction),
  })
  .meta({ id: "CompanyDetailDto" });

export const companyKycDocument = z
  .object({
    id: uuid(),
    docType: companyKycDocType,
    status: companyKycStatus,
    file: fileRef(),
    issuedOn: date().nullable(),
    note: z.string().nullable(),
    reviewedBy: userRef().nullable(),
    reviewedAt: dateTime().nullable(),
    uploadedAt: dateTime(),
  })
  .meta({ id: "CompanyKycDocumentDto" });

export const companyMember = z
  .object({
    id: uuid(),
    user: z.object({ id: uuid(), displayName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
    roles: z.array(companyRole),
    status: z.enum(["invited", "active", "removed"]),
    joinedAt: dateTime().nullable(),
  })
  .meta({ id: "CompanyMemberDto" });

export const companyBranch = z
  .object({
    id: uuid(),
    branchType: z.enum(["head_office", "branch"]),
    branchCode: z.string(),
    name: z.string(),
    address: z.string(),
  })
  .meta({ id: "CompanyBranchDto" });

export const companyStatement = z
  .object({
    id: uuid(),
    /** `YYYY-MM`. */
    period: z.string().regex(/^\d{4}-\d{2}$/),
    openingBalance: money(),
    invoicedAmount: money(),
    paidAmount: money(),
    closingBalance: money(),
    dueAt: dateTime().nullable(),
    status: z.enum(["open", "paid", "overdue"]),
    file: fileRef().nullable(),
    issuedAt: dateTime(),
  })
  .meta({ id: "CompanyStatementDto" });

export const adminCompanyRequests = {
  "GET /v1/admin/companies": request({
    request: "admin.companies",
    summary: "B2B companies with KYC status, credit status and receivables (D-120…D-122)",
    decisions: ["D-120", "D-121", "D-122"],
    query: listQuery({ status: companyStatus.optional(), creditStatus: creditStatus.optional() }),
    response: page(companySummary),
  }),
  "GET /v1/admin/companies/{companyId}": request({
    request: "admin.companies",
    summary: "One company: terms, credit with its versions, company discount and allowed actions (ETag)",
    decisions: ["D-121", "D-123", "D-124", "D-125"],
    response: companyDetail,
  }),
  "POST /v1/admin/companies/{companyId}/actions/{action}": request({
    request: "admin.companies",
    summary: "Approve KYC, return it, suspend, reinstate or close a company, with a reason",
    decisions: ["D-120"],
    body: z.object({ reason: z.string().min(3).max(500) }),
    response: companyDetail,
    concurrency: true,
  }),
  "GET /v1/admin/companies/{companyId}/kyc-documents": request({
    request: "admin.companies",
    summary: "The company's KYC documents (D-120)",
    response: z.array(companyKycDocument),
  }),
  "POST /v1/admin/companies/{companyId}/kyc-documents/{documentId}/actions/review": request({
    request: "admin.companies",
    summary: "Verify or reject one document; a company certificate older than 6 months is refused (D-120)",
    decisions: ["D-120"],
    body: z.object({ outcome: z.enum(["verified", "rejected"]), note: z.string().max(500).nullable() }),
    response: companyKycDocument,
  }),
  "GET /v1/admin/companies/{companyId}/members": request({
    request: "admin.companies",
    summary: "Members and their company roles",
    response: z.array(companyMember),
  }),
  "GET /v1/admin/companies/{companyId}/branches": request({
    request: "admin.companies",
    summary: "Branches — one tax invoice per branch (D-125)",
    decisions: ["D-125"],
    response: z.array(companyBranch),
  }),
  "POST /v1/admin/companies/{companyId}/credit-limits": request({
    request: "admin.company-credit",
    summary: "Request a credit limit and term; opens a credit_limit approval (≤ THB 100,000 Finance, above C-Level)",
    decisions: ["D-121"],
    body: z.object({
      limitAmount: money(),
      termDays: z.number().int().positive(),
      basis: z.enum(["paid_orders", "financial_review"]),
      reason: z.string().min(3).max(1000),
      evidenceFileIds: z.array(uuid()).max(10),
    }),
    response: z.object({ versionNo: z.number().int(), approvalRequestId: uuid(), status: z.literal("proposed") }),
    status: 201,
    idempotent: true,
  }),
  "GET /v1/admin/companies/{companyId}/statements": request({
    request: "admin.company-credit",
    summary: "Monthly statements for consolidated payment (D-125)",
    decisions: ["D-125"],
    response: z.array(companyStatement),
  }),
} as const;
