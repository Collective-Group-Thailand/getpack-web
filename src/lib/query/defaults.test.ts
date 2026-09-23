import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/problem";

import { queryClientConfig, shouldRetry, STALE_TIME } from "./defaults";

const apiError = (status: number) =>
  new ApiError({
    type: `https://errors.packio/http.${status}`,
    title: "t",
    status,
    code: `http.${status}`,
    detail: "d",
    requestId: "r",
  });

describe("shouldRetry", () => {
  it("retries a server error", () => {
    expect(shouldRetry(0, apiError(503))).toBe(true);
    expect(shouldRetry(1, apiError(500))).toBe(true);
  });

  it("gives up after two attempts rather than delaying the error state", () => {
    expect(shouldRetry(2, apiError(503))).toBe(false);
  });

  it("does not retry a request the API has rejected on its merits", () => {
    expect(shouldRetry(0, apiError(422))).toBe(false);
    expect(shouldRetry(0, apiError(404))).toBe(false);
    expect(shouldRetry(0, apiError(403))).toBe(false);
  });

  it("does not retry a 401 — the BFF has already refreshed and retried underneath", () => {
    expect(shouldRetry(0, apiError(401))).toBe(false);
  });

  it("retries the two statuses that mean 'try again'", () => {
    expect(shouldRetry(0, apiError(429))).toBe(true);
    expect(shouldRetry(0, apiError(408))).toBe(true);
  });

  it("retries a transport failure, where no response ever arrived", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  });
});

describe("queryClientConfig", () => {
  it("never retries a mutation automatically", () => {
    expect(queryClientConfig.defaultOptions?.mutations?.retry).toBe(false);
  });

  it("does not refetch when a tab regains focus", () => {
    expect(queryClientConfig.defaultOptions?.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("orders the stale times from fastest-moving to most stable", () => {
    const times = [STALE_TIME.live, STALE_TIME.transactional, STALE_TIME.reference, STALE_TIME.stable];
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
