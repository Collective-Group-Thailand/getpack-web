import "server-only";

import { headers } from "next/headers";

import { safeReturnTo } from "@/features/shared/auth/return-to";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import { zoneHostOf } from "@/lib/env/lazy-server";
import type { Zone } from "@/lib/zones";

import { zoneOfToken } from "./token";

export { zoneOfToken };

export type DeepLinkOutcome =
  { kind: "go"; path: string } | { kind: "elsewhere"; url: string } | { kind: "expired" } | { kind: "not-found" };

async function resolveOn(zone: Zone, token: string): Promise<string> {
  const api = await serverApi(zone);
  const body = { token };
  const { data } =
    zone === "customer"
      ? await api.POST("/v1/store/deep-links/actions/resolve", { body })
      : zone === "admin"
        ? await api.POST("/v1/admin/deep-links/actions/resolve", { body })
        : await api.POST("/v1/partner/deep-links/actions/resolve", { body });
  return data!.path;
}

/**
 * Where a notification's link `<web>/l/<token>` goes (U5.1 §2, D-299). Every link is printed on the
 * storefront's host; a staff or partner token is sent on to its own zone's host, where it resolves
 * with that zone's session. The token is never a credential — the caller is already signed in on
 * `zone` — and the API's path is still checked to be a same-site path before anyone is sent there.
 */
export async function resolveDeepLink(zone: Zone, token: string): Promise<DeepLinkOutcome> {
  const owner = zoneOfToken(token);
  if (!owner) return { kind: "not-found" };
  if (owner !== zone) {
    const forwarded = (await headers()).get("x-forwarded-proto");
    const scheme = forwarded ?? (process.env.NODE_ENV === "production" ? "https" : "http");
    return { kind: "elsewhere", url: `${scheme}://${await zoneHostOf(owner)}/l/${encodeURIComponent(token)}` };
  }
  try {
    const path = safeReturnTo(await resolveOn(zone, token), "");
    return path ? { kind: "go", path } : { kind: "not-found" };
  } catch (error) {
    if (isApiError(error) && error.status === 410) return { kind: "expired" };
    // 404: not this reader's; 422: not a token at all (getpack-api checks its shape) — the same to the reader.
    if (isApiError(error) && (error.status === 404 || error.status === 422)) return { kind: "not-found" };
    throw error;
  }
}
