/**
 * Sentry for the Node runtime — Server Components, Server Actions, BFF route handlers.
 *
 * Loaded by `src/instrumentation.ts`. Lives at the repo root because that is where Sentry's
 * build plugin looks for it; the decisions it makes are in `src/lib/observability`.
 */
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/observability/sentry-options";

const options = sentryOptions({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.SENTRY_RELEASE,
  // The zone is per *request*, not per process — one server answers all three hosts — so it
  // is tagged in `onRequestError`, where the request is in hand.
  zone: undefined,
  isDev: process.env.NODE_ENV === "development",
});

if (options) Sentry.init(options);
