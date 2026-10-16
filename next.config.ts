// v11 moved the build-time wrapper to its own subpath; the runtime SDK stays at "@sentry/nextjs".
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

import { assertThirdPartyAssets } from "./build-checks/no-untracked-third-party-assets.mjs";

// A production build (and `next start`) refuses images under public/media without a known licence
// in their folder's manifest — e.g. the dev-only interim home photos (`HOME_PHOTOS_LOCAL_MANIFEST`).
if (process.env.NODE_ENV === "production") assertThirdPartyAssets();

const nextConfig: NextConfig = {
  // CLAUDE.md in this repo is hand-written project documentation (see its "Read before
  // every task" list); Next 16 would otherwise overwrite it with generated agent rules.
  agentRules: false,
  // The workspace package is shipped as TypeScript source for local development;
  // publishConfig points the published copy at dist/ instead.
  transpilePackages: ["@getpack/dieline"],
  async redirects() {
    return [
      // BoxStudio's "My designs" lives under the customer account area now.
      { source: "/my/designs", destination: "/account/designs", permanent: true },
      { source: "/en/my/designs", destination: "/en/account/designs", permanent: true },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Sentry wraps the build to upload source maps and to instrument the server.
 *
 * `tunnelRoute` is the one option worth explaining: it proxies events through this app's own
 * origin instead of `*.ingest.sentry.io`. That keeps `connect-src` in the per-zone CSP down to
 * `'self'` for error reporting, and means an ad blocker — which most people have — does not
 * quietly swallow the errors we are trying to see.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  // Uploading source maps needs an auth token. Without one the build must still succeed:
  // every local build and every CI run without secrets goes down this path.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  tunnelRoute: "/monitoring",
  // Source maps are uploaded, then deleted, so a stack trace is readable in Sentry and the
  // maps are not served to the public.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  /*
   * Trimming the browser bundle, which is the thing standing between Sentry and the 150 KB
   * initial-JS budget for storefront pages (`docs/performance-budgets.md`).
   *
   * The debug statements are a paragraph of log strings per event that nothing reads in
   * production. The three Replay exclusions matter more than they look: Session Replay is not
   * imported anywhere, but its iframe, shadow-DOM and web-worker helpers are reachable from
   * the SDK's own code and survive tree-shaking unless they are compiled out. Tracing is
   * deliberately *not* excluded — it is what carries `traceparent` to the API.
   */
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
