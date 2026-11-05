import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getPublicConfig } from "@/features/customer/catalog/api.server";
import { publicConfigSurfacesOf, SURFACES_CLOSED, surfacesOf } from "@/features/shared/loyalty-p4/read";
import { serverRequests } from "@/lib/api/requests/server";
import type { LoyaltySurfaces } from "@/lib/api/requests/store-loyalty-p4";
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
    if (!signedIn) return publicConfigSurfacesOf(await getPublicConfig());
    // CONTRACT-REQUEST store.loyalty.surfaces
    return surfacesOf(await (await serverRequests("customer")).call("GET /v1/store/loyalty/surfaces"));
  } catch {
    return SURFACES_CLOSED;
  }
});
