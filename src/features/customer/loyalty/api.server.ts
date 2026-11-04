import "server-only";

import { serverRequests } from "@/lib/api/requests/server";
import type { DataRefresh, LoyaltyCampaign, ShowcaseConsent } from "@/lib/api/requests/store-loyalty-p2";

/**
 * Loyalty P2 store reads for Server Components (CONTRACT-REQUEST store.loyalty.data-refresh, …showcase-consent,
 * …campaigns). The campaign list is a convenience (a failure shows no badge); the two pages' own reads are the page.
 */

export async function getDataRefresh(): Promise<DataRefresh> {
  return (await serverRequests("customer")).call("GET /v1/store/loyalty/data-refresh");
}

export async function getShowcaseConsent(): Promise<ShowcaseConsent> {
  return (await serverRequests("customer")).call("GET /v1/store/loyalty/showcase-consent");
}

/** My active points campaigns; empty when the read fails. */
export async function listCampaigns(): Promise<LoyaltyCampaign[]> {
  try {
    return (await (await serverRequests("customer")).call("GET /v1/store/loyalty/campaigns")).items;
  } catch {
    return [];
  }
}
