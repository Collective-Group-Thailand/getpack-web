/**
 * Barrel for everything that is safe in either runtime.
 *
 * `serverApi` and `browserApi` are imported by path (`@/lib/api/server`, `@/lib/api/browser`)
 * and deliberately not re-exported here: one pulls in `next/headers` and `server-only`, the
 * other is a Client Component module, and a barrel that re-exported both would drag one into
 * every file that wanted the other.
 */

export {
  createApiClient,
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  ifMatch,
  newIdempotencyKey,
  REQUEST_ID_HEADER,
  requiresIdempotencyKey,
  upstreamApi,
  type ApiClientOptions,
} from "./client";
export {
  ApiError,
  applyProblemToForm,
  isApiError,
  toApiError,
  type ProblemDetails,
  type ProblemFieldError,
} from "./problem";
export { queryKeys, type QueryParams } from "./query-keys";
export type {
  ApiPaths,
  ContractPaths,
  CustomerMe,
  MenuEntitlement,
  PartnerMe,
  Schemas,
  Session,
  StaffMe,
} from "./types";
