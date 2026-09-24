import * as Sentry from "@sentry/nextjs";

import { ZONE_HEADER } from "@/lib/zones";

/**
 * The one hook Next gives that runs once at server start, before any request.
 *
 * Two things need it, and they must not tread on each other: Sentry's per-runtime init, and
 * the mock API. Sentry's own instructions are to create this file with its `register()`; this
 * repo already had one for MSW, so they are merged here rather than one quietly replacing the
 * other — which would have disabled `pnpm dev:mock` and the whole e2e suite with it.
 */
export async function register(): Promise<void> {
  await registerSentry();
  await registerApiMocks();
}

/**
 * Sentry is imported per runtime, dynamically, because the two configs pull in different SDKs
 * (`@sentry/node` and `@sentry/vercel-edge`) and a static import of either would drag it into
 * the wrong bundle.
 */
async function registerSentry(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

/**
 * Starts the mock API when `API_MOCKS=1` (`pnpm dev:mock`, and the e2e suite).
 *
 * MSW intercepts in-process, so it has to run in the same Node runtime that makes the calls:
 * Server Components, Server Actions and the BFF route handlers.
 *
 * The import is dynamic and guarded so `msw` — a devDependency — never enters a production
 * bundle, and the whole function is inert unless the flag is set.
 */
async function registerApiMocks(): Promise<void> {
  if (process.env.API_MOCKS !== "1") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { server } = await import("@mocks/node");
  server.listen({
    /**
     * Warn only about calls to the API.
     *
     * MSW intercepts every request this process makes, and Next makes plenty to itself —
     * RSC payloads, prefetches, its own route handlers. Warning about those would print a
     * paragraph per navigation and teach everyone to ignore the warnings, including the one
     * that matters: an API call no handler covers, which would otherwise fail silently
     * against a backend that is not running.
     */
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/v1/") || pathname === "/health") print.warning();
    },
  });

  // `console.info`, not `process.stdout`: Next compiles this module for the edge runtime as
  // well, where `process.stdout` does not exist — and warns about it on every build, even
  // though the guard above means that copy never runs.
  console.info("[packio] API mocks are serving this process (API_MOCKS=1)");
}

/**
 * Every server-side error Next catches, reported with the zone it happened in.
 *
 * The zone is per request — one process answers all three hosts — so this is where it can be
 * tagged at all. `src/proxy.ts` stamps `x-packio-zone` before anything else runs, so it is on
 * every request that reached application code.
 */
export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  const zone = request.headers?.[ZONE_HEADER];
  if (typeof zone === "string") {
    Sentry.withScope((scope) => {
      scope.setTag("zone", zone);
      Sentry.captureRequestError(error, request, context);
    });
    return;
  }

  Sentry.captureRequestError(error, request, context);
};
