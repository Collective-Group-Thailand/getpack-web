import "server-only";

import { serverRequests } from "@/lib/api/requests/server";
import type { RewardList, RewardRedemption } from "@/lib/api/requests/store-loyalty-p3";

/**
 * The reward reads (loyalty P3, CONTRACT-REQUEST store.rewards) for Server Components. The catalogue is the page's
 * content (its failure is the page's error); "คูปองของฉัน" and the /deals tab are conveniences and hide on failure.
 */
export async function getRewards(): Promise<RewardList> {
  return (await serverRequests("customer")).call("GET /v1/store/rewards");
}

/** The catalogue for the /deals tab (public); null hides the tab's content. */
export async function getRewardsOrNull(): Promise<RewardList | null> {
  try {
    return await getRewards();
  } catch {
    return null;
  }
}

/** My reward coupons, newest first (one page of 100 is every coupon a customer realistically holds). */
export async function getMyRewardCoupons(): Promise<RewardRedemption[]> {
  try {
    return (
      await (await serverRequests("customer")).call("GET /v1/store/rewards/redemptions", { query: { perPage: 100 } })
    ).data;
  } catch {
    return [];
  }
}
