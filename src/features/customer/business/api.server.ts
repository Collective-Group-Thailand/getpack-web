import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { serverRequests } from "@/lib/api/requests/server";

export type Company = ResponseOf<Requests, "GET /v1/store/me/company">;

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
export const getMyCompany = cache(async (): Promise<Company | null> =>
  orNull((await serverRequests("customer")).call("GET /v1/store/me/company")),
);

export async function getMembers() {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/members"));
}

export async function getBranches() {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/branches"));
}

export async function getBrandAssets() {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/brand-assets"));
}

export async function getApprovals(status: "pending" | "decided") {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/approvals", { query: { status } }));
}

export async function getStatements() {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/statements"));
}

export async function getSpend(months = 12) {
  return orNull((await serverRequests("customer")).call("GET /v1/store/me/company/spend", { query: { months } }));
}
