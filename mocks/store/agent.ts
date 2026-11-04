/**
 * The sales agent programme for the mock persona `agent` (phone 0861234567): an approved freelance agent, so the
 * agent pages render as an agent sees them. Every other customer falls through to the contract's examples (the
 * offer and the application). Obviously fake data (agent portal pack, D-464, D-465).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { problem } from "../support";
import { agentLeads, resetAgentLeadsMock } from "./agent-leads";
import { customerOf } from "./customers";

const isAgent = (request: Request) => customerOf(request)?.persona === "agent";
/** The ended agent (phone 0861234568, D-467): statements and 50 ทวิ only. */
const isEndedAgent = (request: Request) => customerOf(request)?.persona === "agentended";
/** Who holds an agent's record, ended or not: the programme says "agent" for both. */
const hasAgentRecord = (request: Request) => isAgent(request) || isEndedAgent(request);

const TERMS: Schemas["StoreAgentTermsDto"] = {
  firstOrderPct: "5",
  repeatOrderPct: "3",
  attributionMonths: 12,
  minBaseAmount: "0.00",
  uncapped: true,
};

const AGENT_ID = "00000000-0000-4000-8000-0000000a0001";

let declaration: Schemas["AgentTaxDeclarationDto"] | null = null;
let payoutProfile: Schemas["AgentPayoutProfileDto"] | null = null;
let otpPhone: string | null = null;

type Preference = Schemas["AgentNotificationPreferenceDto"];
const EVENTS: Schemas["AgentNotificationEvent"][] = [
  "lead_converted",
  "lead_protection_expiring",
  "follow_up_due",
  "quote_opened",
  "commission_earned",
  "statement_ready",
  "payout_paid",
  "payout_profile_needed",
];
/** E-mail of the money events is locked on (D-144, API-CHANGES-P2). */
const LOCKED_EMAIL = new Set(["statement_ready", "payout_paid", "payout_profile_needed"]);
const freshPreferences = (): Preference[] =>
  EVENTS.flatMap((event) =>
    (["web_push", "line", "email"] as const).map((channel) => ({
      event,
      channel,
      enabled: true,
      locked: channel === "email" && LOCKED_EMAIL.has(event),
    })),
  );
let preferences = freshPreferences();
/** Sessions this mock knows of: the agent's storefront session and this device's getpack Agent one. */
let revokedOtherAgentSessions = false;

export function resetAgentMock(): void {
  declaration = null;
  payoutProfile = null;
  otpPhone = null;
  preferences = freshPreferences();
  revokedOtherAgentSessions = false;
  resetAgentLeadsMock();
}

/** The public programme the landing reads (D-466) — open for applications in the mock so the flow can be walked. */
const PUBLIC_PROGRAMME: Schemas["PublicAgentProgrammeDto"] = {
  terms: TERMS,
  linkCookieDays: 90,
  leadProtectionDays: 60,
  paymentTermsDays: 15,
  applyOpen: true,
  waitlistOpen: false,
  waitlistConsent: null,
  agreement: {
    key: "sales_agent_agreement",
    versionNo: 1,
    effectiveFrom: "2026-01-01T00:00:00+07:00",
    textTh: "ข้อตกลงตัวแทนขาย (ข้อความจำลองสำหรับทดสอบ ไม่ใช่ข้อตกลงจริง)",
    textEn: "Sales agent agreement (mock text for testing — not the real agreement)",
  },
  examples: [
    { orderValue: "20000.00", firstOrder: "1000.00", repeatOrder: "600.00" },
    { orderValue: "100000.00", firstOrder: "5000.00", repeatOrder: "3000.00" },
    { orderValue: "1000000.00", firstOrder: "50000.00", repeatOrder: "30000.00" },
  ],
  faqs: [
    {
      questionTh: "คำถามตัวอย่าง (ข้อมูลจำลอง)",
      questionEn: "Sample question (mock)",
      answerTh: "คำตอบตัวอย่างจากระบบจำลอง คำถามจริงมาจากทีมการตลาด",
      answerEn: "A mock answer; the real questions come from Marketing.",
    },
  ],
};

