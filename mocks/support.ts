/**
 * Shared plumbing for the mock API: problem details, mock tokens, and who a request is from.
 *
 * Every mock token carries its audience — and, for staff, the persona — in the string. The real
 * API checks a signed JWT's `aud` (api-conventions §2); the mock only needs to reproduce the
 * behaviour the UI depends on: a customer session cannot open the admin zone, and a CS agent
 * sees a CS agent's menu.
 */

import { HttpResponse } from "msw";

export type Audience = "customer" | "staff" | "partner";

/** A fixed, obviously fake request id, so a support note in a test screenshot is recognisable. */
export const MOCK_REQUEST_ID = "00000000-0000-4000-8000-000000000000";

export function problem(
  status: number,
  code: string,
  detail: string,
  errors?: { path: string; code: string; message: string }[],
) {
  return HttpResponse.json(
    {
      type: `https://errors.getpack/${code}`,
      title: code,
      status,
      code,
      detail,
      requestId: MOCK_REQUEST_ID,
      ...(errors ? { errors } : {}),
    },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

export const accessToken = (audience: Audience, persona?: string) =>
  persona ? `seed.access.token.${audience}.${persona}` : `seed.access.token.${audience}`;
export const refreshToken = (audience: Audience, persona?: string) =>
  persona ? `seed-refresh-token-${audience}-${persona}` : `seed-refresh-token-${audience}`;

export interface Principal {
  audience: Audience;
  /** The staff persona key, e.g. `cs`; undefined for customers and partners. */
  persona?: string;
}

/** Reads the mock bearer token back into who sent it, or `null` when there is none. */
export function principalOf(request: Request): Principal | null {
  const header = request.headers.get("authorization");
  const value = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const match = value?.match(/^seed\.access\.token\.(customer|staff|partner)(?:\.([a-z0-9_]+))?$/);
  if (!match) return null;
  return { audience: match[1] as Audience, persona: match[2] };
}

/** Parses a mock refresh token the same way. */
export function principalOfRefresh(token: string | undefined): Principal | null {
  const match = token?.match(/^seed-refresh-token-(customer|staff|partner)(?:-([a-z0-9_]+))?$/);
  if (!match) return null;
  return { audience: match[1] as Audience, persona: match[2] };
}

/** Deterministic fake uuids: `mockId("a", 7)` → `00000000-0000-4000-8000-0000000a0007`. */
export function mockId(namespace: string, n: number): string {
  const hex = [...namespace]
    .map((c) => c.charCodeAt(0).toString(16))
    .join("")
    .slice(0, 6)
    .padStart(6, "0");
  return `00000000-0000-4000-8000-${hex}${n.toString(16).padStart(6, "0")}`;
}

/** An ISO timestamp `minutes` from now, with the Bangkok offset the API renders (api-conventions §3). */
export function bangkokIso(minutesFromNow = 0): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000 + 7 * 60 * 60_000);
  return `${date.toISOString().slice(0, 19)}+07:00`;
}

/** Pages an array the way every list endpoint does (api-conventions §3). */
export function paginate<T>(rows: readonly T[], query: { page?: number; perPage?: number }) {
  const page = query.page ?? 1;
  const perPage = Math.min(query.perPage ?? 25, 100);
  return { data: rows.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total: rows.length } };
}

/** Case-insensitive match of `q` against any of the given fields. */
export function matchesQuery(q: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

/** Sorts by a field name the list endpoint allows, the way `?sort=&order=` asks. */
export function sortBy<T>(rows: T[], sort: string | undefined, order: "asc" | "desc" | undefined): T[] {
  if (!sort) return rows;
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = (a as Record<string, unknown>)[sort];
    const right = (b as Record<string, unknown>)[sort];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    return (
      (typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "th")) * direction
    );
  });
}

/** A weak `ETag` for version `version` of the mock aggregate `id` — the form the API sends. */
export const versionTag = (id: string, version: number) => `W/"${id}.${version}"`;

/** A JSON answer that carries the aggregate's `ETag`, for the next edit's `If-Match`. */
export function withEtag(body: unknown, etag: string, status = 200) {
  return HttpResponse.json(body as never, { status, headers: { ETag: etag } });
}

/**
 * The API's optimistic-concurrency check (api-conventions §3): `428` without `If-Match`,
 * `412` when it names another version. `null` means the edit may go ahead.
 */
export function precondition(request: Request, current: string): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "concurrency.precondition_required", "ต้องส่ง If-Match");
  if (match !== current) return problem(412, "concurrency.stale", "ข้อมูลนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
  return null;
}

/**
 * The saved-quotation fields U2.1–U3.B4 added (v0.13.0–v0.20.0) at their empty values: no frozen
 * dimensions (absent = internal, U2.1 assumption 4), no share expiry, no advisor choice, no target,
 * no outcome yet, not from a lever, no dieline quantities.
 */
export const QUOTE_V2_EMPTY = {
  dimensions: null,
  shareExpiresAt: null,
  advisory: null,
  targetPricePerUnit: null,
  outcome: null,
  fromLever: null,
  dielineQuantities: null,
} as const;

/** The RFQ fields U2.1, U2.3 and U3.B4 added: the basis (backfilled `internal`), no target, style or design. */
export const RFQ_V2_EMPTY = {
  measurementBasis: "internal",
  targetPricePerUnit: null,
  style: null,
  design: null,
} as const;
