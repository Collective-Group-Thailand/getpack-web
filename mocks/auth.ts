/**
 * Sign-in, refresh and `/me` for all three surfaces — the behaviour the auth flows need:
 * credentials that can be wrong, an OTP that can be mistyped, audiences that are actually
 * checked. Staff sign in as one of the D-140 personas (`./personas.ts`), chosen by e-mail.
 *
 * Every endpoint here is one packio-api has published (B1.3).
 */

import { http, HttpResponse } from "msw";

import { DEFAULT_PERSONA, MOCK_PASSWORD, menuFor, personaByEmail, personaByKey, type StaffPersona } from "./personas";
import { partnerPersonaByEmail, partnerPersonaByKey, permissionsOf, type PartnerPersona } from "./partner/personas";
import { MOCK_CUSTOMER_PHONES, resetCustomer, type CustomerPersona } from "./store/customers";
import { accessToken, principalOf, principalOfRefresh, problem, refreshToken, type Audience } from "./support";

/** The default staff credentials the F1 tests use: a CS agent. */
export const MOCK_STAFF = { email: "somchai.staff@packio.invalid", password: MOCK_PASSWORD };
export const MOCK_PARTNER = { email: "planner@factory.invalid", password: MOCK_PASSWORD, pin: "1234" };
export const MOCK_OTP = {
  phone: "0812345678",
  code: "000000",
  challengeId: "00000000-0000-4000-8000-0000000000c1",
};
/** A first-time customer: signing in with this number walks the consent and profile steps. */
export const MOCK_NEW_CUSTOMER_PHONE = "0898765432";

/** One challenge id per customer persona, so verify knows who asked. */
const CHALLENGES: Record<CustomerPersona, string> = {
  returning: MOCK_OTP.challengeId,
  newcomer: "00000000-0000-4000-8000-0000000000c2",
  buyer: "00000000-0000-4000-8000-0000000000c3",
  artist: "00000000-0000-4000-8000-0000000000c4",
  receiver: "00000000-0000-4000-8000-0000000000c5",
  companyadmin: "00000000-0000-4000-8000-0000000000c6",
  companybuyer: "00000000-0000-4000-8000-0000000000c7",
  founder: "00000000-0000-4000-8000-0000000000c8",
  designer: "00000000-0000-4000-8000-0000000000c9",
};
/** Firebase and LINE tokens the mock accepts (the SDKs never run against the mock). */
export const MOCK_ID_TOKENS = { google: "mock.firebase.google", apple: "mock.firebase.apple", line: "mock.line" };

const CUSTOMER = {
  id: "00000000-0000-4000-8000-000000000001",
  roles: ["customer"],
  permissions: [] as string[],
  scopes: [] as string[],
};
function subject(audience: Audience, persona?: StaffPersona, partner?: PartnerPersona) {
  if (audience === "staff" && persona) {
    return { id: persona.id, type: "staff", roles: persona.roles, permissions: persona.permissions, scopes: [] };
  }
  if (audience === "partner") {
    const who = partner ?? partnerPersonaByKey(undefined)!;
    return {
      id: who.id,
      type: "partner",
      roles: who.roles,
      permissions: permissionsOf(who),
      scopes: [`factory:${who.factoryId}`],
    };
  }
  return { ...CUSTOMER, type: audience };
}

function session(audience: Audience, persona?: StaffPersona, customer?: CustomerPersona, partner?: PartnerPersona) {
  // The returning customer's token carries no persona, as it did before the newcomer existed;
  // likewise the F1 planner's partner token.
  const key =
    persona?.key ??
    (customer && customer !== "returning" ? customer : undefined) ??
    (partner && partner.key !== "planner" ? partner.key : undefined);
  return HttpResponse.json({
    accessToken: accessToken(audience, key),
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: refreshToken(audience, key),
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
    subject: subject(audience, persona, partner),
  });
}

/** The persona behind a staff request — for the admin mocks that answer differently per role. */
export function staffPersonaOf(request: Request): StaffPersona | undefined {
  const principal = principalOf(request);
  return principal?.audience === "staff" ? personaByKey(principal.persona ?? DEFAULT_PERSONA) : undefined;
}

/** The factory user behind a partner request, for the partner mocks (`./partner`). */
export function partnerPersonaOf(request: Request): PartnerPersona | undefined {
  const principal = principalOf(request);
  return principal?.audience === "partner" ? partnerPersonaByKey(principal.persona) : undefined;
}

function meHandler(path: string, audience: Audience, body: (request: Request) => Record<string, unknown>) {
  return http.get(`*${path}`, ({ request }) => {
    const presented = principalOf(request);
    if (!presented) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    if (presented.audience !== audience) return problem(403, "auth.wrong_audience", "โทเคนนี้ใช้กับส่วนนี้ไม่ได้");
    return HttpResponse.json(body(request));
  });
}

