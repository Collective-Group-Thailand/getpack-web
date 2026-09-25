/**
 * The typed client for contract requests (see `./define.ts`).
 *
 * It rides the same openapi-fetch middleware as `serverApi` / `browserApi` — `Accept-Language`,
 * the request id, CSRF through the BFF, the surface guard, problem details thrown as
 * `ApiError` — so a screen cannot tell a requested endpoint from a published one by how it
 * fails. What differs is only where the types come from.
 */

import type { Client } from "openapi-fetch";
import type { z } from "zod";

import { IDEMPOTENCY_HEADER, ifMatch } from "../client";
import type { HttpMethod, RequestDefinition } from "./define";

type AnyDefinition = RequestDefinition<z.ZodType, z.ZodType, z.ZodType, boolean>;
export type RequestRegistry = Record<string, AnyDefinition>;

type PathOf<K> = K extends `${string} ${infer P}` ? P : never;

/** `/v1/admin/users/{userId}/roles/{grantId}` → `"userId" | "grantId"`. */
type ParamNames<P extends string> = P extends `${string}{${infer Param}}${infer Rest}`
  ? Param | ParamNames<Rest>
  : never;

type Parts<D> = D extends RequestDefinition<infer Q, infer B, infer R, infer I> ? { q: Q; b: B; r: R; i: I } : never;

type IsNever<T> = [T] extends [z.ZodNever] ? true : false;

export type CallInit<R extends RequestRegistry, K extends keyof R & string> = ([ParamNames<PathOf<K>>] extends [never]
  ? { path?: undefined }
  : { path: Record<ParamNames<PathOf<K>>, string> }) &
  (IsNever<Parts<R[K]>["q"]> extends true ? { query?: undefined } : { query?: z.input<Parts<R[K]>["q"]> }) &
  (IsNever<Parts<R[K]>["b"]> extends true ? { body?: undefined } : { body: z.input<Parts<R[K]>["b"]> }) &
  (Parts<R[K]>["i"] extends true ? { idempotencyKey: string } : { idempotencyKey?: undefined }) & {
    /** `ETag` from the last read, for an editable aggregate (api-conventions §3). */
    etag?: string;
    signal?: AbortSignal;
  };

export type ResponseOf<R extends RequestRegistry, K extends keyof R & string> =
  IsNever<Parts<R[K]>["r"]> extends true ? void : z.output<Parts<R[K]>["r"]>;

/** Keys whose init may be omitted entirely — no path params, no required body, no key. */
type OptionalInit<R extends RequestRegistry, K extends keyof R & string> = object extends CallInit<R, K> ? true : false;

export interface RequestClient<R extends RequestRegistry> {
  call<K extends keyof R & string>(
    key: K,
    ...init: OptionalInit<R, K> extends true ? [CallInit<R, K>?] : [CallInit<R, K>]
  ): Promise<ResponseOf<R, K>>;
}

/** Fills `{userId}` from `path`; refuses to send a request with a hole in it. */
export function fillPath(template: string, params: Record<string, string> | undefined): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (!value) throw new Error(`Missing path parameter "${name}" for ${template}`);
    return encodeURIComponent(value);
  });
}

/**
 * Binds a registry to an openapi-fetch client.
 *
 * The client is typed for the published contract; requests are by definition not in it, so it
 * is addressed as an untyped one here — the one cast in this layer, and the registry is what
 * types it back.
 */
export function createRequestClient<R extends RequestRegistry>(_registry: R, client: Client<never>): RequestClient<R> {
  const untyped = client as unknown as Record<
    HttpMethod,
    (
      path: string,
      init: {
        params?: { path?: Record<string, string>; query?: unknown };
        body?: unknown;
        headers?: HeadersInit;
        signal?: AbortSignal;
      },
    ) => Promise<{ data?: unknown }>
  >;

  return {
    async call(key, ...[init]) {
      const [method, path] = key.split(" ") as [HttpMethod, string];
      const options = (init ?? {}) as {
        path?: Record<string, string>;
        query?: Record<string, unknown>;
        body?: unknown;
        idempotencyKey?: string;
        etag?: string;
        signal?: AbortSignal;
      };

      const headers: Record<string, string> = {};
      if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;
      if (options.etag) Object.assign(headers, ifMatch(options.etag));

      // openapi-fetch fills `{param}` itself and keeps the template as `schemaPath`, which the
      // surface guard matches on — so the template goes in, not a pre-filled path.
      fillPath(path, options.path); // validates that every parameter is present
      const { data } = await untyped[method](path, {
        params: { path: options.path, query: compactQuery(options.query) },
        body: options.body,
        headers,
        signal: options.signal,
      });
      return data as never;
    },
  };
}

/** Drops empty filters, so `?status=&q=` never reaches the API as "filter by empty string". */
export function compactQuery(query: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!query) return undefined;
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
