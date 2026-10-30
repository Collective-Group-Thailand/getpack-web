/**
 * The shape the fake B2B companies are kept in — a fixture model, not an API type. The admin
 * handlers turn a row into `AdminCompanyDto` / `CompanyCreditDto` / `CompanyStatementDto` on the
 * way out (`./companies`), the storefront's into `CompanyDto` (`../store/business`).
 *
 * The rows keep what the contract does not carry yet (receivables, credit versions, the company
 * discount, file names and review stamps) because the credit, dunning and storefront mocks reason
 * with them. The zod enums are here for the storefront model (`../store/model`), which composes them.
 */

import { z } from "zod";

import { money } from "@/lib/api/requests/define";
import type { Schemas } from "@/lib/api/types";

export const companyStatus = z.enum(["applied", "kyc_review", "active", "suspended", "closed"]);
export const creditStatus = z.enum(["prepaid", "eligible", "credit", "blocked_overdue"]);
export const poNumberPolicy = z.enum(["required", "optional", "none"]);
export const companyKycDocType = z.enum([
  "company_certificate",
  "vat_registration_pp20",
  "signatory_id",
  "financial_statement",
]);
export const companyKycStatus = z.enum(["pending", "verified", "rejected", "expired"]);

/** Receivables the company owes now (B5.2): what decides a credit block (D-122). */
export const companyReceivables = z.object({
  openAmount: money(),
  overdueAmount: money(),
  /** Days past due of the oldest unpaid invoice; `0` when nothing is overdue. */
  oldestOverdueDays: z.number().int(),
  nextDueAt: z.string().nullable(),
  creditOrdersBlocked: z.boolean(),
});

interface FileRow {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailUrl: string | null;
  url: string | null;
}

interface UserRow {
  id: string;
  displayName: string;
}

export interface CreditLimitVersionRow {
  versionNo: number;
  limitAmount: string;
  termDays: number;
  status: "proposed" | "approved" | "rejected" | "withdrawn";
  basis: Schemas["CreditEligibilityBasis"];
  reason: string;
  effectiveFrom: string;
  approvalRequestId: string | null;
  requestedBy: UserRow;
  createdAt: string;
  /** D-462: a term outside `b2b.credit_terms.allowedDays`. */
  customTerm?: boolean;
  /** D-462: a temporary limit ends here. */
  validUntil?: string | null;
}

export interface CompanyRow {
  id: string;
  /** Issued when KYC is approved (series `company`); the seeds all have one. */
  companyCode: string;
  legalName: string;
  taxId: string;
  status: Schemas["CompanyStatus"];
  creditStatus: Schemas["CreditStatus"];
  membersCount: number;
  paidOrdersCount: number;
  receivables: z.output<typeof companyReceivables>;
  createdAt: string;
  isVatRegistered: boolean;
  poNumberPolicy: Schemas["PoNumberPolicy"];
  orderApprovalThreshold: string | null;
  kycApprovedAt: string | null;
  /** The reason given with the last status action (reject-kyc, suspend, close). */
  statusReason: string | null;
  credit: {
    limitAmount: string;
    termDays: number | null;
    availableAmount: string;
    /** Whether a prepaid company meets D-121 (paid orders from `b2b.credit_eligibility_paid_orders`). */
    eligible: boolean;
    eligibleReason: "paid_orders" | "financial_statement" | "not_yet";
    /** D-462: the limit in force is temporary and ends here; then `fallback*` applies. */
    validUntil?: string | null;
    fallbackLimitAmount?: string | null;
    fallbackTermDays?: number | null;
    versions: CreditLimitVersionRow[];
  };
  discount: {
    pct: string;
    discountMemoId: string;
    memoCode: string;
    effectiveFrom: string;
    validTo: string | null;
  } | null;
  updatedAt: string;
}

export interface CompanyKycRow {
  id: string;
  docType: z.output<typeof companyKycDocType>;
  status: Schemas["KycStatus"];
  file: FileRow;
  issuedOn: string | null;
  note: string | null;
  reviewedBy: UserRow | null;
  reviewedAt: string | null;
  uploadedAt: string;
}

export interface CompanyMemberRow {
  id: string;
  user: { id: string; displayName: string; email: string | null; phone: string | null };
  roles: Schemas["CompanyRole"][];
  status: Schemas["MemberStatus"];
  joinedAt: string | null;
}

export interface CompanyBranchRow {
  id: string;
  branchType: Schemas["BranchType"];
  branchCode: string;
  name: string;
  /** One line, postcode last — split into `line1` / `postcode` on the way out. */
  address: string;
}

export interface CompanyStatementRow {
  id: string;
  /** `YYYY-MM`. */
  period: string;
  openingBalance: string;
  invoicedAmount: string;
  paidAmount: string;
  closingBalance: string;
  dueAt: string | null;
  status: "open" | "paid" | "overdue";
  file: FileRow | null;
  issuedAt: string;
}
