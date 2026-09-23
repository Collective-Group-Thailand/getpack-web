// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createApiClient,
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  ifMatch,
  newIdempotencyKey,
  REQUEST_ID_HEADER,
  requiresIdempotencyKey,
} from "./client";
import { ApiError } from "./problem";

/** Captures the Request the client actually sent, and answers with whatever the test wants. */
function stubFetch(response: () => Response) {
  const calls: Request[] = [];
  const fetchStub = vi.fn(async (input: Request) => {
    calls.push(input);
    return response();
  });
  return { calls, fetchStub: fetchStub as unknown as typeof fetch };
}

const ok = () =>
  new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });

describe("request context", () => {
  it("attaches the bearer token and the locale", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", accessToken: "tok", locale: "th", fetch: fetchStub });

    await client.GET("/health");

    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer tok");
    expect(calls[0]!.headers.get("Accept-Language")).toBe("th");
  });

  it("sends no Authorization header when there is no token", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await client.GET("/health");

    expect(calls[0]!.headers.has("Authorization")).toBe(false);
  });

  it("resolves a locale getter per request, so a memoised client is not stuck on one", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    let locale = "th";
    const client = createApiClient({ baseUrl: "https://api.test", locale: () => locale, fetch: fetchStub });

    await client.GET("/health");
    locale = "en";
    await client.GET("/health");

    expect(calls.map((call) => call.headers.get("Accept-Language"))).toEqual(["th", "en"]);
  });

  it("generates a request id when the caller has none", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await client.GET("/health");

    expect(calls[0]!.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a request id the caller supplied, so one id spans app and API logs", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", requestId: "trace-me", fetch: fetchStub });

    await client.GET("/health");

    expect(calls[0]!.headers.get(REQUEST_ID_HEADER)).toBe("trace-me");
  });
});

describe("CSRF header", () => {
  it("is sent on a mutating request from a browser client", async () => {
    const { calls, fetchStub } = stubFetch(() => new Response(null, { status: 204 }));
    // An absolute base, because a relative one only resolves against a document origin —
    // which is exactly why `browserApi()` is a browser-only module.
    const client = createApiClient({ baseUrl: "https://shop.test/bff", csrf: true, fetch: fetchStub });

    await client.POST("/v1/auth/logout", { body: { refreshToken: "r" } });

    expect(calls[0]!.headers.get(CSRF_HEADER)).toBe("1");
  });

  it("is not sent on a GET, which the BFF does not require it for", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://shop.test/bff", csrf: true, fetch: fetchStub });

    await client.GET("/health");

    expect(calls[0]!.headers.has(CSRF_HEADER)).toBe(false);
  });

  it("is absent for a server client, which is not a browser and has no origin to prove", async () => {
    const { calls, fetchStub } = stubFetch(() => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await client.POST("/v1/auth/logout", { body: { refreshToken: "r" } });

    expect(calls[0]!.headers.has(CSRF_HEADER)).toBe(false);
  });
});

describe("idempotency", () => {
  it("flags no operation while F1 has none — the list is what F2–F6 extend", () => {
    expect(requiresIdempotencyKey("POST", "/v1/auth/staff/login")).toBe(false);
    expect(requiresIdempotencyKey("GET", "/v1/admin/me")).toBe(false);
  });

  it("mints a v4 uuid, distinct per call", () => {
    const first = newIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(newIdempotencyKey()).not.toBe(first);
  });

  it("does not overwrite a key the caller pinned for a retry", async () => {
    const { calls, fetchStub } = stubFetch(() => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await client.POST("/v1/auth/logout", {
      body: { refreshToken: "r" },
      headers: { [IDEMPOTENCY_HEADER]: "pinned-key" },
    });

    expect(calls[0]!.headers.get(IDEMPOTENCY_HEADER)).toBe("pinned-key");
  });
});

describe("If-Match", () => {
  it("builds the header a concurrent edit must send", () => {
    expect(ifMatch('W/"3"')).toEqual({ "If-Match": 'W/"3"' });
  });
});

describe("failures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a typed ApiError instead of returning one", async () => {
    const body = {
      type: "https://errors.packio/auth.invalid_credentials",
      title: "Invalid credentials",
      status: 401,
      code: "auth.invalid_credentials",
      detail: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      requestId: "req-9",
    };
    const { fetchStub } = stubFetch(
      () =>
        new Response(JSON.stringify(body), { status: 401, headers: { "content-type": "application/problem+json" } }),
    );
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    const failure = client.POST("/v1/auth/staff/login", { body: { email: "a@b.c", password: "x" } });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ code: "auth.invalid_credentials", status: 401, requestId: "req-9" });
  });

  it("throws for a non-problem error body too, so nothing fails silently", async () => {
    const { fetchStub } = stubFetch(() => new Response("gateway down", { status: 502 }));
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await expect(client.GET("/health")).rejects.toMatchObject({ status: 502, code: "http.502" });
  });

  it("returns data on success", async () => {
    const { fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    const { data } = await client.GET("/health");

    expect(data).toMatchObject({ status: "ok" });
  });
});

describe("surface guard", () => {
  it("refuses a call to another zone's surface before it leaves the process", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", surfaceZone: "admin", fetch: fetchStub });

    await expect(client.GET("/v1/store/me")).rejects.toThrow(/admin zone may not call \/v1\/store\/me/);
    expect(calls).toHaveLength(0);
  });

  it("allows the zone's own surface", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", surfaceZone: "admin", fetch: fetchStub });

    await client.GET("/v1/admin/me");

    expect(calls).toHaveLength(1);
  });

  it("is off by default, so a client with no zone is unconstrained", async () => {
    const { calls, fetchStub } = stubFetch(ok);
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchStub });

    await client.GET("/v1/store/me");

    expect(calls).toHaveLength(1);
  });
});
