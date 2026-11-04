/**
 * Loyalty P2 (API-CHANGES-P2, Admin): loyalty analytics, campaigns, the audience estimate, agent performance, survey
 * templates and results, and showcase consents, in the generated shapes (getpack-api `feat/loyalty-p2-lifecycle`, pinned
 * in `contract.lock.json`). All figures are fake and only consistent with themselves (the opening
 * and closing balances chain; the liability is the API sample's).
 */

import { http, HttpResponse } from "msw";

import type { LoyaltyAnalytics, SurveyResults, SurveyTemplate } from "@/features/shared/loyalty-p2/types";
import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, principalOf, problem, type Principal } from "../support";

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const page = <T>(data: T[]) => ({ data, meta: { page: 1, perPage: 25, total: data.length } });

/** A staff handler: 401 without a token, 403 for another zone's; a plain value answers 200 as JSON. */
function staff(
  method: "get" | "post" | "patch",
  path: string,
  resolve: (context: {
    request: Request;
    params: Record<string, string>;
    principal: Principal;
    query: URLSearchParams;
  }) => unknown,
) {
  return http[method](`*${path}`, async ({ request, params }) => {
    const principal = principalOf(request);
    if (!principal) return unauthenticated();
    if (principal.audience !== "staff") return problem(403, "auth.wrong_audience", "โทเคนนี้ใช้กับส่วนนี้ไม่ได้");
    const result = await resolve({
      request,
      params: params as Record<string, string>,
      principal,
      query: new URL(request.url).searchParams,
    });
    return result instanceof Response ? result : HttpResponse.json(result as never);
  });
}

/** Earned by source, redeemed, returned, reversed, expired — per month, oldest first (the prototype's figures). */
const MONTHS: [number, number, number, number, number, number, number, number][] = [
  [7600, 1200, 200, 0, 3900, 20, 200, 820],
  [7900, 1300, 400, 0, 4000, 40, 210, 860],
  [8050, 1350, 200, 80, 4050, 30, 190, 880],
  [8200, 1400, 200, 0, 4100, 40, 220, 900],
  [8900, 1600, 400, 120, 4600, 60, 180, 980],
  [9300, 1900, 200, 240, 5000, 20, 260, 1010],
  [9100, 2300, 400, 320, 4800, 80, 240, 1060],
  [9600, 2600, 200, 520, 5100, 40, 310, 1090],
  [9800, 2100, 400, 640, 5200, 80, 300, 1120],
];
const LAST_MONTH = "2026-10";

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
};
const monthAt = (offset: number) => {
  const [y, m] = LAST_MONTH.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) - offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

export function loyaltyAnalyticsOf(from: string, to: string): LoyaltyAnalytics {
  // The mock's months end at 2026-10; a later `to` is clipped, an earlier one shifts the window.
  const last = monthsBetween(to, LAST_MONTH) > 0 ? to : LAST_MONTH;
  const count = Math.max(1, Math.min(MONTHS.length, monthsBetween(from, last) + 1));
  const rows = MONTHS.slice(MONTHS.length - count);
  let closing = 182400;
  const movement = rows
    .map((_, back) => rows[rows.length - 1 - back]!)
    .map((row, back) => {
      const [order, activity, referral, bonus, redeemed, returned, reversed, expired] = row;
      const opening = closing - (order + activity + referral + bonus - redeemed + returned - reversed - expired);
      const entry = {
        month: monthAt(back + monthsBetween(last, LAST_MONTH)),
        openingPoints: opening,
        earned: { order, activity, referral, bonus },
        redeemed,
        returned,
        reversed,
        expired,
        adjusted: 0,
        closingPoints: closing,
      };
      closing = opening;
      return entry;
    })
    .reverse();
  return {
    from: movement[0]!.month,
    to: movement.at(-1)!.month,
    asOf: bangkokIso(),
    liability: {
      outstandingPoints: 182400,
      faceValue: "456000.00",
      expectedRedemptionRatePct: "60",
      rateConfirmation: "pending_cpa",
      rateSettingVersionId: "418",
      estimatedLiability: "273600.00",
      ledgerBalance2330: "270150.00",
      difference: "3450.00",
    },
    movement,
    breakage: {
      windowMonths: 12,
      issuedPoints: 210000,
      expiredPoints: 80220,
      actualPct: "38.20",
      assumedPct: "40.00",
      monthsOfData: 7,
      reliable: false,
    },
    earnVsRedeem: {
      bySource: [
        { source: "order", earned: 98000 },
        { source: "activity", earned: 21000 },
        { source: "referral", earned: 4000 },
        { source: "bonus", earned: 6400 },
      ],
      byTier: [
        { tier: "gold", members: 12, earned: 31000, redeemed: 14000, redemptionPct: "45.16" },
        { tier: "silver", members: 48, earned: 52000, redeemed: 18900, redemptionPct: "36.35" },
        { tier: "member", members: 645, earned: 47000, redeemed: 9100, redemptionPct: "19.36" },
      ],
    },
    retention: {
      repeatOrderRate: {
        windowDays: 180,
        redeemersPct: "42.10",
        nonRedeemersPct: "18.30",
        redeemers: 95,
        nonRedeemers: 610,
      },
      programmes: [
        { programme: "reorder_reminder", sent: 140, converted: 37, ratePct: "26.43", windowDays: 7 },
        { programme: "winback", sent: 88, converted: 9, ratePct: "10.23", windowDays: 30 },
        { programme: "quote_recovery", sent: 64, converted: 11, ratePct: "17.19", windowDays: 14 },
        // k-anonymity: too few customers this period, so the API withholds the rate.
        { programme: "survey", sent: 8, converted: 2, ratePct: null, windowDays: 30 },
      ],
    },
    currency: "THB",
  };
}

