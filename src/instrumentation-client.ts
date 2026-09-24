/**
 * Sentry in the browser — loaded only when this build has a DSN.
 *
 * The guard is a build-time constant, so with no `NEXT_PUBLIC_SENTRY_DSN` the branch is
 * statically false and the SDK never enters the client bundle. That is worth about 133 KB
 * gzipped against the 150 KB storefront budget; see `src/lib/observability/report.ts`.
 *
 * Session Replay and profiling are not imported at all. They are the bulk of what remains,
 * Replay records what a customer typed — a PDPA question nobody has asked (D-144) — and
 * neither is needed to answer "what broke".
 */
import { browserSentryEnabled } from "@/lib/observability/report";
import { sentryOptions, zoneFromHost } from "@/lib/observability/sentry-options";

if (browserSentryEnabled) {
  void import("@sentry/nextjs").then((Sentry) => {
    const options = sentryOptions({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_ENV_BADGE,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
      // The browser cannot read `x-packio-zone` (a request header) or `ADMIN_HOST` (a server
      // variable), but it can see the host it was served from, and the zone hosts are
      // distinct by construction (00-master-plan.md §2).
      zone: zoneFromHost(window.location.host),
      isDev: process.env.NODE_ENV === "development",
    });
    if (options) Sentry.init(options);
  });
}

/**
 * Next calls this on every client-side navigation so route changes appear in traces.
 *
 * It has to be exported synchronously, so it forwards into the same lazily-loaded module. A
 * navigation during the first moments of a page load may land before the SDK has arrived and
 * go untraced; that is the cost of not making every visitor download it.
 */
export function onRouterTransitionStart(...args: unknown[]): void {
  if (!browserSentryEnabled) return;

  void import("@sentry/nextjs")
    .then((Sentry) => {
      (Sentry.captureRouterTransitionStart as (...a: unknown[]) => void)(...args);
    })
    .catch(() => {});
}
