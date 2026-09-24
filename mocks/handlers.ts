/**
 * Overrides on top of `mocks/generated/handlers.ts`.
 *
 * The generated handlers answer every operation with the example from the contract, which is
 * enough to render a screen but not to exercise a flow: they say yes to every password and
 * hand a staff session to anyone who asks. These add the behaviour the auth tests need —
 * credentials that can be wrong, an OTP that can be mistyped, and audiences that are actually
 * checked — while keeping the data obviously fake.
 *
 * Every endpoint here is one packio-api has published (B1.3), so these are shaped by the
 * contract rather than standing in for it.
 */

import { http, HttpResponse } from "msw";

import { generatedHandlers } from "./generated/handlers";

/** The only credentials the mock accepts. Obviously not real, and never near production. */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: "mock-password" };
export const MOCK_PARTNER = { email: "planner@factory.invalid", password: "mock-password", pin: "1234" };
export const MOCK_OTP = {
  phone: "0812345678",
  code: "000000",
  challengeId: "00000000-0000-4000-8000-0000000000c1",
};

type Audience = "customer" | "staff" | "partner";

const token = (audience: Audience) => `seed.access.token.${audience}`;
const refresh = (audience: Audience) => `seed-refresh-token-${audience}`;

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    {
      type: `https://errors.packio/${code}`,
      title: code,
      status,
      code,
      detail,
      requestId: "00000000-0000-4000-8000-00000000mock",
    },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function session(audience: Audience, subject: Record<string, unknown>) {
  return HttpResponse.json({
    accessToken: token(audience),
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: refresh(audience),
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
    subject,
  });
}

const SUBJECTS = {
  staff: {
    id: "00000000-0000-4000-8000-000000000002",
    type: "staff",
    roles: ["cs"],
    permissions: ["orders.read", "orders.update", "quotations.create"],
    scopes: ["platform"],
  },
  customer: {
    id: "00000000-0000-4000-8000-000000000001",
    type: "customer",
    roles: ["customer"],
    permissions: [],
    scopes: [],
  },
  partner: {
    id: "00000000-0000-4000-8000-000000000003",
    type: "partner",
    roles: ["planner"],
    permissions: ["jobs.read", "jobs.update"],
    scopes: ["factory:00000000-0000-4000-8000-0000000000f1"],
  },
} as const;

/**
 * Whether the bearer token on this request is for the audience the surface expects.
 *
 * The real API checks the JWT's `aud` and rejects a token issued for anywhere else
 * (api-conventions §2). The mock tokens carry their audience in the string, which is enough
 * to reproduce the behaviour that matters here: a customer session must not open the admin
 * zone, and the e2e suite asserts exactly that.
 */
function audienceOf(request: Request): Audience | null {
  const header = request.headers.get("authorization");
  const value = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!value) return null;
  for (const audience of ["customer", "staff", "partner"] as const) {
    if (value === token(audience)) return audience;
  }
  return null;
}

function meHandler(path: string, audience: Audience, body: Record<string, unknown>) {
  return http.get(`*${path}`, ({ request }) => {
    const presented = audienceOf(request);
    if (!presented) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    if (presented !== audience) {
      return problem(403, "auth.wrong_audience", "โทเคนนี้ใช้กับส่วนนี้ไม่ได้");
    }
    return HttpResponse.json(body);
  });
}