export const authHandlers = [
  http.post("*/v1/auth/staff/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const persona = personaByEmail(body.email);
    if (!persona || body.password !== MOCK_PASSWORD) {
      return problem(401, "auth.invalid_credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    return session("staff", persona);
  }),

  http.post("*/v1/auth/partner/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; pin?: string };
    // `PartnerLoginDto` requires only the email: a shared shop-floor device may be enrolled
    // with a PIN instead of a password, so either one signs in. Every factory persona
    // (`./partner/personas.ts`) shares the one mock password and PIN.
    const credentialOk = body.password === MOCK_PARTNER.password || body.pin === MOCK_PARTNER.pin;
    const persona = partnerPersonaByEmail(body.email);
    if (!persona || !credentialOk) {
      return problem(401, "auth.invalid_credentials", "อีเมล รหัสผ่าน หรือรหัส PIN ไม่ถูกต้อง");
    }
    return session("partner", undefined, undefined, persona);
  }),

  http.post("*/v1/auth/customer/otp/request", async ({ request }) => {
    const body = (await request.json()) as { phone?: string };
    if (!body.phone || !/^0\d{8,9}$/.test(body.phone)) {
      return problem(422, "auth.invalid_phone", "กรุณาใส่เบอร์มือถือในประเทศไทยให้ถูกต้อง");
    }
    return HttpResponse.json({
      challengeId: CHALLENGES[MOCK_CUSTOMER_PHONES[body.phone] ?? "returning"],
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      // Seconds, not minutes: a test should not be made to wait out a real cooldown.
      resendAvailableAt: new Date(Date.now() + 3_000).toISOString(),
    });
  }),

  http.post("*/v1/auth/customer/otp/verify", async ({ request }) => {
    const body = (await request.json()) as { challengeId?: string; code?: string };
    const persona = (Object.keys(CHALLENGES) as CustomerPersona[]).find((key) => CHALLENGES[key] === body.challengeId);
    if (!persona || body.code !== MOCK_OTP.code) {
      return problem(401, "auth.invalid_otp", "รหัส OTP ไม่ถูกต้อง");
    }
    if (persona === "newcomer") resetCustomer("newcomer");
    return session("customer", undefined, persona);
  }),

  // Google / Apple through Firebase, and LINE (B1.3). The mock accepts its own fake tokens only;
  // a real SDK's token is refused, so nothing pretends a real provider was reached.
  http.post("*/v1/auth/customer/firebase", async ({ request }) => {
    const body = (await request.json()) as { idToken?: string };
    if (body.idToken !== MOCK_ID_TOKENS.google && body.idToken !== MOCK_ID_TOKENS.apple) {
      return problem(401, "auth.invalid_id_token", "ยืนยันตัวตนกับผู้ให้บริการไม่สำเร็จ");
    }
    return session("customer");
  }),
  http.post("*/v1/auth/customer/line", async ({ request }) => {
    const body = (await request.json()) as { idToken?: string; liffAccessToken?: string };
    if (body.idToken !== MOCK_ID_TOKENS.line && body.liffAccessToken !== MOCK_ID_TOKENS.line) {
      return problem(401, "auth.invalid_id_token", "ยืนยันตัวตนกับ LINE ไม่สำเร็จ");
    }
    return session("customer");
  }),

  http.post("*/v1/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    const principal = principalOfRefresh(body.refreshToken);
    if (!principal) return problem(401, "auth.invalid_refresh_token", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    return session(
      principal.audience,
      principal.audience === "staff" ? personaByKey(principal.persona) : undefined,
      principal.audience === "customer" && (principal.persona === "newcomer" || principal.persona === "buyer")
        ? principal.persona
        : undefined,
      principal.audience === "partner" ? partnerPersonaByKey(principal.persona) : undefined,
    );
  }),

  meHandler("/v1/admin/me", "staff", (request) => {
    const persona = staffPersonaOf(request)!;
    return {
      id: persona.id,
      displayName: persona.displayName,
      email: persona.email,
      locale: "th",
      roles: persona.roles,
      permissions: persona.permissions,
      menu: menuFor(persona),
      featureFlags: ["labelCalculator"],
    };
  }),
  meHandler("/v1/partner/me", "partner", (request) => {
    const persona = partnerPersonaOf(request)!;
    return {
      id: persona.id,
      displayName: persona.displayName,
      email: persona.email,
      locale: "th",
      roles: persona.roles,
      permissions: permissionsOf(persona),
      factories: [{ factoryId: persona.factoryId, roles: persona.roles }],
    };
  }),
];
