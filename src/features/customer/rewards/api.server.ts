import "server-only";

import type { RewardList, RewardRedemption } from "@/features/shared/loyalty-p3/types";
import { serverApi } from "@/lib/api/server";

/**
 * The reward reads (loyalty P3, `store.rewards.list` / `listMine`) for Server Components. The catalogue is the page's
 * content (its failure is the page's error); "คูปองของฉัน" and the /deals tab are conveniences and hide on failure.
 */
export async function getRewards(): Promise<RewardList> {
  const { data } = await (await serverApi("customer")).GET("/v1/store/rewards");
  return data!;
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
    const { data } = await (
      await serverApi("customer")
    ).GET("/v1/store/rewards/redemptions", { params: { query: { perPage: 100 } } });
    return data!.data;
  } catch {
    return [];
  }
}
