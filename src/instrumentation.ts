/**
 * Starts the mock API when `API_MOCKS=1` (`pnpm dev:mock`, and the e2e suite).
 *
 * MSW intercepts in-process, so it has to run in the same Node runtime that makes the calls:
 * Server Components, Server Actions and the BFF route handlers. `register()` is the one hook
 * Next gives that runs once, at server start, before any request.
 *
 * The import is dynamic and guarded so `msw` — a devDependency — never enters a production
 * bundle, and the whole module is inert unless the flag is set.
 */
export async function register(): Promise<void> {
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

  process.stdout.write("[packio] API mocks are serving this process (API_MOCKS=1)\n");
}
