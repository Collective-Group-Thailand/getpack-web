import { afterEach, describe, expect, it } from "vitest";

import { MOCK_SCENARIO_HEADER, mockScenarioOf, parseMockScenario, resolveMockScenario } from "./mock-scenario";

const url = (query = "") => new URL(`https://getpack.co/cart${query}`);

afterEach(() => {
  delete process.env.API_MOCKS;
});

describe("parseMockScenario", () => {
  it("reads one or several operationId:code pairs", () => {
    expect(parseMockScenario("store.cart.get:http.not_found, store.cart.addItem:concurrency.stale")).toEqual([
      { operationId: "store.cart.get", code: "http.not_found" },
      { operationId: "store.cart.addItem", code: "concurrency.stale" },
    ]);
  });

  it("drops anything malformed rather than half-applying it", () => {
    expect(parseMockScenario("store.cart.get")).toEqual([]);
    expect(parseMockScenario("<x>:y")).toEqual([]);
    expect(parseMockScenario(null)).toEqual([]);
  });
});

describe("resolveMockScenario", () => {
  it("applies ?mock= and remembers it for the next pages", () => {
    expect(resolveMockScenario(url("?mock=store.cart.get:http.not_found"), undefined)).toEqual({
      scenario: "store.cart.get:http.not_found",
      cookie: { set: "store.cart.get:http.not_found" },
    });
  });

  it("keeps the remembered one when the URL says nothing, and forgets it on ?mock=off", () => {
    expect(resolveMockScenario(url(), "store.cart.get:http.not_found")).toEqual({
      scenario: "store.cart.get:http.not_found",
      cookie: "keep",
    });
    expect(resolveMockScenario(url("?mock=off"), "store.cart.get:http.not_found")).toEqual({
      scenario: null,
      cookie: "clear",
    });
  });

  it("clears on a malformed request instead of keeping an old one alive", () => {
    expect(resolveMockScenario(url("?mock=nonsense"), "store.cart.get:http.not_found")).toEqual({
      scenario: null,
      cookie: "clear",
    });
  });
});

describe("mockScenarioOf", () => {
  const headers = new Headers({ [MOCK_SCENARIO_HEADER]: "store.cart.get:http.not_found" });

  it("passes a scenario on only under API_MOCKS=1", () => {
    expect(mockScenarioOf(headers)).toBeNull();
    process.env.API_MOCKS = "1";
    expect(mockScenarioOf(headers)).toBe("store.cart.get:http.not_found");
  });
});
