import type { Zone } from "@/lib/zones";

/**
 * Per-zone Content-Security-Policy (F1 1.1). Built as a directive record rather than a
 * hand-concatenated string so later deliverables add one origin in one place — 1.2 adds the
 * Firebase and LINE sign-in origins, 1.3 the analytics, realtime and Sentry ones.
 *
 * `'strict-dynamic'` with a per-request nonce is the point: the nonce lets Next's own
 * bootstrap run, `'strict-dynamic'` lets it load the chunks it needs, and every other
 * script — including one injected into a stored product description — is refused without
 * anyone having to maintain a host allow-list for scripts.
 */
export interface CspOptions {
  nonce: string;
  /** Development needs `'unsafe-eval'` and inline styles for HMR and React Refresh. */
  isDev: boolean;
  origins: CspOrigins;
}

export interface CspOrigins {
  /** S3/CDN for imagery and downloads. */
  asset?: string;
  /** Realtime transport (SSE endpoint or Pusher host). */
  realtime?: string;
  /** Sentry ingest, when a DSN is configured. */
  sentry?: string;
}

/** Google Tag Manager / GA4 — customer host only (D-102, F1 1.3). */
const ANALYTICS_SCRIPT = ["https://www.googletagmanager.com"];
const ANALYTICS_CONNECT = ["https://www.google-analytics.com", "https://*.analytics.google.com"];
const ANALYTICS_IMG = ["https://www.googletagmanager.com", "https://www.google-analytics.com"];

export function cspDirectives(zone: Zone, { nonce, isDev, origins }: CspOptions): Record<string, string[]> {
  const isCustomer = zone === "customer";
  const extra = [origins.asset, origins.realtime, origins.sentry].filter((value): value is string => Boolean(value));

  return {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isCustomer ? ANALYTICS_SCRIPT : []),
      // Turbopack's HMR client and React Refresh are eval-based; production is not.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    /*
     * Styles are `'unsafe-inline'`, deliberately, and it is not the same trade as it would
     * be for scripts.
     *
     * A nonce in `style-src` makes the browser **ignore** `'unsafe-inline'` — they cannot be
     * combined — and three things in this app apply styles that cannot carry a nonce:
     * `sonner` injects its 15 KB stylesheet from a `document.createElement('style')` at
     * module evaluation (`__insertCSS`, no nonce option and no way to opt out), Turbopack
     * does the same for CSS in development, and Radix and Konva set `style` attributes,
     * which have nowhere to put a nonce. Nonced styles would leave every page reporting
     * violations on load — and a policy that cries wolf on every page is one nobody reads.
     *
     * What is given up is narrow: `script-src` keeps its nonce and `'strict-dynamic'`, so
     * injected *script* is still refused, and `img-src`/`font-src`/`connect-src` still bound
     * where a CSS-based exfiltration attempt could send anything.
     */
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...(origins.asset ? [origins.asset] : []),
      ...(isCustomer ? ANALYTICS_IMG : []),
    ],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...extra,
      ...(isCustomer ? ANALYTICS_CONNECT : []),
      // The dev server's HMR socket.
      ...(isDev ? ["ws:", "wss:"] : []),
    ],
    // The designer renders to a canvas and exports PDFs through blob: URLs.
    "worker-src": ["'self'", "blob:"],
    "form-action": ["'self'"],
    "frame-src": ["'self'"],
    // The storefront may be embedded by LINE's in-app browser; a staff or factory screen
    // may never be framed at all.
    "frame-ancestors": isCustomer ? ["'self'"] : ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };
}

export function serialiseCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([directive, values]) => (values.length > 0 ? `${directive} ${values.join(" ")}` : directive))
    .join("; ");
}

export function contentSecurityPolicy(zone: Zone, options: CspOptions): string {
  return serialiseCsp(cspDirectives(zone, options));
}

/** 128 bits of randomness, base64 — regenerated for every request. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
