/**
 * Overrides on top of `mocks/generated/handlers.ts`.
 *
 * The generated handlers answer every operation with the example from the contract, which is
 * enough to render a screen but not to exercise a flow: they say yes to every password and
 * hand a staff session to anyone who asks. These add the behaviour the auth tests need —
 * credentials that can be wrong, an OTP that can be mistyped, and audiences that are actually
 * checked — while keeping the data obviously fake.
 *
 * Handlers marked CONTRACT-REQUEST stand in for endpoints packio-api has not published yet
 * (see docs/contract-requests.md); they go when B1.3 ships.
 */

import { http, HttpResponse } from "msw";

import { generatedHandlers } from "./generated/handlers";

/** The only credentials the mock accepts. Obviously not real, and never near production. */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: "mock-password" };
export const MOCK_PARTNER = { username: "seed.planner", password: "mock-password" };
export const MOCK_OTP = { phone: "0812345678", code: "000000", ref: "MOCK-4821" };

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
  // CONTRACT-REQUEST auth.staff.login
  http.post("*/v1/auth/staff/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email !== MOCK_STAFF.email || body.password !== MOCK_STAFF.password) {
      return problem(401, "auth.invalid_credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    return session("staff", SUBJECTS.staff);
  }),

  // CONTRACT-REQUEST auth.partner.login
  http.post("*/v1/auth/partner/login", async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string };
    if (body.username !== MOCK_PARTNER.username || body.password !== MOCK_PARTNER.password) {
      return problem(401, "auth.invalid_credentials", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
    return session("partner", SUBJECTS.partner);
  }),

  // CONTRACT-REQUEST auth.customer.otp.request
  http.post("*/v1/auth/customer/otp/request", async ({ request }) => {
    const body = (await request.json()) as { phone?: string };
    if (!body.phone || !/^0\d{8,9}$/.test(body.phone)) {
      return problem(422, "auth.invalid_phone", "กรุณาใส่เบอร์มือถือในประเทศไทยให้ถูกต้อง");
    }
    return HttpResponse.json({
      ref: MOCK_OTP.ref,
      codeLength: MOCK_OTP.code.length,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      // Short, so a test is not made to wait out a real cooldown.
      resendAfterSeconds: 3,
      attemptsRemaining: 5,
    });
  }),

  // CONTRACT-REQUEST auth.customer.otp.verify
  http.post("*/v1/auth/customer/otp/verify", async ({ request }) => {
    const body = (await request.json()) as { code?: string };
    if (body.code !== MOCK_OTP.code) {
      return problem(401, "auth.invalid_otp", "รหัส OTP ไม่ถูกต้อง");
    }
    return session("customer", SUBJECTS.customer);
  }),

  // CONTRACT-REQUEST auth.refresh
  http.post("*/v1/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    for (const audience of ["customer", "staff", "partner"] as const) {
      if (body.refreshToken === refresh(audience)) return session(audience, SUBJECTS[audience]);
    }
    return problem(401, "auth.invalid_refresh_token", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
  }),

  // CONTRACT-REQUEST store.me.show / admin.me.show / partner.me.show
  meHandler("/v1/store/me", "customer", {
    id: SUBJECTS.customer.id,
    type: "customer",
    displayName: "ลูกค้าตัวอย่าง (ข้อมูลจำลอง)",
    userCode: "MOCK-C-0001",
    phone: MOCK_OTP.phone,
    email: "seed.customer@packio.invalid",
    locale: "th",
    lineLinked: false,
    companies: [],
    scopes: [],
  }),
  meHandler("/v1/admin/me", "staff", {
    id: SUBJECTS.staff.id,
    type: "staff",
    displayName: "สมชาย ตัวอย่าง (ข้อมูลจำลอง)",
    email: MOCK_STAFF.email,
    locale: "th",
    roles: SUBJECTS.staff.roles,
    permissions: SUBJECTS.staff.permissions,
    scopes: SUBJECTS.staff.scopes,
    menu: [
      { key: "dashboard", href: "/", icon: "box" },
      { key: "orders", href: "/orders", icon: "package" },
    ],
    features: { labelCalculator: true },
  }),
  meHandler("/v1/partner/me", "partner", {
    id: SUBJECTS.partner.id,
    type: "partner",
    displayName: "โรงงานจำลอง หนึ่ง (ข้อมูลจำลอง)",
    locale: "th",
    roles: SUBJECTS.partner.roles,
    permissions: SUBJECTS.partner.permissions,
    scopes: SUBJECTS.partner.scopes,
    factories: [{ id: "00000000-0000-4000-8000-0000000000f1", name: "โรงงานจำลอง หนึ่ง", status: "active" }],
  }),

  // Anything not overridden falls through to the contract's own examples.
  ...generatedHandlers,
];