const t = (th: string, en: string) => ({ th, en });
const templates: SurveyTemplate[] = [
  {
    id: mockId("svt", 1),
    code: "post_delivery_v1",
    version: 1,
    trigger: "post_delivery",
    status: "published",
    rewardEnabled: true,
    title: t("คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง", "How was your latest order?"),
    questions: [
      {
        key: "overall",
        kind: "rating",
        label: t("ความพึงพอใจโดยรวม", "Overall satisfaction"),
        min: 1,
        max: 5,
        required: true,
      },
      {
        key: "quality",
        kind: "single",
        label: t("คุณภาพงานพิมพ์ตรงกับที่คาดไหม", "Did the print quality match what you expected?"),
        options: [
          { key: "better", label: t("ดีกว่าที่คาด", "Better than expected") },
          { key: "as_expected", label: t("ตรงตามที่คาด", "As expected") },
          { key: "worse", label: t("ต่ำกว่าที่คาด", "Below expectations") },
        ],
        required: true,
      },
      {
        key: "improve",
        kind: "multi",
        label: t("อยากให้เราปรับปรุงเรื่องใด", "What should we improve?"),
        options: [
          { key: "lead_time", label: t("ระยะเวลาผลิต", "Production time") },
          { key: "price", label: t("ราคา", "Price") },
          { key: "design", label: t("การออกแบบ", "Design") },
        ],
        required: false,
      },
      {
        key: "comment",
        kind: "text",
        label: t("อยากบอกอะไรเพิ่มเติม", "Anything else?"),
        maxLength: 500,
        required: false,
      },
    ],
    responseRatePct: "45.71",
    completed: 96,
    opened: 210,
    createdAt: bangkokIso(-40 * 24 * 60),
    publishedAt: bangkokIso(-30 * 24 * 60),
    retiredAt: null,
  },
  {
    id: mockId("svt", 2),
    code: "quarterly_v1",
    version: 1,
    trigger: "quarterly",
    status: "draft",
    rewardEnabled: true,
    title: t("ความเห็นรายไตรมาส", "Quarterly check-in"),
    questions: [
      {
        key: "overall",
        kind: "rating",
        label: t("ภาพรวมการใช้ getpack", "getpack overall"),
        min: 1,
        max: 5,
        required: true,
      },
      {
        key: "recommend",
        kind: "rating",
        label: t("จะแนะนำเราให้คนอื่นไหม", "Would you recommend us?"),
        min: 1,
        max: 5,
        required: true,
      },
      {
        key: "comment",
        kind: "text",
        label: t("อยากบอกอะไรเรา", "Anything to tell us?"),
        maxLength: 500,
        required: false,
      },
    ],
    responseRatePct: null,
    completed: 0,
    opened: 0,
    createdAt: bangkokIso(-2 * 24 * 60),
    publishedAt: null,
    retiredAt: null,
  },
];

