// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

const API = "http://api.test";

vi.mock("@/lib/auth/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/refresh")>();
  return { ...actual, refreshSession: vi.fn() };
});

let createBffHandler: typeof import("./handler").createBffHandler;
let MAX_BODY_BYTES: number;
let refreshSession: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  // The env schema validates at module load, and `src/lib/env/server` is pulled in through
  // the handler — so the values have to exist before the first import, as in src/proxy.test.ts.
  process.env.PUBLIC_HOST = "packio.test";
  process.env.ADMIN_HOST = "admin.packio.test";
  process.env.PARTNER_HOST = "partner.packio.test";
  process.env.API_INTERNAL_URL = API;

  ({ createBffHandler, MAX_BODY_BYTES } = await import("./handler"));
  ({ refreshSession } = (await import("@/lib/auth/refresh")) as unknown as {
    refreshSession: ReturnType<typeof vi.fn>;
  });
});

/** A request as the proxy hands it to the route, with the catch-all already split. */
function bffRequest(
  path: string,
  {
    method = "GET",
    host = "admin.packio.test",
    origin = "https://admin.packio.test",
    csrf = true,
    cookies = {} as Record<string, string>,
    body,
    search = "",
  }: {
    method?: string;
    host?: string;
    origin?: string | null;
    csrf?: boolean;
    cookies?: Record<string, string>;
    body?: string;
    search?: string;
  } = {},
): [NextRequest, { params: Promise<{ path?: string[] }> }] {
  const headers = new Headers({ host });
  if (origin) headers.set("origin", origin);
  if (csrf) headers.set("x-packio-csrf", "1");
  if (body !== undefined) headers.set("content-type", "application/json");
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  if (cookieHeader) headers.set("cookie", cookieHeader);

  const request = new Request(`https://${host}/bff${path}${search}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  }) as unknown as NextRequest;

  // NextRequest adds `cookies` and `nextUrl`; a plain Request is enough for everything else
  // the handler touches, and keeps the test free of Next's request internals.
  Object.defineProperty(request, "cookies", {
    value: {
      get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined),
    },
  });
  Object.defineProperty(request, "nextUrl", {
    value: { search, protocol: "https:" },
  });

  const segments = path.replace(/^\//, "").split("/").filter(Boolean);
  return [request, { params: Promise.resolve({ path: segments }) }];
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("upstream allow-list", () => {
  it("forwards a path on the zone's own surface", async () => {
    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/v1/admin/me`, expect.anything());
  });

  it("refuses another zone's surface, and says 404 rather than 403", async () => {
    const response = await createBffHandler("admin")(...bffRequest("/v1/store/orders"));

    // 403 would confirm the path exists behind this app. 404 tells a prober nothing.
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses staff login through the BFF: that is a Server Action, not a browser call", async () => {
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/auth/staff/login", { method: "POST", body: "{}" }),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the customer zone reach its own sign-in endpoints (ADR-0005)", async () => {
    const response = await createBffHandler("customer")(
      ...bffRequest("/v1/auth/customer/otp/request", {
        method: "POST",
        host: "packio.test",
        origin: "https://packio.test",
        body: JSON.stringify({ phone: "0812345678" }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("carries the query string through", async () => {
    await createBffHandler("admin")(...bffRequest("/v1/admin/orders", { search: "?page=2&perPage=25" }));

    expect(fetchMock).toHaveBeenCalledWith(`${API}/v1/admin/orders?page=2&perPage=25`, expect.anything());
  });
});

describe("CSRF", () => {
  it("refuses a mutating request without the header", async () => {
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/orders", { method: "POST", csrf: false, body: "{}" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "bff.csrf_header_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a mutating request from another origin", async () => {
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/orders", { method: "POST", origin: "https://evil.test", body: "{}" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "bff.origin_mismatch" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a mutating request with no Origin at all", async () => {
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/orders", { method: "POST", origin: null, body: "{}" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "bff.origin_missing" });
  });

  it("accepts a same-origin beacon without the header, since sendBeacon cannot set one", async () => {
    // Regression: every Web Vitals beacon was a 403, so field RUM never reached the API.
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/rum/web-vitals", { method: "POST", csrf: false, body: "{}" }),
    );
    expect(response.status).not.toBe(403);
  });

  it("still refuses a beacon from another origin", async () => {
    const response = await createBffHandler("customer")(
      ...bffRequest("/v1/store/analytics/events", { method: "POST", csrf: false, origin: "https://evil.test", body: "{}" }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "bff.origin_mismatch" });
  });

  it("does not exempt anything but the beacon endpoints", async () => {
    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/rum/web-vitals/../orders", { method: "POST", csrf: false, body: "{}" }),
    );
    expect(response.status).toBeGreaterThanOrEqual(403);
  });

  it("does not require any of it for a GET, which cannot change state", async () => {
    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me", { csrf: false, origin: null }));

    expect(response.status).toBe(200);
  });
});

describe("token handling", () => {
  it("attaches the access token from the cookie and never the browser's own headers", async () => {
    await createBffHandler("admin")(...bffRequest("/v1/admin/me", { cookies: { "__Host-pk_at": "staff-token" } }));

    const headers = fetchMock.mock.calls[0]![1].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer staff-token");
    expect(headers.has("cookie")).toBe(false);
  });

  it("sends no Authorization header when there is no session", async () => {
    await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect((fetchMock.mock.calls[0]![1].headers as Headers).has("authorization")).toBe(false);
  });

  it("forwards the headers the contract needs and nothing else", async () => {
    const [request, context] = bffRequest("/v1/admin/orders", { method: "POST", body: "{}" });
    request.headers.set("idempotency-key", "key-1");
    request.headers.set("if-match", 'W/"7"');
    request.headers.set("x-forwarded-for", "10.0.0.1");

    await createBffHandler("admin")(request, context);

    const headers = fetchMock.mock.calls[0]![1].headers as Headers;
    expect(headers.get("idempotency-key")).toBe("key-1");
    expect(headers.get("if-match")).toBe('W/"7"');
    expect(headers.has("x-forwarded-for")).toBe(false);
  });
});

describe("refresh on 401", () => {
  it("refreshes once, retries, and rotates the cookies onto the response", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    refreshSession.mockResolvedValue({
      accessToken: "fresh-access",
      accessTokenExpiresAt: new Date("2026-09-23T14:15:00Z"),
      refreshToken: "fresh-refresh",
      refreshTokenExpiresAt: new Date("2026-10-23T14:00:00Z"),
    });

    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/me", { cookies: { "__Host-pk_at": "stale", "__Host-pk_rt": "refresh-me" } }),
    );

    expect(response.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1]![1].headers as Headers).get("authorization")).toBe("Bearer fresh-access");

    const access = response.cookies.get("__Host-pk_at");
    expect(access?.value).toBe("fresh-access");
    expect(response.cookies.get("__Host-pk_rt")?.value).toBe("fresh-refresh");
    expect(response.cookies.get("__Host-pk_ate")?.value).toBe(
      String(Math.floor(Date.parse("2026-09-23T14:15:00Z") / 1000)),
    );
  });

  it("refreshes only once — a second 401 is the answer, not a loop", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    refreshSession.mockResolvedValue({
      accessToken: "fresh-access",
      accessTokenExpiresAt: new Date("2026-09-23T14:15:00Z"),
      refreshToken: "fresh-refresh",
      refreshTokenExpiresAt: new Date("2026-10-23T14:00:00Z"),
    });

    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/me", { cookies: { "__Host-pk_at": "stale", "__Host-pk_rt": "refresh-me" } }),
    );

    expect(response.status).toBe(401);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the session when the refresh token is spent", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    refreshSession.mockResolvedValue(null);

    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/me", { cookies: { "__Host-pk_rt": "spent" } }),
    );

    expect(response.status).toBe(401);
    expect(response.cookies.get("__Host-pk_rt")?.value).toBe("");
    expect(response.cookies.get("__Host-pk_rt")?.maxAge).toBe(0);
    // Both spellings, because a bare cookie set while the host was http is still sent on https.
    expect(response.cookies.get("pk_rt")?.maxAge).toBe(0);
  });

  it("does not try to refresh without a refresh token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect(response.status).toBe(401);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("writes session cookies HttpOnly, Secure, SameSite=Lax, Path=/ and host-only", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    refreshSession.mockResolvedValue({
      accessToken: "fresh-access",
      accessTokenExpiresAt: new Date("2026-09-23T14:15:00Z"),
      refreshToken: "fresh-refresh",
      refreshTokenExpiresAt: new Date("2026-10-23T14:00:00Z"),
    });

    const response = await createBffHandler("admin")(
      ...bffRequest("/v1/admin/me", { cookies: { "__Host-pk_rt": "refresh-me" } }),
    );

    const cookie = response.cookies.get("__Host-pk_at");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(cookie).not.toHaveProperty("domain");
  });
});

