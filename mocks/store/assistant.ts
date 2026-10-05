/**
 * The assistant (U5.B5, D-304–D-306), mocked like packio-api's `FakeAssistantModel`: rule-based Thai
 * intent matching over the seven tools, never a fact no tool returned. Obviously fake — every reply
 * says "(ข้อมูลจำลอง)". Sessions and the evaluation runs live in memory.
 *
 *   store: availability (CONTRACT-REQUEST store.assistant-availability), start / get / end a session,
 *          send a message, logging opt-out.
 *   admin: the dashboard (clearance, outcomes, cost), evaluation runs and their cases, run now.
 */

import { http, HttpResponse } from "msw";

import type { Schemas } from "@/lib/api/types";

import { orders } from "../admin/commerce";
import { personaByKey } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, principalOf, problem } from "../support";
import { GLOSSARY } from "./content";
import { customerOf } from "./customers";
import { ownerIdOf } from "./owner";

type Session = Schemas["AssistantSessionDto"] & { customerId: string };
type Tool = Schemas["AssistantTool"];

const TURNS_PER_SESSION = 30;
const sessions: Session[] = [];
let seq = 0;
const turnsByOutcome = new Map<Schemas["AssistantTurnOutcome"], number>();

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const notFound = () => problem(404, "http.not_found", "ไม่พบเซสชันนี้");

const FAKE = "(ข้อมูลจำลอง)";

interface Reply {
  reply: string;
  outcome: Schemas["AssistantTurnOutcome"];
  tools: Schemas["AssistantToolUseDto"][];
}

const used = (...names: Tool[]): Schemas["AssistantToolUseDto"][] => names.map((name) => ({ name, ok: true }));

/** The fake model: one intent per message, each answered only from what its tool "returned". */
function answer(text: string, ownerId: string): Reply {
  const t = text.trim();
  if (/ลดราคา|ราคาพิเศษให้|ขอส่วนลด|ข้อมูลลูกค้าคนอื่น|ของคนอื่น|ignore|system prompt/i.test(t))
    return {
      reply: `ผู้ช่วยทำเรื่องนี้ไม่ได้ ราคาและข้อมูลของลูกค้าแต่ละรายดูแลโดยทีม Packio — คุยกับทีมได้เลย ${FAKE}`,
      outcome: "refused",
      tools: [],
    };
  if (/คุยกับ(คน|ทีม|เจ้าหน้าที่)|ขอเจ้าหน้าที่|ติดต่อทีม/.test(t))
    return {
      reply: `ส่งเรื่องให้ทีมแล้ว ทีมจะตอบในข้อความของคุณในเวลาทำการ ${FAKE}`,
      outcome: "handed_off",
      tools: used("create_handoff"),
    };
  const code = t.match(/PK-\d{4}-\d{4,5}/)?.[0];
  if (code) {
    const order = orders.find((row) => row.orderCode === code && row.customer.id === ownerId);
    return order
      ? {
          reply: `คำสั่งซื้อ ${code} ตอนนี้อยู่สถานะ “${order.status}” ${FAKE}`,
          outcome: "answered",
          tools: used("get_order_status"),
        }
      : {
          reply: `ไม่พบคำสั่งซื้อ ${code} ในบัญชีของคุณ ตรวจเลขอีกครั้ง หรือคุยกับทีม ${FAKE}`,
          outcome: "answered",
          tools: [{ name: "get_order_status", ok: false }],
        };
  }
  const term = GLOSSARY.find((row) =>
    [row.termTh, row.termEn ?? "", ...row.aliases].some((word) => word && t.includes(word)),
  );
  if (term && /คืออะไร|หมายถึง|แปลว่า|อธิบาย/.test(t))
    return {
      reply: `${term.termTh}: ${term.definitionTh} ${FAKE}`,
      outcome: "answered",
      tools: used("lookup_glossary"),
    };
  if (/ราคา|เท่าไหร่|เท่าไร/.test(t))
    return {
      reply: `กล่องฝาเสียบเริ่มต้นที่ ฿4.20 ต่อชิ้นที่ 1,000 ชิ้น (ราคาเริ่มต้นจากแค็ตตาล็อก) ราคาที่ขนาดของคุณดูได้ในหน้ากำหนดสเปก ${FAKE}`,
      outcome: "answered",
      tools: used("get_quote"),
    };
  if (/แนะนำ|กล่องแบบไหน|ใส่|ส่งของ|ไปรษณีย์/.test(t))
    return {
      reply: `สำหรับส่งพัสดุ แนะนำกล่องไปรษณีย์ลูกฟูกลอน E — ดูแบบได้ในคลังแบบกล่อง ${FAKE}`,
      outcome: "answered",
      tools: used("recommend_structure", "search_styles"),
    };
  if (/วิธี|ยังไง|อย่างไร|ไฟล์/.test(t))
    return {
      reply: `เตรียมไฟล์ให้มีระยะตัดตก 3 มม. และวางตัวอักษรในพื้นที่ปลอดภัย อ่านทีละขั้นได้ในบทเรียน “เตรียมไฟล์พิมพ์” ${FAKE}`,
      outcome: "answered",
      tools: used("search_help"),
    };
  return {
    reply: `ผู้ช่วยยังตอบเรื่องนี้ไม่ได้อย่างมั่นใจ ถามทีมได้เลย ${FAKE}`,
    outcome: "blocked_unsupported_fact",
    tools: used("search_help"),
  };
}

