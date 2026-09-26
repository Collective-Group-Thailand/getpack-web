/** The company list and types, in a plain module so Server Components can prefetch. */

import type { z } from "zod";

import type {
  companyBranch,
  companyDetail,
  companyKycDocument,
  companyMember,
  companyStatement,
  companySummary,
} from "@/lib/api/requests/admin-companies";

import { defineList } from "../console/resource";

export type CompanySummary = z.output<typeof companySummary>;
export type Company = z.output<typeof companyDetail>;
export type CompanyKyc = z.output<typeof companyKycDocument>;
export type CompanyMember = z.output<typeof companyMember>;
export type CompanyBranch = z.output<typeof companyBranch>;
export type CompanyStatement = z.output<typeof companyStatement>;

export const COMPANY_STATUSES = ["applied", "kyc_review", "active", "suspended", "closed"] as const;
export const CREDIT_STATUSES = ["prepaid", "eligible", "credit", "blocked_overdue"] as const;

/** The company screen's tabs, for the page to validate `?tab=` against. */
export const COMPANY_TABS = ["overview", "kyc", "members", "branches", "credit", "statements", "orders"] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];

export const companiesList = defineList<CompanySummary>({
  key: "company",
  fetch: ({ requests }, query) => requests.call("GET /v1/admin/companies", { query: query as never }),
  getRowId: (row) => row.id,
  getRowName: (row) => row.companyCode,
  defaults: { filterKeys: ["status", "creditStatus"] },
});