export const handlers = [
  http.post("*/v1/auth/staff/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email !== MOCK_STAFF.email || body.password !== MOCK_STAFF.password) {
      return problem(401, "auth.invalid_credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    return session("staff", SUBJECTS.staff);
  }),

  http.post("*/v1/auth/partner/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; pin?: string };
    // `PartnerLoginDto` requires only the email: a shared shop-floor device may be enrolled
    // with a PIN instead of a password, so either one signs in.
    const credentialOk = body.password === MOCK_PARTNER.password || body.pin === MOCK_PARTNER.pin;
    if (body.email !== MOCK_PARTNER.email || !credentialOk) {
      return problem(401, "auth.invalid_credentials", "อีเมล รหัสผ่าน หรือรหัส PIN ไม่ถูกต้อง");
    }
    return session("partner", SUBJECTS.partner);
  }),

  http.post("*/v1/auth/customer/otp/request", async ({ request }) => {
    const body = (await request.json()) as { phone?: string };
    if (!body.phone || !/^0\d{8,9}$/.test(body.phone)) {
      return problem(422, "auth.invalid_phone", "กรุณาใส่เบอร์มือถือในประเทศไทยให้ถูกต้อง");
    }
    return HttpResponse.json({
      challengeId: MOCK_OTP.challengeId,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      // Seconds, not minutes: a test should not be made to wait out a real cooldown.
      resendAvailableAt: new Date(Date.now() + 3_000).toISOString(),
    });
  }),

  http.post("*/v1/auth/customer/otp/verify", async ({ request }) => {
    const body = (await request.json()) as { challengeId?: string; code?: string };
    if (body.challengeId !== MOCK_OTP.challengeId || body.code !== MOCK_OTP.code) {
      return problem(401, "auth.invalid_otp", "รหัส OTP ไม่ถูกต้อง");
    }
    return session("customer", SUBJECTS.customer);
  }),

  http.post("*/v1/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    for (const audience of ["customer", "staff", "partner"] as const) {
      if (body.refreshToken === refresh(audience)) return session(audience, SUBJECTS[audience]);
    }
    return problem(401, "auth.invalid_refresh_token", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
  }),

  meHandler("/v1/store/me", "customer", {
    id: SUBJECTS.customer.id,
    displayName: "ลูกค้าตัวอย่าง (ข้อมูลจำลอง)",
    email: "seed.customer@packio.invalid",
    phone: MOCK_OTP.phone,
    locale: "th",
    roles: SUBJECTS.customer.roles,
    permissions: SUBJECTS.customer.permissions,
    scopes: SUBJECTS.customer.scopes,
    identities: [{ provider: "phone_otp", linkedAt: "2026-09-23T10:00:00+07:00" }],
  }),
  meHandler("/v1/admin/me", "staff", {
    id: SUBJECTS.staff.id,
    displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)",
    email: MOCK_STAFF.email,
    locale: "th",
    roles: SUBJECTS.staff.roles,
    permissions: SUBJECTS.staff.permissions,
    menu: [
      { key: "dashboard", path: "/" },
      { key: "orders", path: "/orders" },
    ],
    featureFlags: ["labelCalculator"],
  }),
  meHandler("/v1/partner/me", "partner", {
    id: SUBJECTS.partner.id,
    displayName: "ช่างวางแผน ตัวอย่าง (ข้อมูลจำลอง)",
    email: MOCK_PARTNER.email,
    locale: "th",
    roles: SUBJECTS.partner.roles,
    permissions: SUBJECTS.partner.permissions,
    factories: [{ factoryId: "00000000-0000-4000-8000-0000000000f1", roles: ["planner"] }],
  }),

  // CONTRACT-REQUEST notifications.feed — the in-app notification centre (D-143).
  // Two entries, obviously fake, so the badge and the list have something to render.
  http.get("*/v1/:surface/notifications", () =>
    HttpResponse.json({
      data: [
        {
          id: "00000000-0000-4000-8000-00000000n001",
          type: "order.paid",
          title: "รับชำระเงินแล้ว (ข้อมูลจำลอง)",
          body: "คำสั่งซื้อ PK-2569-00042 ชำระเงินครบแล้ว",
          url: "/orders/PK-2569-00042",
          readAt: null,
          createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        },
        {
          id: "00000000-0000-4000-8000-00000000n002",
          type: "artwork.changes_requested",
          title: "ขอให้แก้ไขไฟล์งาน (ข้อมูลจำลอง)",
          body: "ไฟล์ของ PK-2569-00041 ต้องเพิ่มระยะตัดตก 3 มม.",
          url: "/orders/PK-2569-00041",
          readAt: "2026-09-23T10:00:00+07:00",
          createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
        },
      ],
      meta: { nextCursor: null, unreadCount: 1 },
    }),
  ),
  http.post("*/v1/:surface/notifications/read", () => new HttpResponse(null, { status: 204 })),

  // CONTRACT-REQUEST push.subscriptions — accepted and discarded; nothing is ever pushed here.
  http.post("*/v1/:surface/push/subscriptions", () => new HttpResponse(null, { status: 201 })),

  // CONTRACT-REQUEST realtime.auth / realtime.stream. The stream is deliberately *not* mocked:
  // MSW cannot hold an SSE connection open usefully, and `NEXT_PUBLIC_REALTIME_DRIVER` is
  // unset in development and in the e2e run, so nothing opens one.
  http.post("*/v1/:surface/realtime/auth", () =>
    HttpResponse.json({
      channel: "mock",
      token: "mock-realtime-token",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  ),

  // CONTRACT-REQUEST analytics.events — the D-102 funnel, accepted and discarded.
  http.post("*/v1/store/analytics/events", () => new HttpResponse(null, { status: 202 })),

  // CONTRACT-REQUEST rum.web-vitals — no endpoint exists yet (docs/contract-requests.md).
  // Accepted and discarded, on all three surfaces, so `pnpm dev:mock` and the e2e run do not
  // fill the console with unhandled-request warnings on every page load.
  http.post("*/v1/:surface/rum/web-vitals", () => new HttpResponse(null, { status: 202 })),

  // Anything not overridden falls through to the contract's own examples.
  ...generatedHandlers,
];
