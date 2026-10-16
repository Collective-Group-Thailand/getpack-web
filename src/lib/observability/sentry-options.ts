/**
 * The Sentry options every runtime shares, as a pure function of its inputs.
 *
 * Kept free of `process.env` and of `@sentry/*` so it can be unit-tested: the decisions worth
 * getting right here — whether Sentry runs at all, what fraction of traces are sampled, which
 * hosts get a `traceparent` — are cheap to assert and expensive to discover in production.
 */

import { ZONES, type Zone } from "@/lib/zones";

export interface SentryInputs {
  dsn: string | undefined;
  environment: string | undefined;
  release: string | undefined;
  zone: Zone | undefined;
  /** `true` in `next dev`; sampling and debug differ. */
  isDev: boolean;
}

export interface SentryOptions {
  dsn: string;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
  tracePropagationTargets: (string | RegExp)[];
  initialScope: { tags: Record<string, string> };
  sendDefaultPii: false;
}

/**
 * Sampling. Errors are always sent; this is about *traces*, which are the expensive part.
 *
 * 10 % in production is the usual starting point for a site of this size — enough to see a
 * slow endpoint, not enough to matter on the bill. Everything in development, because there
 * the point is to look at the one request you just made.
 */
export const TRACES_SAMPLE_RATE = { development: 1, production: 0.1 } as const;

/**
 * Where a `traceparent` header may be sent.
 *
 * Deliberately narrow. A trace header on a cross-origin request leaks the fact that this page
 * is instrumented, and on a third-party endpoint it can trip CORS preflight failures that look
 * like the feature is broken. The browser only ever talks to this app's own origin
 * (`/bff/*` — ADR-0005), so same-origin relative paths are the whole list.
 */
export const TRACE_PROPAGATION_TARGETS: (string | RegExp)[] = [/^\//];

/**
 * `null` when Sentry should not start.
 *
 * No DSN means no Sentry: a local checkout and a CI run must not try to reach an ingest
 * endpoint, and every `Sentry.*` call has to stay a no-op rather than throwing.
 */
export function sentryOptions({ dsn, environment, release, zone, isDev }: SentryInputs): SentryOptions | null {
  if (!dsn) return null;

  return {
    dsn,
    environment: environment ?? (isDev ? "development" : "production"),
    release,
    tracesSampleRate: isDev ? TRACES_SAMPLE_RATE.development : TRACES_SAMPLE_RATE.production,
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
    // Three zones, one DSN: the tag is what makes "errors on the storefront" a question
    // anyone can answer. Server-side it comes from the header the proxy stamps, client-side
    // from the host — see `zoneFromHost`.
    initialScope: { tags: zone ? { zone } : {} },
    // PDPA (D-144): getpack does not send IP addresses, cookies or request bodies to a
    // third-party processor by default. A screen that needs more context attaches it
    // deliberately, and the request id is already in every error state for support.
    sendDefaultPii: false,
  };
}

/**
 * The zone a browser is in, from its own hostname.
 *
 * The client cannot read `x-getpack-zone` — that is a request header the proxy stamps for
 * server code — and it cannot read `ADMIN_HOST` either, which is a server variable. What it
 * can see is the host it was served from, and the zone hosts are distinct by construction
 * (00-master-plan.md §2). Matching on the leftmost label covers `admin.getpack.co` and
 * `admin.localhost:3000` alike, without the client needing the configured values.
 */
export function zoneFromHost(hostname: string): Zone {
  const label = hostname.split(".")[0]?.toLowerCase();
  return (ZONES as readonly string[]).includes(label ?? "") && label !== "customer" ? (label as Zone) : "customer";
}
