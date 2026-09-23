"use client";

import { createApiClient } from "./client";
import type { ApiPaths } from "./types";
import type { Client } from "openapi-fetch";

/**
 * The client a Client Component uses.
 *
 * The base URL is this zone's BFF on the same origin — `/bff` on every host, which the proxy
 * rewrites to the zone's route (ADR-0004). No token is attached here and none can be: the
 * cookies are `HttpOnly`, so the browser holds a session it cannot read, which is the whole
 * point of the BFF (ADR-0005).
 *
 * A relative base URL resolves only against a document origin, so this must not be called
 * while a Client Component is being server-rendered — use `serverApi(zone)` for the data a
 * first paint needs, and let this one serve interactions and refetches.
 */
let client: Client<ApiPaths> | undefined;

export function browserApi(): Client<ApiPaths> {
  client ??= createApiClient({ baseUrl: "/bff", csrf: true, locale: documentLocale });
  return client;
}

function documentLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.lang || undefined;
}

export { ApiError, isApiError } from "./problem";
