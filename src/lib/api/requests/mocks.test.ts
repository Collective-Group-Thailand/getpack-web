// @vitest-environment node
import { setupServer } from "msw/node";
import type { Client } from "openapi-fetch";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { handlers } from "../../../../mocks/handlers";
import { accessToken } from "../../../../mocks/support";
import { createApiClient } from "../client";
import { isApiError } from "../problem";
import { createRequestClient } from "./client";
import { REQUESTS, type RequestKey } from "./registry";

/**
 * The mock API and the contract requests agree.
 *
 * `mockRequest` validates every response against its request's schema at runtime; this runs
 * every requested GET once, as a superadmin, so a drift is a red test in CI rather than a
 * console line in someone's dev server. Mutations are exercised by the screens' own tests.
 */

const server = setupServer(...handlers);
const errors = vi.spyOn(console, "error");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

function asPersona(persona: string) {
  const api = createApiClient({ baseUrl: "http://api.mock", accessToken: accessToken("staff", persona) });
  return createRequestClient(REQUESTS, api as unknown as Client<never>);
}

/** A valid query for each GET that needs one. */
const SAMPLE_QUERIES: Partial<Record<RequestKey, Record<string, unknown>>> = {
  "GET /v1/admin/saved-views": { resource: "order" },
  "GET /v1/admin/search": { q: "ตัวอย่าง" },
  "GET /v1/admin/analytics/overview": { from: "2026-09-01", to: "2026-09-30" },
  "GET /v1/admin/analytics/demand": { from: "2026-09-01", to: "2026-09-30", dimension: "province" },
  "GET /v1/admin/analytics/unmet-demand": { from: "2026-09-01", to: "2026-09-30" },
  "GET /v1/admin/analytics/factories": { from: "2026-09-01", to: "2026-09-30" },
  "GET /v1/admin/analytics/campaigns": { from: "2026-09-01", to: "2026-09-30" },
};

const gets = (Object.keys(REQUESTS) as RequestKey[]).filter((key) => key.startsWith("GET ") && !key.includes("{"));

describe("the mock API answers every contract request in its requested shape", () => {
  it.each(gets)("%s", async (key) => {
    const requests = asPersona("superadmin");
    try {
      await (requests.call as (k: string, init?: unknown) => Promise<unknown>)(key, { query: SAMPLE_QUERIES[key] });
    } catch (error) {
      // A 404 means "not mocked yet" and is fine for an entry whose screen is not built; a 500
      // `mock.drift` is exactly what this test exists to catch.
      if (isApiError(error) && error.code === "mock.drift") throw error;
      if (!(isApiError(error) && error.status === 404)) throw error;
    }
    expect(errors.mock.calls.filter(([message]) => String(message).includes("[mock drift]"))).toEqual([]);
  });

  it("refuses a staff request without a session, like the API", async () => {
    const api = createApiClient({ baseUrl: "http://api.mock" });
    const requests = createRequestClient(REQUESTS, api as unknown as Client<never>);
    await expect(requests.call("GET /v1/admin/dashboard")).rejects.toMatchObject({ status: 401 });
  });

  it("builds the dashboard per role: a CS agent does not see Finance's queues", async () => {
    const cs = await asPersona("cs").call("GET /v1/admin/dashboard");
    const finance = await asPersona("finance").call("GET /v1/admin/dashboard");
    const keys = (dashboard: typeof cs) => dashboard.queues.map((queue) => queue.key);
    expect(keys(cs)).not.toEqual(keys(finance));
  });
});