function ownSession(request: Request, id: string) {
  const customer = customerOf(request);
  if (!customer) return { error: unauthenticated() } as const;
  const session = sessions.find((row) => row.id === id && row.customerId === customer.id);
  return session ? ({ customer, session } as const) : ({ error: notFound() } as const);
}

const dto = ({ customerId: _owner, ...session }: Session): Schemas["AssistantSessionDto"] => {
  void _owner;
  return session;
};

/** Mock evaluation runs (the API's harness has ≥ 100 Thai cases and ≥ 20 red-team ones). */
const runs: Schemas["EvalRunDetailDto"][] = [evalRun(1, 104, 97, "nightly"), evalRun(2, 104, 99, "nightly")];

function evalRun(
  n: number,
  cases: number,
  passed: number,
  trigger: Schemas["AssistantEvalTrigger"],
): Schemas["EvalRunDetailDto"] {
  const redTeam = 22;
  return {
    id: mockId("3va1", n),
    provider: "fake",
    model: "fake-thai-intents",
    trigger,
    suiteVersion: "2026.10.1",
    cases,
    passed,
    passRatePct: ((passed / cases) * 100).toFixed(2),
    redTeamCases: redTeam,
    redTeamPassed: redTeam,
    costUsd: "0.00",
    finishedAt: bangkokIso(-60 * 24 * (3 - n)),
    results: Array.from({ length: cases }, (_, i) => ({
      id: `${i < redTeam ? "rt" : "th"}-${String(i + 1).padStart(3, "0")}`,
      kind: i < redTeam ? ("red_team" as const) : ("standard" as const),
      passed: i < passed,
      reason: i < passed ? null : "expected tool get_quote, called search_help",
    })),
  };
}

const summary = ({ results: _results, ...run }: Schemas["EvalRunDetailDto"]): Schemas["EvalRunDto"] => {
  void _results;
  return run;
};

function staff(request: Request) {
  const principal = principalOf(request);
  if (principal?.audience !== "staff") return null;
  return personaByKey(principal.persona ?? "cs") ?? null;
}

const manages = (request: Request) => staff(request)?.permissions.includes("assistant.manage" as never) ?? false;

