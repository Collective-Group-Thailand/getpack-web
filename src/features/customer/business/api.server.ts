import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { getActor } from "@/lib/auth/actor";

import { findMyCompany } from "./companies.server";

/**
 * The company the signed-in member acts for, as its pages need it: the published company
 * (`store.companies.get`, with the `ETag` a settings change is sent under, the member's own roles
 * `myRoles` and what they open `can`), its credit (`store.companyCredit.get`) and receivables
 * (`store.companyCredit.receivables`) when the API lets them see them.
 */
export type Company = Schemas["CompanyDto"] & {
  etag: string;
  credit: Schemas["CompanyCreditDto"] | null;
  /** D-462: what a member who may order sees when the full credit is not theirs to see. */
  creditSummary: Schemas["CompanyCreditSummaryDto"] | null;
  receivables: Schemas["CompanyReceivablesDto"] | null;
};

/** `null` for a 404 / 403 (not a member, or not this role's to see) — the page says so instead. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isApiError(error) && [401, 403, 404].includes(error.status)) return null;
    throw error;
  }
}

/** The signed-in member's company, once per request (the layout and the page both ask). */
export const getMyCompany = cache(async (): Promise<Company | null> => {
  const [actor, found] = await Promise.all([getActor("customer"), findMyCompany()]);
  if (!actor || !found) return null;
  // Only a member's roles open the company's pages; the API names them (`myRoles`).
  const api = await serverApi("customer");
  const read = await orNull(api.GET("/v1/store/companies/{companyId}", { params: { path: { companyId: found.id } } }));
  if (!read?.data) return null;
  if (read.data.myRoles.length === 0) return null;
  const path = { params: { path: { companyId: found.id } } };
  const [credit, creditSummary, receivables] = await Promise.all([
    read.data.can.viewFinance
      ? orNull(api.GET("/v1/store/companies/{companyId}/credit", path).then(({ data }) => data!))
      : Promise.resolve(null),
    !read.data.can.viewFinance && read.data.can.order
      ? orNull(api.GET("/v1/store/companies/{companyId}/credit/summary", path).then(({ data }) => data!))
      : Promise.resolve(null),
    read.data.can.viewFinance
      ? orNull(api.GET("/v1/store/companies/{companyId}/receivables", path).then(({ data }) => data!))
      : Promise.resolve(null),
  ]);
  return { ...read.data, etag: read.response.headers.get("etag") ?? "", credit, creditSummary, receivables };
});

/** The company's shared brand assets, with signed URLs (`store.companyAssets.list`, D-227). */
export async function getBrandAssets(companyId: string): Promise<Schemas["CompanyAssetDto"][] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/brand-assets", { params: { path: { companyId } } })
      .then(({ data }) => data!),
  );
}

/**
 * What waits for the company's approver, or the decided history (`store.companyApprovals.list`
 * with `status`), newest decided first.
 */
export async function getApprovals(
  companyId: string,
  status: Schemas["CompanyApprovalStatusFilter"] = "pending",
): Promise<Schemas["CompanyApprovalDto"][] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/approvals", {
        params: { path: { companyId }, query: { status, limit: 50 } },
      })
      .then(({ data }) => data!),
  );
}

/** The monthly statements issued so far, newest first (`store.companyCredit.listStatements`, D-125). */
export async function getIssuedStatements(companyId: string): Promise<Schemas["IssuedStatementDto"][] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/issued-statements", { params: { path: { companyId } } })
      .then(({ data }) => data!),
  );
}

/** What the company spent, by month, member, branch and product type (`store.companies.spend`, D-125). */
export async function getSpend(companyId: string, months = 12): Promise<Schemas["CompanySpendDto"] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/spend", { params: { path: { companyId }, query: { months } } })
      .then(({ data }) => data!),
  );
}
