import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getPublicConfig } from "@/features/customer/catalog/api.server";
import { type LoyaltySurfaces, SURFACES_CLOSED } from "@/features/shared/loyalty-p4/types";
import { serverApi } from "@/lib/api/server";
import { readAccessToken } from "@/lib/auth/session";

/**
 * Which loyalty surfaces this visitor may see (loyalty P4, D-509, D-510) — the one reader every page, nav item and entry
 * point asks. Signed in: `store.loyalty.surfaces` (the setting ∧ the caller's rollout cohort). A guest:
 * `store.publicConfig.get` `loyaltySurfaces`, the anonymous view. A failed read closes every gated surface; the points
 * balance and the ledger never ask it and always stay. Cached per request.
 *
 * The web never says why a surface is closed (no rollout, no budget): the page shows `FeatureUnavailable`.
 */
export const getLoyaltySurfaces = cache(async (): Promise<LoyaltySurfaces> => {
  try {
    const signedIn = Boolean(readAccessToken(await cookies()));
    if (!signedIn) return (await getPublicConfig())?.loyaltySurfaces ?? SURFACES_CLOSED;
    const { data } = await (await serverApi("customer")).GET("/v1/store/loyalty/surfaces");
    return data ?? SURFACES_CLOSED;
  } catch {
    return SURFACES_CLOSED;
  }
});