export const assistantHandlers = [
  // CONTRACT-REQUEST store.assistant-availability — on in the mock, so the panel can be exercised.
  mockRequest("GET /v1/store/assistant/availability", () => ({ available: true, reason: null, logRetentionDays: 30 })),

  http.post("*/v1/store/assistant/sessions", async ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const body = (await request.json().catch(() => ({}))) as Schemas["StartAssistantDto"];
    const session: Session = {
      id: mockId("a5s7", ++seq),
      customerId: customer.id,
      status: "open",
      loggingOptOut: body.loggingOptOut ?? false,
      turns: 0,
      createdAt: bangkokIso(),
    };
    sessions.push(session);
    return HttpResponse.json(dto(session), { status: 201 });
  }),

  http.get("*/v1/store/assistant/sessions/:sessionId", ({ request, params }) => {
    const found = ownSession(request, String(params.sessionId));
    return "error" in found ? found.error : HttpResponse.json(dto(found.session));
  }),

  http.post("*/v1/store/assistant/sessions/:sessionId/actions/end", ({ request, params }) => {
    const found = ownSession(request, String(params.sessionId));
    if ("error" in found) return found.error;
    found.session.status = "ended";
    return HttpResponse.json(dto(found.session));
  }),

  http.put("*/v1/store/assistant/sessions/:sessionId/logging", async ({ request, params }) => {
    const found = ownSession(request, String(params.sessionId));
    if ("error" in found) return found.error;
    const { optOut } = (await request.json()) as Schemas["AssistantLoggingDto"];
    found.session.loggingOptOut = optOut;
    return HttpResponse.json(dto(found.session));
  }),

  http.post("*/v1/store/assistant/sessions/:sessionId/messages", async ({ request, params }) => {
    const found = ownSession(request, String(params.sessionId));
    if ("error" in found) return found.error;
    const { session, customer } = found;
    if (session.status !== "open") return problem(409, "assistant.session_ended", "เซสชันนี้จบแล้ว เริ่มใหม่ได้");
    const { text } = (await request.json()) as Schemas["AssistantMessageDto"];
    if (!text?.trim())
      return problem(422, "validation.failed", "พิมพ์คำถามก่อน", [
        { path: "text", code: "required", message: "required" },
      ]);
    session.turns += 1;
    const result = answer(text, ownerIdOf(customer));
    turnsByOutcome.set(result.outcome, (turnsByOutcome.get(result.outcome) ?? 0) + 1);
    if (session.turns >= TURNS_PER_SESSION) session.status = "limit_reached";
    return HttpResponse.json(
      { turnNo: session.turns, ...result, sessionStatus: session.status } satisfies Schemas["AssistantTurnDto"],
      { status: 201 },
    );
  }),

  http.get("*/v1/admin/assistant/dashboard", ({ request }) => {
    if (!staff(request)) return unauthenticated();
    if (!manages(request)) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์ดูแดชบอร์ดผู้ช่วย");
    const latest = runs.at(-1)!;
    return HttpResponse.json({
      clearance: {
        cleared: false,
        reason: "assistant.eval_min_pass_rate_pct ยังไม่ได้ตั้งค่า และยังไม่ได้เลือกผู้ให้บริการ (ADR-0012)",
      },
      runs: runs.map(summary).reverse(),
      sessions: sessions.length,
      outcomes: (["answered", "blocked_unsupported_fact", "refused", "handed_off", "failed"] as const).map(
        (outcome) => ({
          outcome,
          turns: turnsByOutcome.get(outcome) ?? 0,
        }),
      ),
      costUsd: latest.costUsd,
    } satisfies Schemas["AssistantDashboardDto"]);
  }),

  http.get("*/v1/admin/assistant/eval-runs", ({ request }) => {
    if (!manages(request)) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์");
    const rows = runs.map(summary).reverse();
    return HttpResponse.json({ data: rows, meta: { page: 1, perPage: 25, total: rows.length } });
  }),

  http.post("*/v1/admin/assistant/eval-runs", ({ request }) => {
    if (!manages(request)) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์");
    const run = evalRun(runs.length + 1, 104, 101, "manual");
    runs.push(run);
    return HttpResponse.json(summary(run), { status: 201 });
  }),

  http.get("*/v1/admin/assistant/eval-runs/:runId", ({ request, params }) => {
    if (!manages(request)) return problem(403, "auth.forbidden", "ไม่มีสิทธิ์");
    const run = runs.find((row) => row.id === params.runId);
    return run ? HttpResponse.json(run) : problem(404, "http.not_found", "ไม่พบรอบการประเมินนี้");
  }),
];