function resultsOf(template: SurveyTemplate): SurveyResults {
  const few = template.completed < 10;
  return {
    templateId: template.id,
    responses: template.completed,
    opened: template.opened,
    completionRatePct: template.responseRatePct,
    countsOnly: few,
    questions: template.questions.map((question) => {
      const label = question.label.th;
      if (question.kind === "rating")
        return {
          key: question.key,
          kind: question.kind,
          label,
          answered: template.completed,
          average: few ? null : "4.31",
          counts: [],
          texts: [],
        };
      if (question.kind === "text")
        return {
          key: question.key,
          kind: question.kind,
          label,
          answered: few ? 0 : 31,
          average: null,
          counts: [],
          texts: few
            ? []
            : [
                { customer: "คุณส•••", orderCode: "OR-2610-0042", text: "กล่องแข็งแรง สีตรงกับที่สั่ง" },
                { customer: "คุณป•••", orderCode: "OR-2610-0057", text: "อยากให้ส่งเร็วขึ้นอีกนิด" },
              ],
        };
      const counts = [52, 38, 6];
      return {
        key: question.key,
        kind: question.kind,
        label,
        answered: template.completed,
        average: null,
        texts: [],
        counts: (question.options ?? []).map((option, at) => ({
          key: option.key,
          label: option.label.th,
          count: counts[at] ?? 0,
        })),
      };
    }),
  };
}

