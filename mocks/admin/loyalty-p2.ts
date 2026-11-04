/**
 * Loyalty P2 (API-CHANGES-P2, Admin): loyalty analytics, campaigns, the audience estimate, agent performance, survey
 * templates and results, and showcase consents. Every handler is a contract request (`mockRequest`), validated against
 * `src/lib/api/requests/admin-loyalty-p2.ts`. All figures are fake and only consistent with themselves (the opening
 * and closing balances chain; the liability is the API sample's).
 */

import { HttpResponse } from "msw";

import type { LoyaltyAnalytics, SurveyResults, SurveyTemplate } from "@/lib/api/requests/admin-loyalty-p2";

import { mockRequest } from "../route";
import { bangkokIso, mockId, problem } from "../support";

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

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
        { programme: "survey", sent: 8, converted: null, ratePct: null, windowDays: 30 },
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
    responses: 96,
    updatedAt: bangkokIso(-30 * 24 * 60),
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
    responses: 0,
    updatedAt: bangkokIso(-2 * 24 * 60),
  },
];

function resultsOf(template: SurveyTemplate): SurveyResults {
  const few = template.responses < 10;
  return {
    templateId: template.id,
    completed: template.responses,
    opened: template.responses ? 210 : 0,
    completionPct: template.responseRatePct,
    countsOnly: few,
    questions: template.questions.map((question) => {
      const label = question.label.th;
      if (question.kind === "rating")
        return {
          key: question.key,
          kind: question.kind,
          label,
          answered: template.responses,
          average: few ? null : "4.31",
        };
      if (question.kind === "text")
        return {
          key: question.key,
          kind: question.kind,
          label,
          answered: few ? 0 : 31,
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
        answered: template.responses,
        options: (question.options ?? []).map((option, at) => ({
          key: option.key,
          label: option.label.th,
          count: counts[at] ?? 0,
        })),
      };
    }),
  };
}

export const loyaltyP2AdminHandlers = [
  // CONTRACT-REQUEST admin.loyalty.analytics
  mockRequest("GET /v1/admin/loyalty/analytics", ({ principal, query }) => {
    if (!principal) return unauthenticated();
    if (monthsBetween(query.from, query.to) < 0 || monthsBetween(query.from, query.to) > 23)
      return problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [
        { path: "to", code: "range", message: "ช่วงเดือนต้องไม่เกิน 24 เดือน" },
      ]);
    return loyaltyAnalyticsOf(query.from, query.to);
  }),
  // CONTRACT-REQUEST admin.loyalty.campaigns
  mockRequest("GET /v1/admin/loyalty/campaigns", ({ principal }) => {
    if (!principal) return unauthenticated();
    return {
      data: [
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
      ],
      meta: { page: 1, perPage: 20, total: 1 },
    };
  }),
  // CONTRACT-REQUEST admin.promotions.audience: a fake count from how narrow the audience is; null under 10
  mockRequest("GET /v1/admin/promotions/{promotionId}/audience-estimate", ({ principal, query }) => {
    if (!principal) return unauthenticated();
    let audience: Record<string, unknown> = {};
    try {
      audience = query.audience ? (JSON.parse(query.audience) as Record<string, unknown>) : {};
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
    const rounded = customers >= 100 ? Math.round(customers / 10) * 10 : customers;
    return { customers: rounded < 10 ? null : rounded, rounded: true };
  }),
  // CONTRACT-REQUEST admin.promotions.agent-performance
  mockRequest("GET /v1/admin/promotions/agent-performance", ({ principal }) => {
    if (!principal) return unauthenticated();
    return {
      data: AGENT_ROWS.map((row) => ({
        ...row,
        promotionId: mockId("prm", 1),
        promotionName: "กล่องลูกฟูก 1,000 ใบขึ้นไป ลด 10%",
      })),
      meta: { page: 1, perPage: 20, total: AGENT_ROWS.length },
    };
  }),
  // CONTRACT-REQUEST admin.surveys
  mockRequest("GET /v1/admin/surveys/templates", ({ principal }) =>
    principal ? { items: templates } : unauthenticated(),
  ),
  // CONTRACT-REQUEST admin.surveys
  mockRequest("POST /v1/admin/surveys/templates", ({ principal, body }) => {
    if (!principal) return unauthenticated();
    const created: SurveyTemplate = {
      ...body,
      id: mockId("svt", templates.length + 1),
      version: 1,
      status: "draft",
      responseRatePct: null,
      responses: 0,
      updatedAt: bangkokIso(),
    };
    templates.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  // CONTRACT-REQUEST admin.surveys
  mockRequest("GET /v1/admin/surveys/templates/{templateId}", ({ principal, params }) => {
    if (!principal) return unauthenticated();
    return templates.find((row) => row.id === params.templateId) ?? problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
  }),
  // CONTRACT-REQUEST admin.surveys: drafts only
  mockRequest("PATCH /v1/admin/surveys/templates/{templateId}", ({ principal, params, body }) => {
    if (!principal) return unauthenticated();
    const at = templates.findIndex((row) => row.id === params.templateId);
    if (at === -1) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    if (templates[at]!.status !== "draft")
      return problem(409, "surveys.template_published", "แบบสอบถามที่เผยแพร่แล้วแก้ไขไม่ได้ ให้สร้างฉบับใหม่");
    templates[at] = { ...templates[at]!, ...body, updatedAt: bangkokIso() };
    return templates[at]!;
  }),
  // CONTRACT-REQUEST admin.surveys: publish | retire | new-version; one published per trigger
  mockRequest("POST /v1/admin/surveys/templates/{templateId}/actions/{action}", ({ principal, params }) => {
    if (!principal) return unauthenticated();
    const row = templates.find((entry) => entry.id === params.templateId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
    if (params.action === "publish") {
      if (templates.some((entry) => entry.trigger === row.trigger && entry.status === "published" && entry !== row))
        return problem(409, "surveys.trigger_taken", "มีแบบสอบถามที่เผยแพร่สำหรับจังหวะนี้อยู่แล้ว");
      row.status = "published";
    } else if (params.action === "retire") row.status = "retired";
    else if (params.action === "new-version") {
      const next: SurveyTemplate = {
        ...row,
        id: mockId("svt", templates.length + 1),
        version: row.version + 1,
        status: "draft",
        responses: 0,
        responseRatePct: null,
      };
      templates.push(next);
      return next;
    } else return problem(404, "http.not_found", "ไม่พบการดำเนินการนี้");
    row.updatedAt = bangkokIso();
    return row;
  }),
  // CONTRACT-REQUEST admin.surveys
  mockRequest("GET /v1/admin/surveys/templates/{templateId}/results", ({ principal, params }) => {
    if (!principal) return unauthenticated();
    const row = templates.find((entry) => entry.id === params.templateId);
    return row ? resultsOf(row) : problem(404, "http.not_found", "ไม่พบแบบสอบถามนี้");
  }),
  // CONTRACT-REQUEST admin.showcase-consents
  mockRequest("GET /v1/admin/showcase-consents", ({ principal }) => {
    if (!principal) return unauthenticated();
    return {
      data: [
        {
          id: mockId("shc", 1),
          customer: { id: mockId("cus", 2), displayName: "คุณปรียา" },
          companyName: "บริษัท ตัวอย่าง จำกัด",
          scope: ["brand_name", "packaging_photos"],
          status: "approved" as const,
          consentTextVersion: "2026-11-v1",
          decidedAt: bangkokIso(-3 * 24 * 60),
          withdrawnAt: null,
        },
      ],
      meta: { page: 1, perPage: 20, total: 1 },
    };
  }),
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
