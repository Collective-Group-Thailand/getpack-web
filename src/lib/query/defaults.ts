/**
 * TanStack Query defaults, now that `ApiError` can tell a 422 from a 503 (F1 1.1 left these
 * deliberately plain and named this deliverable).
 */

import type { QueryClientConfig } from "@tanstack/react-query";

import { isApiError } from "@/lib/api/problem";

/** Beyond this many attempts a retry is just delaying the error state the user needs to see. */
const MAX_RETRIES = 2;

/**
 * Retry only what retrying can fix.
 *
 * A 4xx is the API saying the request itself is wrong — repeating it produces the same answer
 * and, on a 429, makes the rate limit worse. The exceptions are 408 and 429, which are
 * explicitly "try again", and 5xx and transport failures, which may be transient. A 401 is
 * never retried here: the BFF already refreshes once and retries underneath, so a 401 that
 * reaches this layer means the session is genuinely gone.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (!isApiError(error)) return true; // a transport failure: no response ever arrived
  return error.isRetryable;
}

/**
 * How long a resource stays fresh, by how fast it actually changes.
 *
 * These are defaults for the common case, not a rule: a screen watching a queue passes its
 * own. Nothing here refetches on window focus — staff keep the admin open all day, and a
 * table that reloads every time someone alts back to the tab is noise, not freshness.
 */
export const STALE_TIME = {
  /** Work queues, dashboards, anything with an SLA timer on it. */
  live: 15_000,
  /** Orders, jobs, shipments — things a person changes during a shift. */
  transactional: 30_000,
  /** Catalogue, materials, patterns — things an admin changes occasionally. */
  reference: 5 * 60_000,
  /** Settings, permissions, menu entitlements — things that change by deliberate act. */
  stable: 15 * 60_000,
} as const;

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      staleTime: STALE_TIME.transactional,
    },
    mutations: {
      // A mutation is a user's deliberate act. Retrying it automatically would repeat that
      // act without them asking, and only an operation carrying an `Idempotency-Key` is safe
      // to repeat at all — so the decision belongs at the call site, with the key.
      retry: false,
    },
  },
};
