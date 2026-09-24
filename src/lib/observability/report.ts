/**
 * Reporting an error from the browser, without putting the Sentry SDK on every page.
 *
 * A static `import * as Sentry from "@sentry/nextjs"` costs about **133 KB gzipped** in the
 * client bundle whether or not a DSN is configured — measured, not guessed — against a 150 KB
 * initial-JS budget for storefront pages (`docs/performance-budgets.md`). Skipping `init()` at
 * runtime does not help: the module is already in the graph by then.
 *
 * So the import is dynamic and guarded by the DSN. `NEXT_PUBLIC_SENTRY_DSN` is inlined at
 * build time, so with no DSN the branch is statically false and the bundler drops the SDK
 * entirely; with one, it becomes an async chunk fetched after hydration rather than something
 * the first paint waits for.
 *
 * The **server** SDK is imported statically, in `sentry.server.config.ts` and
 * `sentry.edge.config.ts`. There is no bundle to protect there, and server-side reporting is
 * the half that works without shipping anything to anyone.
 */

/** `true` when this build was given a browser DSN. Statically known, so it is tree-shakeable. */
export const browserSentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

/**
 * Reports an error the browser caught — a render failure in an error boundary, mainly.
 *
 * Never throws and never rejects: an error while reporting an error must not replace the
 * message the person is reading with a worse one.
 */
export function reportError(error: unknown): void {
  if (!browserSentryEnabled) return;

  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      // Sentry is unreachable or blocked. Nothing useful is left to do with this.
    });
}
