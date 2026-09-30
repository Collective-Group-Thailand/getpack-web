import "server-only";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export type Company = Schemas["CompanyDto"];

/**
 * The companies the signed-in customer belongs to (`store.companies.listMine`), including one still
 * in review. A customer who belongs to none gets an empty list.
 */
export async function listMyCompanies(): Promise<Company[]> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/companies");
    return data ?? [];
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.status === 404)) return [];
    throw error;
  }
}

/**
 * The company the customer acts for: the first of theirs, preferring an active one.
 *
 * CONTRACT-GAP store.companies — a user may belong to several companies and the published contract
 * has no singular "my company" (the request asked for `/me/company`), so the storefront takes the
 * first. A picker belongs here once a customer with two companies exists.
 */
export async function getMyCompany(): Promise<Company | null> {
  const companies = await listMyCompanies();
  return companies.find((company) => company.status === "active") ?? companies[0] ?? null;
}
