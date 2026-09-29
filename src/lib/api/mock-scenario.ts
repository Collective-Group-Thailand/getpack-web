/**
 * The mock scenario switcher (U1 U-F0.1): `?mock=<operationId>:<code>` on any page, in
 * `pnpm dev:mock` and the e2e run only.
 *
 * Opening `…/cart?mock=store.cart.get:http.not_found` makes the mock API answer that one
 * operation with the problem body the contract documents for that code, so every error state a
 * screen can reach can be looked at without a backend that misbehaves on cue. Several are joined
 * with commas; `?mock=off` ends it.
 *
 * How it travels: `src/proxy.ts` reads the query (or the cookie it set on an earlier page) and
 * stamps `x-packio-mock-scenario` on the request it hands to the render and to the BFF; the BFF,
 * `serverApi` and the auth actions copy it onto their call to the API, where `mocks/scenario.ts`
 * answers it. Every step checks `API_MOCKS=1` — outside the mock the header is stripped at the
 * proxy and never sent, so nothing here can reach a real backend.
 */

export const MOCK_SCENARIO_PARAM = "mock";
export const MOCK_SCENARIO_COOKIE = "pk_mock_scenario";
export const MOCK_SCENARIO_HEADER = "x-packio-mock-scenario";

export interface MockScenario {
  operationId: string;
  code: string;
}

const ENTRY = /^[a-z][\w.-]*:[a-z][\w.]*$/i;

export function mocksEnabled(): boolean {
  return process.env.API_MOCKS === "1";
}

/** `a.b.c:x.y,d.e:z` → scenarios; anything malformed is dropped rather than half-applied. */
export function parseMockScenario(value: string | null | undefined): MockScenario[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => ENTRY.test(entry))
    .map((entry) => {
      const [operationId, code] = entry.split(":") as [string, string];
      return { operationId, code };
    });
}

export type ScenarioCookie = { set: string } | "clear" | "keep";

/**
 * What this request's scenario is and what to do with the cookie: a `?mock=` in the URL wins
 * and is remembered for the pages that follow, `?mock=off` forgets it, and otherwise the
 * remembered one applies.
 */
export function resolveMockScenario(
  url: URL,
  cookie: string | undefined,
): { scenario: string | null; cookie: ScenarioCookie } {
  const requested = url.searchParams.get(MOCK_SCENARIO_PARAM);
  if (requested === "off") return { scenario: null, cookie: "clear" };
  if (requested !== null) {
    const valid = parseMockScenario(requested);
    if (valid.length === 0) return { scenario: null, cookie: "clear" };
    const value = valid.map(({ operationId, code }) => `${operationId}:${code}`).join(",");
    return { scenario: value, cookie: { set: value } };
  }
  const remembered = parseMockScenario(cookie);
  return {
    scenario: remembered.length ? remembered.map(({ operationId, code }) => `${operationId}:${code}`).join(",") : null,
    cookie: "keep",
  };
}

/** The scenario to pass on to the API for this request, or `null` (always `null` off the mock). */
export function mockScenarioOf(headers: Headers): string | null {
  if (!mocksEnabled()) return null;
  return headers.get(MOCK_SCENARIO_HEADER) || null;
}
