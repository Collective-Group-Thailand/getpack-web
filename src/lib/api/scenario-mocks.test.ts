// @vitest-environment node
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MOCK_SCENARIO_HEADER } from "./mock-scenario";

import { PROBLEM_EXAMPLES } from "../../../mocks/generated/problems";
import { handlers } from "../../../mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const call = (method: string, path: string, scenario?: string) =>
  fetch(`http://api.mock${path}`, {
    method,
    headers: scenario ? { [MOCK_SCENARIO_HEADER]: scenario } : {},
  });

describe("?mock= scenarios on the mock API", () => {
  it("answers the named operation with the problem its contract documents", async () => {
    const response = await call("GET", "/v1/admin/ops/signals", "admin.ops.signals:auth.forbidden");

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const body = (await response.json()) as { code: string; detail: string; requestId: string };
    expect(body.code).toBe("auth.forbidden");
    expect(body.detail).toBe(PROBLEM_EXAMPLES["auth.forbidden"]!.detail);
    expect(body.requestId).toMatch(/^mock-/);
  });

  it("matches the path template, not only the operation name", async () => {
    const response = await call(
      "GET",
      "/v1/admin/settings/00000000-0000-4000-8000-736574000003",
      "admin.settings.get:http.not_found",
    );
    expect(response.status).toBe(404);
  });

  it("leaves every other operation to the handlers that normally answer it", async () => {
    const response = await call("GET", "/v1/admin/ops/signals", "store.cart.get:http.not_found");
    expect(response.status).toBe(200);
  });

  it("says loudly when the operation documents no such code", async () => {
    const response = await call("GET", "/v1/admin/ops/signals", "admin.ops.signals:concurrency.stale");
    expect(response.status).toBe(500);
    expect(((await response.json()) as { code: string }).code).toBe("mock.scenario_unknown");
  });
});
