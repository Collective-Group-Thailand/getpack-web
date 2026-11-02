/**
 * Sign-in, refresh and `/me` for all three surfaces — the behaviour the auth flows need:
 * credentials that can be wrong, an OTP that can be mistyped, audiences that are actually
 * checked. Staff sign in as one of the D-140 personas (`./personas.ts`), chosen by e-mail.
 *
 * Every endpoint here is one getpack-api has published (B1.3).
 */

import { http, HttpResponse } from "msw";

import { DEFAULT_PERSONA, MOCK_PASSWORD, menuFor, personaByEmail, personaByKey, type StaffPersona } from "./personas";
import { factoryNameOf } from "./partner/factory-names";
import { partnerPersonaByEmail, partnerPersonaByKey, permissionsOf, type PartnerPersona } from "./partner/personas";
import { MOCK_CUSTOMER_PHONES, resetCustomer, type CustomerPersona } from "./store/customers";
import { uatParticipants, uatPersona } from "./uat";
import { accessToken, principalOf, principalOfRefresh, problem, refreshToken, type Audience } from "./support";

/** The default staff credentials the F1 tests use: a CS agent. */
export const MOCK_STAFF = { email: "somchai.staff@getpack.invalid", password: MOCK_PASSWORD };
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
  creditadmin: "00000000-0000-4000-8000-0000000000cb",
  creditbuyer: "00000000-0000-4000-8000-0000000000cc",
  agent: "00000000-0000-4000-8000-0000000000cd",
  agentended: "00000000-0000-4000-8000-0000000000ce",
  // The scorecard round's participants (`./uat.ts`, only with MOCK_DATASET=uat).
  ...Object.fromEntries(
    uatParticipants().map((participant, n) => [
      uatPersona(participant),
      `00000000-0000-4000-8000-00000000ca${String(n + 1).padStart(2, "0")}`,
    ]),
  ),
};
/** Hand-off codes waiting to be redeemed (single use, 60 s). */
const handoffCodes = new Map<string, { persona?: string; fingerprint: string; expiresAt: number }>();

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
    // As getpack-api's `toE164`: a national number, or a mobile without its leading zero.
    const digits = (body.phone ?? "").replace(/[\s\-().]/g, "");
    const national = /^[689]\d{8}$/.test(digits) ? `0${digits}` : digits;
    if (!/^0\d{8,9}$/.test(national)) {
      return problem(422, "validation.failed", "กรุณาใส่เบอร์มือถือในประเทศไทยให้ถูกต้อง");
    }
    return HttpResponse.json({
      challengeId: CHALLENGES[MOCK_CUSTOMER_PHONES[national] ?? "returning"],
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      // Seconds, not minutes: a test should not be made to wait out a real cooldown.
      resendAvailableAt: new Date(Date.now() + 3_000).toISOString(),
      codeLength: MOCK_OTP.code.length,
      maxAttempts: 5,
    });
  }),

  http.post("*/v1/auth/customer/otp/verify", async ({ request }) => {
    const body = (await request.json()) as { challengeId?: string; code?: string };
    const persona = (Object.keys(CHALLENGES) as CustomerPersona[]).find((key) => CHALLENGES[key] === body.challengeId);
    // getpack-api answers a wrong code with 422 `auth.otp_invalid` and the tries left — not a 401.
    if (!persona || body.code !== MOCK_OTP.code) {
      return problem(422, "auth.otp_invalid", "รหัส OTP ไม่ถูกต้อง เหลือโอกาสอีก 4 ครั้ง");
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

  /*
   * Storefront → getpack Agent hand-off (D-467): a one-time code for the signed-in customer, bound to the
   * fingerprint the web server derived, redeemed once by the agent zone's server for a new session. Any failure is
   * the one neutral `auth.handoff_invalid`, and a wrong fingerprint burns the code — as getpack-api does.
   */
  http.post("*/v1/auth/customer/handoff", async ({ request }) => {
    const principal = principalOf(request);
    if (principal?.audience !== "customer") return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
    const body = (await request.json()) as { target?: string; fingerprint?: string };
    if (body.target !== "agent" || !body.fingerprint || body.fingerprint.length < 16 || body.fingerprint.length > 512) {
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง");
    }
    const code = `hc_mock_${crypto.randomUUID().replaceAll("-", "")}`;
    const expiresAt = new Date(Date.now() + 60_000);
    handoffCodes.set(code, {
      persona: principal.persona,
      fingerprint: body.fingerprint,
      expiresAt: expiresAt.getTime(),
    });
    return HttpResponse.json({ code, expiresAt: expiresAt.toISOString(), target: "agent" }, { status: 201 });
  }),
  http.post("*/v1/auth/customer/handoff/actions/redeem", async ({ request }) => {
    const body = (await request.json()) as { code?: string; fingerprint?: string };
    const entry = body.code ? handoffCodes.get(body.code) : undefined;
    if (body.code) handoffCodes.delete(body.code);
    if (!entry || entry.expiresAt < Date.now() || entry.fingerprint !== body.fingerprint) {
      return problem(401, "auth.handoff_invalid", "ลิงก์เปิด getpack Agent นี้ใช้ไม่ได้แล้ว");
    }
    return session("customer", undefined, entry.persona as CustomerPersona | undefined);
  }),

  http.post("*/v1/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    const principal = principalOfRefresh(body.refreshToken);
    if (!principal) return problem(401, "auth.invalid_refresh_token", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
    return session(
      principal.audience,
      principal.audience === "staff" ? personaByKey(principal.persona) : undefined,
      // Every customer persona survives a refresh (getpack Agent keeps its agent signed in, D-467).
      principal.audience === "customer" ? (principal.persona as CustomerPersona | undefined) : undefined,
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
      // `partner.me.get` names each factory (U-B0.3, `partner.factory-name`): trade name, else legal name.
      factories: [persona.factoryId].map((factoryId) => ({
        factoryId,
        code: factoryNameOf(factoryId)?.code ?? "",
        name: factoryNameOf(factoryId)?.name ?? "",
        roles: persona.roles,
      })),
    };
  }),
];
