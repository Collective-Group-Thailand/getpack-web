import { isApiError } from "./problem";

/** Statuses that mean "try again in a moment" (account contract §4): throttled, or the service behind it is down. */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/** What Next replaces a Server Component error's message with in a production build. */
const HIDDEN_SERVER_MESSAGE = /Server Components render/i;

export type ErrorKind = "transient" | "generic";

export interface ClassifiedError {
  kind: ErrorKind;
  /** What support can find the failure by: the API's `requestId`, else Next's server-log `digest`. */
  reference: string | undefined;
}

/** A browser `fetch` that never reached the server ("Failed to fetch", "Load failed", "NetworkError…"). */
function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /failed to fetch|load failed|network ?error|network request failed/i.test(error.message)
  );
}

/**
 * Whether a failure that reached an error boundary is temporary, and the reference code to show.
 *
 * `429`, `502`, `503`, `504` and network failures are transient. A failure while a *page* rendered
 * on the server arrives here with its message hidden (production), so only its `digest` is known:
 * the page's data comes from the API, so it is treated as temporary too — retried a few times, then
 * handed to the customer with its reference code. Anything else (a bug in the page itself) is generic.
 */
export function classifyError(error: Error & { digest?: string }): ClassifiedError {
  if (isApiError(error)) {
    return {
      kind: TRANSIENT_STATUSES.has(error.status) ? "transient" : "generic",
      reference: error.requestId || (error as { digest?: string }).digest,
    };
  }
  const hiddenServerFailure = Boolean(error.digest) && HIDDEN_SERVER_MESSAGE.test(error.message);
  return {
    kind: isNetworkFailure(error) || hiddenServerFailure ? "transient" : "generic",
    reference: error.digest,
  };
}

/** Delays between the automatic retries, in ms: patient enough for a restart, short enough to feel alive. */
export const RETRY_DELAYS_MS: readonly number[] = [3000, 6000, 12000];
