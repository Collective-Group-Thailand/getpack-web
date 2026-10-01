/** The company list and types, in a plain module so Server Components can prefetch. */

import type { Schemas } from "@/lib/api/types";

import { defineList } from "../console/resource";

export type Company = Schemas["AdminCompanyDto"];
export type CompanyKyc = Schemas["AdminKycDocumentDto"];
export type CompanyMember = Schemas["AdminCompanyMemberDto"];
export type CompanyBranch = Schemas["CompanyBranchDto"];
export type CompanyCredit = Schemas["AdminCompanyCreditDto"];
export type CreditVersion = Schemas["CreditLimitVersionDto"];
export type CompanyStatement = Schemas["CompanyStatementDto"];
export type IssuedStatement = Schemas["IssuedStatementDto"];

export const CREDIT_STATUSES = [
  "prepaid",
  "eligible",
  "credit",
  "blocked_overdue",
] as const satisfies readonly Schemas["CreditStatus"][];

export const COMPANY_STATUSES = [
  "applied",
  "kyc_review",
  "active",
  "suspended",
  "closed",
] as const satisfies readonly Schemas["CompanyStatus"][];

/** The company screen's tabs, for the page to validate `?tab=` against. */
export const COMPANY_TABS = ["overview", "kyc", "members", "branches", "credit", "statements", "orders"] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];

export const companiesList = defineList<Company>({
  key: "company",
  fetch: async ({ contract }, query) =>
    (await contract.GET("/v1/admin/companies", { params: { query: query as never } })).data!,
  getRowId: (row) => row.id,
  getRowName: (row) => row.companyCode ?? row.legalName,
  defaults: { filterKeys: ["status", "creditStatus"] },
});
