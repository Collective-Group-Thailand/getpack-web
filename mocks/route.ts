/**
 * `mockRequest(key, resolver)` — an MSW handler for one contract request, held to its schema.
 *
 * The definition in `src/lib/api/requests` is the single description of what the backend was
 * asked for. This parses the query and body with it (an invalid one gets the `422
 * validation.failed` the backend's pipe returns), and validates whatever the resolver returns
 * against the response schema — so a mock that drifts from the request fails loudly, in the
 * dev console and in the e2e run, instead of teaching the UI a shape nobody asked for.
 */

import { http, HttpResponse, type HttpResponseResolver } from "msw";
import type { z } from "zod";

import type { ResponseOf } from "@/lib/api/requests/client";
import { REQUESTS, type RequestKey, type Requests } from "@/lib/api/requests/registry";

import { principalOf, problem, type Principal } from "./support";

type Parts<K extends RequestKey> = Requests[K] extends { query?: infer Q; body?: infer B }
  ? { query: Q extends z.ZodType ? z.output<Q> : undefined; body: B extends z.ZodType ? z.output<B> : undefined }
  : never;

export interface MockContext<K extends RequestKey> {
  params: Record<string, string>;
  query: Parts<K>["query"];
  body: Parts<K>["body"];
  principal: Principal | null;
  request: Request;
}

type MockResult<K extends RequestKey> = ResponseOf<Requests, K> | Response;

/** The token audience a surface prefix accepts (api-conventions §2). */
export function audienceOf(path: string): Principal["audience"] {
  return path.startsWith("/v1/admin") ? "staff" : path.startsWith("/v1/partner") ? "partner" : "customer";
}

function toMswPath(template: string): string {
  return `*${template.replace(/\{([^}]+)\}/g, ":$1")}`;
}

function zodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path
      .map((part, index) => (typeof part === "number" ? `[${part}]` : `${index ? "." : ""}${String(part)}`))
      .join(""),
    code: issue.code,
    message: issue.message,
  }));
}

export function mockRequest<K extends RequestKey>(
  key: K,
  resolve: (context: MockContext<K>) => MockResult<K> | Promise<MockResult<K>>,
) {
  const [method, path] = key.split(" ") as [string, string];
  const definition = REQUESTS[key] as Requests[RequestKey];
  const verb = method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";

  const resolver: HttpResponseResolver = async ({ request, params }) => {
    const principal = principalOf(request);
    // A `@Public()` read answers without a token; with one, the audience is still checked.
    if (!principal && !definition.public) {
      return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    }
    if (principal && principal.audience !== audienceOf(path)) {
      return problem(403, "auth.wrong_audience", "โทเคนนี้ใช้กับส่วนนี้ไม่ได้");
    }

    let query: unknown;
    if (definition.query) {
      const raw = Object.fromEntries(new URL(request.url).searchParams);
      const parsed = definition.query.safeParse(raw);
      if (!parsed.success) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", zodErrors(parsed.error));
      query = parsed.data;
    }

    let body: unknown;
    if (definition.body) {
      const parsed = definition.body.safeParse(await request.json().catch(() => undefined));
      if (!parsed.success) return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", zodErrors(parsed.error));
      body = parsed.data;
    }

    if ("idempotent" in definition && definition.idempotent && !request.headers.get("idempotency-key")) {
      return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
    }

    const result = await resolve({
      params: params as Record<string, string>,
      query: query as MockContext<K>["query"],
      body: body as MockContext<K>["body"],
      principal,
      request,
    });
    if (result instanceof Response) return result;

    const status = definition.status ?? 200;
    if (!definition.response) return new HttpResponse(null, { status });

    const checked = definition.response.safeParse(result);
    if (!checked.success) {
      // The mock disagrees with the request it stands in for. Loud on purpose.
      console.error(`[mock drift] ${key}`, checked.error.issues.slice(0, 5));
      return problem(500, "mock.drift", `The mock for ${key} returned a shape its request does not describe.`);
    }
    return HttpResponse.json(result as never, { status });
  };

  return http[verb](toMswPath(path), resolver);
}
