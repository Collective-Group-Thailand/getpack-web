/**
 * Sentry for the edge runtime, which is where `src/proxy.ts` runs.
 *
 * Worth having separately from the Node config: the proxy decides the zone, refreshes
 * sessions and sets the CSP for every single request, so a failure here is invisible in
 * application logs and takes out the whole host rather than one page.
 */
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/observability/sentry-options";

const options = sentryOptions({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.SENTRY_RELEASE,
  zone: undefined,
  isDev: process.env.NODE_ENV === "development",
});

if (options) Sentry.init(options);
