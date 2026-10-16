/**
 * Plumbing for the finance mocks: handlers for **published** operations, typed by the contract.
 *
 * `mockRequest` holds a contract request to its zod schema; the B5 surface is published, so the
 * shapes are the generated ones instead. `finance.get("/v1/admin/slips", …)` takes the OpenAPI
 * path template and types the resolver's return value as that operation's success body — a
 * mock that drifts from what getpack-api published stops compiling. It also does what every B5
 * operation does before its business rule: a staff token (401), the operation's
 * `x-required-permissions` (403), and — where the contract requires `Idempotency-Key` — a 400
 * without one and the original answer on a replay (api-conventions §3).
 */

import { http, HttpResponse } from "msw";

import type { ApiPaths } from "@/lib/api/types";

import { staffPersonaOf } from "../../auth";
import { can, personaByKey, type StaffPersona } from "../../personas";
import { problem } from "../../support";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Operation<P extends keyof ApiPaths, M extends Method> = NonNullable<ApiPaths[P][M]>;
type JsonOf<R> = R extends { content: { "application/json": infer B } } ? B : void;
/** The body of an operation's lowest 2xx. */
export type SuccessOf<O> = O extends { responses: infer R }
  ? 200 extends keyof R
    ? JsonOf<R[200]>
    : 201 extends keyof R
      ? JsonOf<R[201]>
      : 202 extends keyof R
        ? JsonOf<R[202]>
        : void
  : never;
export type BodyOf<O> = O extends { requestBody: { content: { "application/json": infer B } } }
  ? B
  : O extends { requestBody?: { content: { "application/json": infer B } } }
    ? B | undefined
    : undefined;
type QueryOf<O> = O extends { parameters: { query?: infer Q } } ? Partial<NonNullable<Q>> : Record<string, never>;

export interface FinanceContext<P extends keyof ApiPaths, M extends Method> {
  params: Record<string, string>;
  query: QueryOf<Operation<P, M>>;
  body: BodyOf<Operation<P, M>>;
  persona: StaffPersona;
  request: Request;
}

type Result<P extends keyof ApiPaths, M extends Method> =
  SuccessOf<Operation<P, M>> | Response | Promise<SuccessOf<Operation<P, M>> | Response>;

interface Options {
  /** The operation's `x-required-permissions` (any one of them is enough when several). */
  permission: string | readonly string[] | null;
  /** The contract requires `Idempotency-Key`: refuse without one, replay the first answer. */
  idempotent?: boolean;
  status?: 200 | 201 | 202 | 204;
}

const NUMERIC_QUERY = new Set(["page", "perPage", "olderThanDays", "limit"]);

function parseQuery(url: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of new URL(url).searchParams) {
    if (value === "") continue;
    out[key] = NUMERIC_QUERY.has(key) && /^\d+$/.test(value) ? Number(value) : value;
  }
  return out;
}

const toMswPath = (template: string) => `*${template.replace(/\{([^}]+)\}/g, ":$1")}`;

/** Replays by key: the first answer to an `Idempotency-Key` is the answer (api-conventions §3). */
const replays = new Map<string, { status: number; body: string | null; contentType: string | null }>();

function handler<P extends keyof ApiPaths, M extends Method>(
  method: M,
  path: P,
  options: Options,
  resolve: (context: FinanceContext<P, M>) => Result<P, M>,
) {
  return http[method](toMswPath(path as string), async ({ request, params }) => {
    const persona = staffPersonaOf(request);
    if (!persona) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    if (options.permission) {
      const needed = typeof options.permission === "string" ? [options.permission] : options.permission;
      if (!needed.some((permission) => can(persona, permission)))
        return problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
    }
    const key = request.headers.get("idempotency-key");
    if (options.idempotent) {
      if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
      const seen = replays.get(`${persona.id}:${key}`);
      if (seen)
        return new HttpResponse(seen.body, {
          status: seen.status,
          headers: { "Idempotent-Replayed": "true", ...(seen.contentType ? { "content-type": seen.contentType } : {}) },
        });
    }
    let body: unknown;
    if (method !== "get" && method !== "delete") body = await request.json().catch(() => undefined);

    const result = await resolve({
      params: params as Record<string, string>,
      query: parseQuery(request.url) as FinanceContext<P, M>["query"],
      body: body as FinanceContext<P, M>["body"],
      persona,
      request,
    });
    const response =
      result instanceof Response
        ? result
        : options.status === 204 || result === undefined
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json(result as never, { status: options.status ?? 200 });
    // A failed attempt releases the key (the contract's IdempotencyKey description); a success is kept.
    if (options.idempotent && key && response.ok) {
      const text = response.status === 204 ? null : await response.clone().text();
      replays.set(`${persona.id}:${key}`, {
        status: response.status,
        body: text,
        contentType: response.headers.get("content-type"),
      });
    }
    return response;
  });
}

export const finance = {
  get: <P extends keyof ApiPaths>(
    path: P,
    permission: Options["permission"],
    resolve: (context: FinanceContext<P, "get">) => Result<P, "get">,
  ) => handler("get", path, { permission }, resolve),
  post: <P extends keyof ApiPaths>(
    path: P,
    options: Options,
    resolve: (context: FinanceContext<P, "post">) => Result<P, "post">,
  ) => handler("post", path, options, resolve),
  put: <P extends keyof ApiPaths>(
    path: P,
    options: Options,
    resolve: (context: FinanceContext<P, "put">) => Result<P, "put">,
  ) => handler("put", path, options, resolve),
  patch: <P extends keyof ApiPaths>(
    path: P,
    options: Options,
    resolve: (context: FinanceContext<P, "patch">) => Result<P, "patch">,
  ) => handler("patch", path, options, resolve),
  delete: <P extends keyof ApiPaths>(
    path: P,
    options: Options,
    resolve: (context: FinanceContext<P, "delete">) => Result<P, "delete">,
  ) => handler("delete", path, options, resolve),
};

export function persona(key: string): StaffPersona {
  const found = personaByKey(key);
  if (!found) throw new Error(`[finance mock] no persona ${key}`);
  return found;
}

/** A contract request's permission check (mockRequest does the token; the rule is the module's). */
export function forbiddenUnless(request: Request, permission: string): Response | null {
  return can(staffPersonaOf(request), permission) ? null : problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
}

export const notFound = (what: string) => problem(404, "http.not_found", `ไม่พบ${what}นี้`);

export const invalid = (errors: { path: string; code: string; message: string }[]) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", errors);

/** A money string the contract accepts: two decimals, not negative. */
export const isMoney = (value: unknown): value is string => typeof value === "string" && /^\d+\.\d{2}$/.test(value);
