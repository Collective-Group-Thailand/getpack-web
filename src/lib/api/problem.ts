/**
 * RFC 9457 problem details (`docs/contract/api-conventions.md` §3) as one typed error.
 *
 * Every failure from `packio-api` arrives as `application/problem+json` with a stable
 * machine-readable `code`, a `detail` already localised by `Accept-Language`, an optional
 * field-level `errors[]`, and a `requestId` that support can quote. `ApiError` carries all
 * of it, so a screen never has to parse a response body or guess at a message.
 */

import type { Schemas } from "./types";

export type ProblemDetails = Schemas["ProblemDetails"];
export type ProblemFieldError = Schemas["ProblemFieldError"];

/** `code` values this app branches on. Everything else is handled by status alone. */
export const PROBLEM_CODES = {
  staleConcurrency: "concurrency.stale",
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly requestId: string;
  readonly errors: readonly ProblemFieldError[];

  constructor(problem: ProblemDetails) {
    // `detail` is the Thai (or English) sentence the API wrote for a human; it is the only
    // part worth putting in `message`, which is what an unhandled rejection would surface.
    super(problem.detail);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.title = problem.title;
    this.detail = problem.detail;
    this.requestId = problem.requestId;
    this.errors = problem.errors ?? [];
  }

  /** True when retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }

  /** True when the actor has no session, or the session no longer authenticates. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** True when the aggregate changed under the caller and the edit must be rebased. */
  get isStale(): boolean {
    return this.status === 412 || this.code === PROBLEM_CODES.staleConcurrency;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProblemDetails>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.detail === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.title === "string"
  );
}

/**
 * Builds an `ApiError` from a failed response.
 *
 * A body that is not problem details is not a reason to lose the failure: a gateway 502, an
 * HTML error page from a proxy, or a body that never arrived all still produce an `ApiError`
 * with the status, the request id from the response headers, and a synthetic code, so error
 * states have something to show and support has something to trace.
 */
export async function toApiError(response: Response, fallbackRequestId?: string): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id") ?? fallbackRequestId ?? "";

  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    body = null;
  }

  if (isProblemDetails(body)) {
    return new ApiError({ ...body, requestId: body.requestId || requestId });
  }

  return new ApiError({
    type: `https://errors.packio/http.${response.status}`,
    title: response.statusText || "Request failed",
    status: response.status,
    code: `http.${response.status}`,
    detail: response.statusText || `The request failed with status ${response.status}.`,
    requestId,
  });
}

/** The subset of react-hook-form's `setError` this module needs, so it can be tested alone. */
type SetFieldError = (path: string, error: { type: string; message: string }) => void;

export interface ApplyProblemOptions {
  /** Paths the form actually owns. An error for anything else is returned, not swallowed. */
  fields?: readonly string[];
}

/**
 * Maps `errors[]` onto a react-hook-form and returns whatever could not be placed.
 *
 * The contract's `path` is already RHF's syntax — `items[0].quantity` — so no translation is
 * needed. What does need care is an error for a field the form does not render: setting it
 * would attach a message nothing displays, and the user would see a form that refuses to
 * submit with nothing marked. Those come back to the caller for the error summary instead.
 */
export function applyProblemToForm(
  error: ApiError,
  setError: SetFieldError,
  { fields }: ApplyProblemOptions = {},
): ProblemFieldError[] {
  const unplaced: ProblemFieldError[] = [];

  for (const fieldError of error.errors) {
    const owned = fields === undefined || fields.includes(rootPath(fieldError.path));
    if (!owned) {
      unplaced.push(fieldError);
      continue;
    }
    setError(fieldError.path, { type: fieldError.code, message: fieldError.message });
  }

  return unplaced;
}

/** `items[0].quantity` → `items`; a form registers `items`, not every leaf beneath it. */
function rootPath(path: string): string {
  return path.split(/[.[]/, 1)[0] ?? path;
}
