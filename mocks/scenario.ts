/**
 * `?mock=<operationId>:<code>` (src/lib/api/mock-scenario.ts): answers the named operation with
 * the problem body the contract documents for that code, at the status it documents it with.
 *
 * One catch-all handler, first in `mocks/handlers.ts`, because almost no request carries a
 * scenario: those return at the first line and fall through to the handlers that would have
 * answered anyway. Only the operations the scenario names are matched against the URL, so two
 * templates that could both match a path (`/orders/by-code/{code}`, `/orders/{id}`) never
 * compete.
 */

import { http, HttpResponse } from "msw";

import { MOCK_SCENARIO_HEADER, parseMockScenario } from "@/lib/api/mock-scenario";

import { OPERATION_PROBLEMS, PROBLEM_EXAMPLES } from "./generated/problems";

const templates = new Map<string, RegExp>();

/** `/v1/store/orders/{orderId}` → a regex for the path of a request URL. */
function templateOf(path: string): RegExp {
  let pattern = templates.get(path);
  if (!pattern) {
    const source = path
      .split(/(\{[^}]+\})/)
      .map((part) => (part.startsWith("{") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    pattern = new RegExp(`^${source}$`);
    templates.set(path, pattern);
  }
  return pattern;
}

function problem(status: number, body: object): Response {
  return HttpResponse.json(
    { ...body, status, requestId: `mock-${crypto.randomUUID()}` },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

export const scenarioHandlers = [
  http.all("*/v1/*", ({ request }) => {
    const scenarios = parseMockScenario(request.headers.get(MOCK_SCENARIO_HEADER));
    if (scenarios.length === 0) return undefined;

    const { pathname } = new URL(request.url);
    for (const { operationId, code } of scenarios) {
      const operation = OPERATION_PROBLEMS[operationId];
      if (!operation || operation.method !== request.method || !templateOf(operation.path).test(pathname)) continue;

      const status = operation.problems[code];
      const example = PROBLEM_EXAMPLES[code];
      if (status === undefined || !example) {
        // A typo should be loud, and say what would have worked.
        return problem(500, {
          type: "https://errors.packio/mock.scenario_unknown",
          title: "Unknown mock scenario",
          code: "mock.scenario_unknown",
          detail: `${operationId} documents no ${code}. It documents: ${Object.keys(operation.problems).join(", ")}.`,
        });
      }
      return problem(status, example);
    }
    return undefined;
  }),
];
