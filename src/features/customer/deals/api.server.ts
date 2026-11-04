import "server-only";

import { cookies } from "next/headers";

import { cleanDealRef, DEAL_REF_COOKIE } from "@/lib/attribution/deal-ref";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { ApplicableCodes, DealDetail, DealList, DealTab } from "@/features/shared/deals/types";

/**
 * The deal reads (loyalty P1.5: `store.promotions.listPublic` / `getPublic`, `store.cart.applicableCodes`) for Server
 * Components. A failed read hides the surface rather than
 * break the page (the account pages' rule for a convenience read), except the deal page itself, whose 404 is real.
 */

/** The agent code to forward: the link's own `?ref=` first (its cookie is set on this very response), else the cookie. */
export async function dealRef(fromUrl?: string | string[] | null): Promise<string | null> {
  const direct = cleanDealRef(Array.isArray(fromUrl) ? fromUrl[0] : fromUrl);
  if (direct) return direct;
  return cleanDealRef((await cookies()).get(DEAL_REF_COOKIE)?.value);
}

export async function listDeals(
  query: { tab?: DealTab; productTypeCode?: string; ref?: string | null } = {},
): Promise<DealList | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/promotions", {
      params: { query: { tab: query.tab, productTypeCode: query.productTypeCode, ref: query.ref ?? undefined } },
    });
    return data!;
  } catch {
    return null;
  }
}

/** One deal, or null when it is not shown (404). Any other failure is the page's error. */
export async function getDeal(slug: string, ref: string | null): Promise<DealDetail | null> {
  try {
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/promotions/{slug}", { params: { path: { slug }, query: { ref: ref ?? undefined } } });
    return data!;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** The signed-in strip's "ใช้ได้กับตะกร้าตอนนี้ n ใบ"; null hides that part. */
export async function getApplicableCodes(): Promise<ApplicableCodes | null> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/cart/applicable-codes");
    return data!;
  } catch {
    return null;
  }
}