export const loyaltyP2AdminHandlers = [
  // admin.loyaltyAnalytics.get (loyalty.read: also Finance, D-496)
  staff("get", "/v1/admin/loyalty/analytics", ({ query: search }) => {
    const query = { from: search.get("from") ?? "", to: search.get("to") ?? "" };
    if (!/^\d{4}-\d{2}$/.test(query.from) || !/^\d{4}-\d{2}$/.test(query.to))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "from", code: "format", message: "YYYY-MM" },
      ]);
    if (monthsBetween(query.from, query.to) < 0 || monthsBetween(query.from, query.to) > 23)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "to", code: "range", message: "ช่วงเดือนต้องไม่เกิน 24 เดือน" },
      ]);
    return loyaltyAnalyticsOf(query.from, query.to);
  }),
  // admin.loyaltyCampaigns.list
  staff("get", "/v1/admin/loyalty/campaigns", () =>
    page<Schemas["AdminLoyaltyCampaignDto"]>([
      {
        id: mockId("lcp", 1),
        kind: "reorder_bonus" as const,
        status: "active" as const,
        multiplier: "1.50",
        customer: { id: mockId("cus", 1), displayName: "คุณสมชาย" },
        productTypeCode: "corrugated",
        startsAt: bangkokIso(-24 * 60),
        endsAt: bangkokIso(6 * 24 * 60),
        convertedOrderCode: null,
        reason: "reorder_reminder",
      },
    ]),
  ),
  // admin.promotions.estimateAudience: a fake count from how narrow the audience is; rounded to tens, null under 10
  staff("get", "/v1/admin/promotions/:promotionId/audience-estimate", ({ query }) => {
    let audience: Record<string, unknown> = {};
    try {
      const raw = query.get("audience");
      audience = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "audience", code: "json", message: "audience must be JSON" },
      ]);
    }
    let customers = 740;
    if (audience.newCustomer) customers = Math.round(customers * 0.3);
    if (Array.isArray(audience.tiers) && audience.tiers.length)
      customers = Math.round((customers * audience.tiers.length) / 6);
    if (Array.isArray(audience.businessTypes) && audience.businessTypes.length)
      customers = Math.round((customers * audience.businessTypes.length) / 12);
    if (typeof audience.inactiveDaysGte === "number")
      customers = Math.round(customers * (60 / audience.inactiveDaysGte) * 0.4);
    if (Array.isArray(audience.orderedProductTypeCodes) && audience.orderedProductTypeCodes.length)
      customers = Math.round((customers * audience.orderedProductTypeCodes.length) / 2.2);
    const rounded = Math.round(customers / 10) * 10;
    return { customers: customers < 10 ? null : rounded, rounded: true } satisfies Schemas["AudienceEstimateDto"];
  }),
  // admin.promotions.agentPerformance
  staff("get", "/v1/admin/promotions/agent-performance", () =>
    page<Schemas["AgentPerformanceDto"]>(
      AGENT_ROWS.map((row) => ({
        ...row,
        promotionId: mockId("prm", 1),
        promotionName: "กล่องลูกฟูก 1,000 ใบขึ้นไป ลด 10%",
      })),
    ),
  ),
  // admin.surveys.listTemplates
  staff("get", "/v1/admin/surveys/templates", () => page(templates)),
  // admin.surveys.createTemplate: a code another template has is a field error (`code` · `taken`)
  staff("post", "/v1/admin/surveys/templates", async ({ request }) => {
    const body = (await request.json()) as Schemas["CreateSurveyTemplateDto"];
    if (templates.some((row) => row.code === body.code))
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "code", code: "taken", message: "a template has this code; add a new version of it" },
      ]);
    const created: SurveyTemplate = {
      ...body,
      rewardEnabled: body.rewardEnabled ?? true,
      id: mockId("svt", templates.length + 1),
      version: 1,
      status: "draft",
      responseRatePct: null,
      completed: 0,
      opened: 0,
      createdAt: bangkokIso(),
      publishedAt: null,
      retiredAt: null,
    };
    templates.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  // admin.surveys.getTemplate (with its ETag for the edit)
  staff("get", "/v1/admin/surveys/templates/:templateId", ({ params }) => {
    const row = templates.find((entry) => entry.id === params.templateId);
    return row
      ? HttpResponse.json(row, { headers: { ETag: `"svt-${row.id}-${row.version}"` } })
      : problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
  }),
  // admin.surveys.updateTemplate: drafts only
  staff("patch", "/v1/admin/surveys/templates/:templateId", async ({ request, params }) => {
    const body = (await request.json()) as Schemas["UpdateSurveyTemplateDto"];
    const at = templates.findIndex((row) => row.id === params.templateId);
    if (at === -1) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    if (templates[at]!.status !== "draft")
      return problem(409, "surveys.template_published", "แบบสอบถามที่เผยแพร่แล้วแก้ไขไม่ได้ ให้สร้างฉบับใหม่");
    templates[at] = { ...templates[at]!, ...body };
    return templates[at]!;
  }),
  // admin.surveys.templateAction: publish | retire | new-version; one published per trigger
  staff("post", "/v1/admin/surveys/templates/:templateId/actions/:action", ({ params }) => {
    const row = templates.find((entry) => entry.id === params.templateId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    if (params.action === "publish") {
      if (templates.some((entry) => entry.trigger === row.trigger && entry.status === "published" && entry !== row))
        return problem(409, "surveys.trigger_taken", "มีแบบสอบถามที่เผยแพร่สำหรับจังหวะนี้อยู่แล้ว");
      row.status = "published";
      row.publishedAt = bangkokIso();
    } else if (params.action === "retire") {
      row.status = "retired";
      row.retiredAt = bangkokIso();
    } else if (params.action === "new-version") {
      const next: SurveyTemplate = {
        ...row,
        id: mockId("svt", templates.length + 1),
        version: row.version + 1,
        status: "draft",
        completed: 0,
        opened: 0,
        responseRatePct: null,
        createdAt: bangkokIso(),
        publishedAt: null,
        retiredAt: null,
      };
      templates.push(next);
      return next;
    } else return problem(404, "http.not_found", "ไม่พบการดำเนินการนี้");
    return row;
  }),
  // admin.surveys.results
  staff("get", "/v1/admin/surveys/templates/:templateId/results", ({ params }) => {
    const row = templates.find((entry) => entry.id === params.templateId);
    return row ? resultsOf(row) : problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
  }),
  // admin.showcaseConsents.list (a withdrawn one is `doNotUse`)
  staff("get", "/v1/admin/showcase-consents", () =>
    page<Schemas["AdminShowcaseConsentDto"]>([
      {
        id: mockId("shc", 1),
        customer: { id: mockId("cus", 2), displayName: "คุณปรียา" },
        companyName: "บริษัท ตัวอย่าง จำกัด",
        scope: ["brand_name", "packaging_photos"],
        status: "approved" as const,
        consentTextVersion: "2026-11-v1",
        decidedAt: bangkokIso(-3 * 24 * 60),
        withdrawnAt: null,
        doNotUse: false,
      },
    ]),
  ),
];

/** The report's share-link rows (`refAgents[]` with the P2 performance fields). */
export const AGENT_ROWS = [
  {
    agentCode: "AGT0042",
    agentName: "สมศักดิ์ ตัวแทน",
    visitors: 12,
    visits: 30,
    signups: 3,
    customers: 2,
    orderGroups: 2,
    grossAmount: "38400.00",
    discountAmount: "1920.00",
    redemptions: 2,
  },
  {
    agentCode: "AGT0107",
    agentName: "วรรณา ตัวแทน",
    visitors: 7,
    visits: 9,
    signups: 1,
    customers: 0,
    orderGroups: 0,
    grossAmount: "0.00",
    discountAmount: "0.00",
    redemptions: 0,
  },
];
