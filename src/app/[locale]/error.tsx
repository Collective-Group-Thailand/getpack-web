"use client";

import { RouteError } from "@/features/customer/shell/RouteError";

/**
 * Segment error boundary. `digest` is the id Next puts in the server log for this failure, so
 * it is shown as the support code (api-conventions §3); an `ApiError` brings its `requestId`.
 * Temporary failures retry by themselves — see `RouteError`.
 *
 * The error is reported there explicitly. `onRequestError` in `src/instrumentation.ts` catches
 * what fails on the server, but a component that throws while *rendering in the browser* never
 * reaches it — React hands it to this boundary instead, and without the report it would be
 * invisible.
 */
export default function ErrorBoundary(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />;
}
