import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";
import { getActor } from "@/lib/auth/actor";

import { capabilitiesOf, type CompanyCapabilities, type CompanyRole } from "./capabilities";
import { findMyCompany } from "./companies.server";

/**
 * The company the signed-in member acts for, as its pages need it: the published company
 * (`store.companies.get`, with the `ETag` a settings change is sent under), the member's own
 * roles and what they open, and its credit (`store.companyCredit.get`) when the API lets them see it.
 */
export type Company = Schemas["CompanyDto"] & {
  etag: string;
  myRoles: CompanyRole[];
  can: CompanyCapabilities;
  credit: Schemas["CompanyCreditDto"] | null;
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
  const api = await serverApi("customer");
  const read = await orNull(api.GET("/v1/store/companies/{companyId}", { params: { path: { companyId: found.id } } }));
  if (!read?.data) return null;
  const member = read.data.members.find((candidate) => candidate.user.id === actor.id && candidate.status === "active");
  if (!member) return null;
  const can = capabilitiesOf(member.roles);
  const credit = await orNull(
    api
      .GET("/v1/store/companies/{companyId}/credit", { params: { path: { companyId: found.id } } })
      .then(({ data }) => data!),
  );
  return { ...read.data, etag: read.response.headers.get("etag") ?? "", myRoles: member.roles, can, credit };
});

export async function getBrandAssets() {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/brand-assets"));
}

/**
 * What waits for the company's approver (`store.companyApprovals.list`). CONTRACT-GAP
 * store.company-approvals — the published list has the pending ones only: no decided history.
 */
export async function getApprovals(companyId: string): Promise<Schemas["CompanyApprovalDto"][] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/approvals", { params: { path: { companyId } } })
      .then(({ data }) => data!),
  );
}

/**
 * One month's statement (`store.documents.companyStatement`, `month` = `YYYY-MM`). CONTRACT-GAP
 * store.company-credit — there is no list of issued statements or aging, so the page asks month
 * by month.
 */
export async function getStatement(companyId: string, month: string): Promise<Schemas["CompanyStatementDto"] | null> {
  return orNull(
    (await serverApi("customer"))
      .GET("/v1/store/companies/{companyId}/statements", { params: { path: { companyId }, query: { month } } })
      .then(({ data }) => data!),
  );
}

export async function getSpend(months = 12) {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/spend", { query: { months } }));
}
