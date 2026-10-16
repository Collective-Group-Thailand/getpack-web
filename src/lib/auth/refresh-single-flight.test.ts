import { afterEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("@/lib/api/client", () => ({ upstreamApi: () => ({ POST: post }) }));
vi.mock("@/lib/env/lazy-server", () => ({ apiInternalUrl: async () => "http://api.test" }));

const { refreshSession } = await import("./refresh");

const rotated = {
  accessToken: "access-2",
  accessTokenExpiresAt: "2026-10-06T21:00:00+07:00",
  refreshToken: "refresh-2",
  refreshTokenExpiresAt: "2026-11-06T21:00:00+07:00",
};

afterEach(() => {
  post.mockReset();
  delete (globalThis as { __getpackRefreshFlights?: unknown }).__getpackRefreshFlights;
});

describe("refreshSession, single flight (round 2, B4)", () => {
  it("sends a refresh token once however many requests present it at the same time", async () => {
    post.mockResolvedValue({ data: rotated });
    const answers = await Promise.all([
      refreshSession("customer", "refresh-1"),
      refreshSession("customer", "refresh-1"),
      refreshSession("customer", "refresh-1"),
    ]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(answers.map((session) => session?.refreshToken)).toEqual(["refresh-2", "refresh-2", "refresh-2"]);
  });

  it("hands a request that arrives just after with the old cookie the same rotation", async () => {
    post.mockResolvedValue({ data: rotated });
    await refreshSession("customer", "refresh-1");
    const late = await refreshSession("customer", "refresh-1");
    expect(post).toHaveBeenCalledTimes(1);
    expect(late?.accessToken).toBe("access-2");
  });

  it("refreshes each token on its own", async () => {
    post.mockResolvedValue({ data: rotated });
    await Promise.all([refreshSession("customer", "a"), refreshSession("admin", "b")]);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
