/**
 * The sales agent programme for the mock persona `agent` (phone 0861234567): an approved freelance agent, so the
 * agent pages render as an agent sees them. Every other customer falls through to the contract's examples (the
 * offer and the application). Obviously fake data (agent portal pack, D-464, D-465).
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { problem } from "../support";
import { customerOf } from "./customers";

const isAgent = (request: Request) => customerOf(request)?.persona === "agent";

const TERMS: Schemas["StoreAgentTermsDto"] = {
  firstOrderPct: "5",
  repeatOrderPct: "3",
  attributionMonths: 12,
  minBaseAmount: "0.00",
  uncapped: true,
};

const AGENT_ID = "00000000-0000-4000-8000-0000000a0001";

let declaration: Schemas["AgentTaxDeclarationDto"] | null = null;

export function resetAgentMock(): void {
  declaration = null;
}

export const storeAgentHandlers = [
  http.get("*/v1/store/agent/programme", ({ request }) => {
    if (!isAgent(request)) return undefined;
    return HttpResponse.json({
      agreement: null,
      plan: TERMS,
      linkCookieDays: 90,
      leadProtectionDays: 60,
      paymentTermsDays: 15,
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
