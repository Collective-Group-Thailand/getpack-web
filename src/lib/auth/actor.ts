import "server-only";

import { cache } from "react";

import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import type { CustomerMe, PartnerMe, StaffMe } from "@/lib/api/types";
import type { Zone } from "@/lib/zones";

/** Who is signed in, as each zone's `/me` describes them. */
export interface ActorByZone {
  customer: CustomerMe;
  admin: StaffMe;
  partner: PartnerMe;
}

export type Actor = ActorByZone[Zone];

/**
 * The signed-in principal for this zone, or `null` when nobody is.
 *
 * Wrapped in React's `cache`, so a layout guard, a shell and a page all asking "who is this?"
 * during one render produce one request. The cache is per-request by construction — it is
 * scoped to the React render — so it cannot leak one visitor's identity into another's page.
 *
 * `null` means unauthenticated, and only that. A 500 or an unreachable API is re-thrown to
 * the error boundary: treating it as "signed out" would bounce a signed-in user to a login
 * screen because a database was briefly slow, and they would sign in to be bounced again.
 */
export const getActor = cache(async <Z extends Zone>(zone: Z): Promise<ActorByZone[Z] | null> => {
  try {
    const api = await serverApi(zone);

    // Three concrete calls rather than one built from a variable: each keeps the response
    // type the contract gives it, so `actor.menu` exists on staff and nowhere else.
    switch (zone) {
      case "admin": {
        const { data } = await api.GET("/v1/admin/me");
        return (data ?? null) as ActorByZone[Z] | null;
      }
      case "partner": {
        const { data } = await api.GET("/v1/partner/me");
        return (data ?? null) as ActorByZone[Z] | null;
      }
      default: {
        const { data } = await api.GET("/v1/store/me");
        return (data ?? null) as ActorByZone[Z] | null;
      }
    }
  } catch (error) {
    // 401 is "no session". 403 is a token for the wrong audience, which the API rejects on
    // every other prefix (api-conventions §2) — from this app's point of view that is also
    // "not signed in here", and it is exactly what a customer cookie on the admin host looks
    // like.
    if (isApiError(error) && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

/** True when the actor holds the permission. The API still enforces it; this only hides UI. */
export function can(actor: Actor | null, permission: string): boolean {
  if (!actor || !("permissions" in actor)) return false;
  return actor.permissions.includes(permission);
}