export const storeAgentHandlers = [
  /*
   * The ended agent (D-467 guard): every agent-level path answers `agents.ended`; the programme and the statements
   * (list, detail, 50 ทวิ) still answer as for any agent.
   */
  http.all("*/v1/store/agent/*", ({ request }) => {
    if (!isEndedAgent(request)) return undefined;
    const path = new URL(request.url).pathname;
    if (/\/v1\/store\/agent\/(programme|statements)(\/|$)/.test(path)) return undefined;
    return problem(403, "agents.ended", "บัญชีตัวแทนนี้สิ้นสุดแล้ว ยังดูรายงานค่าคอมและ 50 ทวิ ได้");
  }),
  http.get("*/v1/store/agent", ({ request }) =>
    isEndedAgent(request)
      ? problem(403, "agents.ended", "บัญชีตัวแทนนี้สิ้นสุดแล้ว ยังดูรายงานค่าคอมและ 50 ทวิ ได้")
      : undefined,
  ),
  http.get("*/v1/store/agent/leads", ({ request }) => {
    if (!isAgent(request)) return undefined;
    const leads = agentLeads();
    return HttpResponse.json({ data: leads, meta: { page: 1, perPage: 25, total: leads.length } });
  }),
  // getpack Agent's notification choices (D-467): stateful, with the money e-mails locked on.
  http.get("*/v1/store/agent/notification-preferences", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json({
      items: preferences,
      reachable: { webPush: false, line: false, email: true },
    } satisfies Schemas["AgentNotificationPreferencesDto"]);
  }),
  http.put("*/v1/store/agent/notification-preferences", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["SetAgentNotificationPreferencesDto"];
    for (const change of body.items) {
      const current = preferences.find((item) => item.event === change.event && item.channel === change.channel);
      if (current?.locked && !change.enabled) {
        return problem(422, "validation.failed", "อีเมลเรื่องเงินปิดไม่ได้", [
          { path: "items", code: "locked", message: "locked" },
        ]);
      }
    }
    preferences = preferences.map((item) => {
      const change = body.items.find((one) => one.event === item.event && one.channel === item.channel);
      return change ? { ...item, enabled: change.enabled } : item;
    });
    return HttpResponse.json({
      items: preferences,
      reachable: { webPush: false, line: false, email: true },
    } satisfies Schemas["AgentNotificationPreferencesDto"]);
  }),
  // Where the person is signed in (D-467, `store.me.sessions`): their storefront session and this device's agent one.
  http.get("*/v1/store/me/sessions", ({ request }) => {
    if (!hasAgentRecord(request)) return undefined;
    const data: Schemas["MySessionDto"][] = [
      {
        id: "00000000-0000-4000-8000-0000000a0501",
        client: "agent",
        loginMethod: "phone_otp",
        signedInAt: "2026-11-03T09:15:00+07:00",
        lastActiveAt: "2026-11-03T14:05:00+07:00",
        expiresAt: "2026-12-03T14:05:00+07:00",
        userAgent: "Mozilla/5.0 (mock browser — this device)",
        current: true,
      },
      ...(revokedOtherAgentSessions
        ? []
        : [
            {
              id: "00000000-0000-4000-8000-0000000a0502",
              client: "agent" as const,
              loginMethod: "line" as const,
              signedInAt: "2026-10-30T19:40:00+07:00",
              lastActiveAt: "2026-11-01T08:12:00+07:00",
              expiresAt: "2026-12-01T08:12:00+07:00",
              userAgent: "Mozilla/5.0 (mock phone — another device)",
              current: false,
            },
          ]),
      {
        id: "00000000-0000-4000-8000-0000000a0503",
        client: "storefront",
        loginMethod: "phone_otp",
        signedInAt: "2026-10-16T10:00:00+07:00",
        lastActiveAt: "2026-11-02T21:30:00+07:00",
        expiresAt: "2026-12-02T21:30:00+07:00",
        userAgent: "Mozilla/5.0 (mock laptop)",
        current: false,
      },
    ];
    return HttpResponse.json({ data } satisfies Schemas["MySessionListDto"]);
  }),
  http.post("*/v1/store/me/sessions/actions/revoke", async ({ request }) => {
    if (!hasAgentRecord(request)) return undefined;
    const body = (await request.json()) as Schemas["RevokeMySessionsDto"];
    const revoked = body.client === "agent" && !revokedOtherAgentSessions ? 1 : 0;
    if (body.client === "agent") revokedOtherAgentSessions = true;
    return HttpResponse.json({ revoked } satisfies Schemas["RevokedSessionsDto"]);
  }),
  http.get("*/v1/store/agent/programme/public", () => HttpResponse.json(PUBLIC_PROGRAMME)),
  // The API computes the example; the mock does the same so the calculator shows a figure (never the web).
  http.get("*/v1/store/agent/programme/example", ({ request }) => {
    const value = new URL(request.url).searchParams.get("orderValue") ?? "0";
    const satang = Math.round(Number(value) * 100);
    return HttpResponse.json({
      orderValue: (satang / 100).toFixed(2),
      firstOrder: (Math.round(satang * 0.05) / 100).toFixed(2),
      repeatOrder: (Math.round(satang * 0.03) / 100).toFixed(2),
    } satisfies Schemas["AgentCommissionExampleDto"]);
  }),
  http.post("*/v1/store/agent/phone-verification", async ({ request }) => {
    otpPhone = ((await request.json()) as Schemas["AgentPhoneOtpRequestDto"]).phone;
    const now = Date.now();
    return HttpResponse.json({
      challengeId: "00000000-0000-4000-8000-00000000c0de",
      codeLength: 6,
      expiresAt: new Date(now + 5 * 60_000).toISOString(),
      maxAttempts: 5,
      resendAvailableAt: new Date(now + 30_000).toISOString(),
    } satisfies Schemas["OtpChallengeDto"]);
  }),
  http.post("*/v1/store/agent/phone-verification/actions/confirm", async ({ request }) => {
    const body = (await request.json()) as Schemas["OtpVerifyDto"];
    if (body.code !== "000000") return problem(422, "auth.otp_invalid", "รหัสไม่ถูกต้อง (รหัสจำลองคือ 000000)");
    return HttpResponse.json({ phone: otpPhone ?? "0810000000" } satisfies Schemas["AgentPhoneVerifiedDto"]);
  }),
  http.get("*/v1/store/agent/payout-profile", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json(
      {
        applicable: true,
        juristicType: "individual",
        payoutReady: payoutProfile?.status === "verified",
        profile: payoutProfile,
      } satisfies Schemas["MyPayoutProfileDto"],
      payoutProfile ? { headers: { ETag: `W/"${payoutProfile.rowVersion}"` } } : undefined,
    );
  }),
  http.put("*/v1/store/agent/payout-profile", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    const body = (await request.json()) as Schemas["UpsertAgentPayoutProfileDto"];
    const digits = (body.bankAccountNo ?? "").replace(/[^0-9]/g, "");
    payoutProfile = {
      id: "00000000-0000-4000-8000-0000000a0301",
      status: "draft",
      legalName: body.legalName ?? null,
      taxId: body.taxId ?? null,
      branchCode: body.branchCode ?? "00000",
      isVatRegistered: body.isVatRegistered ?? false,
      address: body.address ?? null,
      postcode: body.postcode ?? null,
      idDocument: body.idDocumentFileId ? { id: body.idDocumentFileId, originalName: "id-card.jpg" } : null,
      bankCode: body.bankCode ?? null,
      bankBranchName: body.bankBranchName ?? null,
      bankAccountName: body.bankAccountName ?? null,
      bankAccountNoLast4: digits ? digits.slice(-4) : (payoutProfile?.bankAccountNoLast4 ?? null),
      bankBook: body.bankBookFileId ? { id: body.bankBookFileId, originalName: "bank-book.jpg" } : null,
      submittedAt: null,
      verifiedAt: null,
      rejectReason: null,
      rowVersion: (payoutProfile?.rowVersion ?? 0) + 1,
    };
    return HttpResponse.json(payoutProfile, { headers: { ETag: `W/"${payoutProfile.rowVersion}"` } });
  }),
  http.post("*/v1/store/agent/payout-profile/actions/submit", ({ request }) => {
    if (!isAgent(request)) return undefined;
    if (!payoutProfile) return problem(404, "http.not_found", "ยังไม่มีข้อมูลรับเงิน");
    payoutProfile = {
      ...payoutProfile,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      rowVersion: payoutProfile.rowVersion + 1,
    };
    return HttpResponse.json(payoutProfile);
  }),
  http.get("*/v1/store/agent/programme", ({ request }) => {
    if (!hasAgentRecord(request)) return undefined;
    return HttpResponse.json({
      agreement: null,
      plan: TERMS,
      linkCookieDays: 90,
      leadProtectionDays: 60,
      paymentTermsDays: 15,
      applyOpen: false,
      state: "agent",
    } satisfies Schemas["AgentProgrammeDto"]);
  }),
  http.get("*/v1/store/agent", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json({
      id: AGENT_ID,
      kind: "freelance",
      status: "active",
      code: "MOCKAG01",
      link: "http://localhost:3000/a/MOCKAG01",
      legalName: "ตัวแทนขายอิสระ (ข้อมูลจำลอง)",
      plan: { id: "00000000-0000-4000-8000-0000000a0101", code: "freelance_standard", nameTh: "ตัวแทนอิสระ — มาตรฐาน" },
      terms: TERMS,
      joinedAt: "2026-10-16T10:00:00+07:00",
      statusReason: null,
      totals: {
        pending: "1250.00",
        held: "0.00",
        earned: "830.50",
        statemented: "0.00",
        paidThisYear: "4200.00",
        activeLinks: 6,
        openLeads: 3,
      },
    } satisfies Schemas["AgentDto"]);
  }),
  http.get("*/v1/store/agent/tax-declaration", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json({
      taxYear: 2026,
      applicable: true,
      personalAllowance: "60000.00",
      declaration,
    } satisfies Schemas["MyTaxDeclarationDto"]);
  }),
  http.post("*/v1/store/agent/tax-declaration", async ({ request }) => {
    if (!isAgent(request)) return undefined;
    if (declaration?.status === "submitted")
      return problem(409, "agents.tax_declaration_open", "ส่งแบบ ล.ย.01 ของปีภาษี 2026 ไว้แล้ว รอทีมบัญชีตรวจ");
    const body = (await request.json()) as Schemas["SubmitAgentTaxDeclarationDto"];
    const allowances = body.allowances as Record<string, string>;
    // The API sums the allowances; the mock does the same so the page shows a figure (never the web).
    const total = Object.values(allowances).reduce((sum, v) => sum + Math.round(Number(v) * 100), 0);
    declaration = {
      id: "00000000-0000-4000-8000-0000000a0201",
      taxYear: 2026,
      allowances,
      allowancesTotal: (total / 100).toFixed(2),
      evidenceCount: body.evidenceFileIds.length,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      decidedAt: null,
      decisionReason: null,
    };
    return HttpResponse.json(declaration, { status: 201 });
  }),
];
