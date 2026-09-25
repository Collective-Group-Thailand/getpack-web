/**
 * Contract requests as code (ADR-0006, CLAUDE.md "if an endpoint does not exist…").
 *
 * An endpoint the frontend needs and `packio-api` has not shipped is written down **once**,
 * here, as a zod schema — and that one definition does four jobs:
 *
 * 1. **Types the call site.** `requests.call("GET /v1/admin/saved-views", …)` is typed by the
 *    schema, so no screen hand-writes a response type (the rule F1 followed with one-off
 *    interfaces, which stops scaling past a handful of endpoints).
 * 2. **Keeps the mock honest.** Every MSW handler for a request validates what it returns
 *    against the same schema (`mocks/requests/route.ts`), so a mock cannot quietly drift from
 *    what the backend was asked for.
 * 3. **Is the handoff.** `pnpm gen:api` renders the registry as an OpenAPI 3.1 document,
 *    `docs/contract-requests.openapi.json`, which the backend can diff against what it builds.
 * 4. **Retires itself.** `registry.test.ts` fails the moment a request's method and path
 *    appear in `contract/openapi.json`: delete the entry, call `browserApi` / `serverApi`, and
 *    let the type errors show what the real shape changed.
 *
 * Shapes are derived, not invented: the backend's approved `docs/schema-design.md` (tables,
 * columns and the §4 enum catalogue), the B2–B6 prompts, and api-conventions §3 for envelopes.
 * Every entry names the id of its row in `docs/contract-requests.md`.
 */

import { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestDefinition<
  TQuery extends z.ZodType = z.ZodType,
  TBody extends z.ZodType = z.ZodType,
  TResponse extends z.ZodType = z.ZodType,
  TIdempotent extends boolean = boolean,
> {
  /** The `docs/contract-requests.md` row this belongs to. */
  request: string;
  summary: string;
  /** Decision ids the endpoint implements, for the handoff document. */
  decisions?: readonly string[];
  query?: TQuery;
  body?: TBody;
  /** Absent for a `204`. */
  response?: TResponse;
  /** `201`, `202` or `204` when not `200`. */
  status?: 200 | 201 | 202 | 204;
  /**
   * An irreversible operation (api-conventions §3). The caller must pass `idempotencyKey` —
   * the type of `call` enforces it — and the key is generated once per user intent.
   */
  idempotent?: TIdempotent;
  /** Editable aggregate: the caller sends `If-Match`. */
  concurrency?: boolean;
}

/** Declares one request; the identity function exists for inference. */
export function request<
  TQuery extends z.ZodType = z.ZodNever,
  TBody extends z.ZodType = z.ZodNever,
  TResponse extends z.ZodType = z.ZodNever,
  TIdempotent extends boolean = false,
>(
  definition: RequestDefinition<TQuery, TBody, TResponse, TIdempotent>,
): RequestDefinition<TQuery, TBody, TResponse, TIdempotent> {
  return definition;
}

/* ---------------------------------------------------------------------------------------- *
 * Scalars — api-conventions §3 in zod.
 * ---------------------------------------------------------------------------------------- */

export const uuid = () => z.string().uuid();

/** Money: a decimal string with exactly two decimals. Never a number (CLAUDE.md). */
export const money = () =>
  z
    .string()
    .regex(/^-?\d+\.\d{2}$/)
    .describe("Money (THB, 2 decimals)");

/** A percentage as a decimal string, e.g. `"12.5000"` = 12.5 % — the contract's own convention. */
export const pct = () =>
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .describe("Percent as a decimal string");

/** ISO 8601 with offset, rendered by the API in Asia/Bangkok. */
export const dateTime = () => z.string().datetime({ offset: true });

/** `YYYY-MM-DD`. */
export const date = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const currency = () => z.literal("THB");

/** A reference to another record by public id plus the human key staff search by. */
export const ref = () => z.object({ id: uuid(), code: z.string(), name: z.string() });

/** A user as the contract's `UserRefDto` spells it. */
export const userRef = () => z.object({ id: uuid(), displayName: z.string() });

/** An action the API offers on an entity (`entity.next-actions`, api-conventions §3). */
export const nextAction = () =>
  z.object({
    key: z.string(),
    irreversible: z.boolean().optional(),
    disabledReason: z.string().nullable().optional(),
  });

/** A file the API hands back: its id, name and a short-lived signed URL (api-conventions §3). */
export const fileRef = () =>
  z.object({
    id: uuid(),
    originalName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int(),
    thumbnailUrl: z.string().nullable(),
    url: z.string().nullable(),
  });

/* ---------------------------------------------------------------------------------------- *
 * Envelopes — api-conventions §3.
 * ---------------------------------------------------------------------------------------- */

export const pageMeta = z.object({ page: z.number().int(), perPage: z.number().int(), total: z.number().int() });

/** `{ data, meta: { page, perPage, total } }`. */
export const page = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: pageMeta });

/** `{ data, meta: { nextCursor } }`. */
export const cursorPage = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: z.object({ nextCursor: z.string().nullable() }) });

/** The standard list query. Numbers are coerced because a query string holds only text. */
export const listQuery = <T extends z.ZodRawShape>(filters: T) =>
  z.object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
    q: z.string().optional(),
    ...filters,
  });

export type Page<T> = { data: T[]; meta: z.infer<typeof pageMeta> };