describe("responses", () => {
  it("never lets an authenticated response be cached", async () => {
    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the headers a download and a concurrent edit need", async () => {
    fetchMock.mockResolvedValue(
      new Response("file", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="quote.pdf"',
          etag: 'W/"9"',
        },
      }),
    );

    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/quotations/x.pdf"));

    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="quote.pdf"');
    expect(response.headers.get("etag")).toBe('W/"9"');
  });

  it("never forwards a Set-Cookie from the API, which is cookie-agnostic by contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true }, { headers: { "content-type": "application/json", "set-cookie": "evil=1" } }),
    );

    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers 502 rather than throwing when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("connect ECONNREFUSED"));

    const response = await createBffHandler("admin")(...bffRequest("/v1/admin/me"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "bff.upstream_unreachable" });
  });
});

describe("body limit", () => {
  it("refuses a body larger than the cap without forwarding it", async () => {
    const [request, context] = bffRequest("/v1/admin/orders", { method: "POST", body: "x" });
    request.headers.set("content-length", String(MAX_BODY_BYTES + 1));

    const response = await createBffHandler("admin")(request, context);

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an oversized body that understated its length", async () => {
    // The declared length is the cheap check; this is the one that matters, because
    // Content-Length is the client's claim about itself and a hostile client can lie.
    const [request, context] = bffRequest("/v1/admin/orders", {
      method: "POST",
      body: "x".repeat(MAX_BODY_BYTES + 1),
    });
    request.headers.set("content-length", "2");

    const response = await createBffHandler("admin")(request, context);

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
