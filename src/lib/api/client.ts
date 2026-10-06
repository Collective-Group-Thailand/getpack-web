/**
 * The typed clients for `packio-api` (ADR-0005).
 *
 *   browserApi()        Client Components → this app's zone BFF at /bff
 *   serverApi(zone)     Server Components → API_INTERNAL_URL with the zone's cookie token
 *   upstreamApi(opts)   the API with an explicitly supplied token, for code that has no
 *                       request context to read one from (the proxy's refresh, the BFF)
 *
 * All three share one set of middleware, so `Accept-Language`, the request id, the
 * `Idempotency-Key` rule and problem-details errors behave identically wherever a call is
 * made from. A failed response becomes a thrown `ApiError` rather than a returned `error`
 * value: TanStack Query, error boundaries and `try`/`catch` all expect a rejection, and a
 * discipline that has to be remembered at every call site is one that will be forgotten.
 */

import createClient, { type Client, type Middleware } from "openapi-fetch";

import { FORWARDED_FOR_HEADER } from "@/lib/security/client-ip";
import { isUpstreamPathAllowed, type Zone } from "@/lib/zones";

import { MOCK_SCENARIO_HEADER } from "./mock-scenario";
import { ApiError, toApiError } from "./problem";
import type { ApiPaths } from "./types";

export const CSRF_HEADER = "x-packio-csrf";
export const REQUEST_ID_HEADER = "x-request-id";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Methods that can change something, and so may need an idempotency key. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Operations the contract requires an `Idempotency-Key` on (api-conventions §3): payments,
 * refunds, credit notes, payout runs, bank files, checkout, partner milestone updates.
 *
 * Matching is on the OpenAPI schema path, so `/v1/admin/orders/{orderId}/actions/refund`
 * matches whatever the ids are. The list is empty while F1 has no business operations; F2–F6
 * add their own paths as they build them, and `newIdempotencyKey` below is what a mutation
 * uses to keep one key across a retry.
 */
export const IDEMPOTENT_PATHS: readonly RegExp[] = [];

export function requiresIdempotencyKey(method: string, schemaPath: string): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return false;
  return IDEMPOTENT_PATHS.some((pattern) => pattern.test(schemaPath));
}

/**
 * A key for one logical operation.
 *
 * Generate it **once per user intent**, not per attempt: the whole point of the header is
 * that a retry after a timeout — when the server may well have processed the first try —
 * replays the original response instead of charging twice. A key minted inside the fetch
 * would be new on every retry and would guarantee exactly the double-submit it exists to
 * prevent. The middleware only fills one in when a flagged call arrives without one, so a
 * missing key is a bug that fails safe rather than silently.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // `randomUUID` exists only in a secure context; a page served over plain http on a LAN address
  // still has `getRandomValues`. The API accepts a UUID and nothing else (api-conventions §3).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Headers for an edit that must not clobber a concurrent one (api-conventions §3). */
export function ifMatch(etag: string): Record<string, string> {
  return { "If-Match": etag };
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Bearer token. Omitted in the browser: the BFF attaches it, the browser never sees it. */
  accessToken?: string | null;
  /**
   * `Accept-Language`. A function is resolved per request, which is what the browser client
   * needs: it is memoised for the life of the page, and the locale can change under it.
   */
  locale?: string | (() => string | undefined);
  /**
   * Correlates this app's logs with the API's. Generated when absent; `null` sends none — for
   * a cached public read, where a per-request header would make every fetch its own cache
   * entry (Next's data cache keys on headers).
   */
  requestId?: string | null;
  /** Sends the BFF's CSRF header on non-GET requests. Browser clients only. */
  csrf?: boolean;
  /**
   * Refuses a call to a surface this zone may not reach (`/v1/store` from admin code, say).
   * The ESLint zone boundaries cannot catch this: the surface is a string inside a fetch, not
   * an import. Set for server clients, which address the API directly; a browser client goes
   * through the BFF, which applies the same allow-list to what it will forward.
   */
  surfaceZone?: Zone;
  /**
   * The visitor's address, sent as `X-Forwarded-For` so the API throttles the visitor rather
   * than this app (`src/lib/security/client-ip.ts`). Server clients only; `null` sends none.
   */
  forwardedFor?: string | null;
  /** `?mock=` scenario for the mock API (`./mock-scenario.ts`); set only under `API_MOCKS=1`. */
  mockScenario?: string | null;
  fetch?: typeof fetch;
}

function contextMiddleware({
  accessToken,
  locale,
  requestId,
  csrf,
  surfaceZone,
  forwardedFor,
  mockScenario,
}: ApiClientOptions): Middleware {
  return {
    onRequest({ request, schemaPath }) {
      if (surfaceZone && !isUpstreamPathAllowed(surfaceZone, schemaPath)) {
        throw new Error(
          `The ${surfaceZone} zone may not call ${schemaPath}. Allowed surfaces are listed in ZONE_CONFIG (api-conventions §2).`,
        );
      }

      const headers = new Headers(request.headers);

      const language = typeof locale === "function" ? locale() : locale;
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      if (language) headers.set("Accept-Language", language);
      if (forwardedFor) headers.set(FORWARDED_FOR_HEADER, forwardedFor);
      if (mockScenario) headers.set(MOCK_SCENARIO_HEADER, mockScenario);
      if (!headers.has(REQUEST_ID_HEADER) && requestId !== null) {
        headers.set(REQUEST_ID_HEADER, requestId ?? crypto.randomUUID());
      }

      const mutating = MUTATING_METHODS.has(request.method.toUpperCase());
      if (csrf && mutating) headers.set(CSRF_HEADER, "1");
      if (requiresIdempotencyKey(request.method, schemaPath) && !headers.has(IDEMPOTENCY_HEADER)) {
        headers.set(IDEMPOTENCY_HEADER, newIdempotencyKey());
      }

      return new Request(request, { headers });
    },
  };
}

const problemMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.ok) return response;
    throw await toApiError(response, request.headers.get(REQUEST_ID_HEADER) ?? undefined);
  },
};

export function createApiClient(options: ApiClientOptions): Client<ApiPaths> {
  const client = createClient<ApiPaths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use(contextMiddleware(options));
  client.use(problemMiddleware);
  return client;
}

/**
 * The API, with a token the caller already holds.
 *
 * `src/proxy.ts` refreshes before rendering and the BFF refreshes on a 401; neither can read
 * cookies through `next/headers`, so both pass the token in rather than having it looked up.
 */
export function upstreamApi(options: ApiClientOptions): Client<ApiPaths> {
  return createApiClient(options);
}

export { ApiError };
