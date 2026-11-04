import "server-only";

import type { DataRefresh, LoyaltyCampaign, ShowcaseConsent } from "@/features/shared/loyalty-p2/types";
import { serverApi } from "@/lib/api/server";

/**
 * Loyalty P2 store reads for Server Components (`store.loyalty.getDataRefresh`, `getShowcaseConsent`, `campaigns`). The campaign list is a convenience (a failure shows no badge); the two pages' own reads are the page.
 */

export async function getDataRefresh(): Promise<DataRefresh> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/loyalty/data-refresh");
  return data!;
}

export async function getShowcaseConsent(): Promise<ShowcaseConsent> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/loyalty/showcase-consent");
  return data!;
}

/** My active points campaigns; empty when the read fails. */
export async function listCampaigns(): Promise<LoyaltyCampaign[]> {
  try {
    const { data } = await (await serverApi("customer")).GET("/v1/store/loyalty/campaigns");
    return data!.items;
  } catch {
    return [];
  }
}
