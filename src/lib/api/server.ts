import "server-only";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";

import { apiInternalUrl } from "@/lib/env/lazy-server";
import { readAccessToken } from "@/lib/auth/session";
import { visitorIp } from "@/lib/security/visitor.server";
import type { Zone } from "@/lib/zones";

import { createApiClient } from "./client";
import type { ApiPaths } from "./types";
import type { Client } from "openapi-fetch";

/**
 * The client a Server Component uses: the internal API URL, this zone's access token, and the
 * locale the page is rendering in.
 *
 * The `__Host-` prefix is dropped on plain http so local development works, and the only way
 * to know which name applies is whether this request arrived over TLS — which a Server
 * Component cannot see. Reading both names is honest about that: on https the prefixed cookie
 * is the only one a browser will have sent, and on http only the bare one exists, so there is
 * no ambiguity to resolve, and no way for an attacker to shadow the real cookie with the
 * other name on a host where it cannot be set in the first place.
 */
export async function serverApi(zone: Zone): Promise<Client<ApiPaths>> {
  const [jar, locale, baseUrl, forwardedFor] = await Promise.all([
    cookies(),
    getLocale(),
    apiInternalUrl(),
    visitorIp(),
  ]);
  const accessToken = readAccessToken(jar);

  return createApiClient({
    baseUrl,
    accessToken,
    locale,
    // The zone does not change the base URL — a Server Component talks to the API directly.
    // What it does is bound which surface this client may call, so admin code reaching for
    // `/v1/store/...` fails loudly here instead of being refused by the API's audience guard
    // at runtime, in production, on someone's screen.
    surfaceZone: zone,
    // The visitor, not this server, is who the API's per-IP throttles should count.
    forwardedFor,
  });
}

export { ApiError, isApiError } from "./problem";
export type { Zone };
