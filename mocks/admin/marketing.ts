/**
 * Marketing, mocked (CONTRACT-REQUEST admin.campaigns, admin.promotions, admin.coupons,
 * admin.referrals): campaigns with budgets (D-154), promotions with typed conditions and
 * benefits (D-053), coupon batches and codes, and referral attributions held for review (D-136).
 *
 * The promotion engine is the API's: this mock only stores configuration and reports usage.
 * The budget alert threshold comes from the setting `campaigns.budget_alert_pct`; a held referral
 * opens a `referral_review` approval, and deciding it in the approvals engine moves the referral.
 */

import type { z } from "zod";

import type {
  campaignDetail,
  couponBatch,
  couponCode,
  promotionBenefit,
  promotionConditions,
  promotionDetail,
} from "@/lib/api/requests/admin-marketing";
import type { Schemas } from "@/lib/api/types";

import { http, HttpResponse } from "msw";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS, type StaffPersona } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, matchesQuery, mockId, paginate, problem } from "../support";
import { baht, customers } from "./commerce";
import { registerQueue } from "./console";
import { onApprovalDecided, openApproval, settingValue } from "./platform";
import { etagOf } from "./tables";

type Campaign = z.output<typeof campaignDetail>;
type Promotion = z.output<typeof promotionDetail>;
type Batch = z.output<typeof couponBatch>;
type Code = z.output<typeof couponCode>;
/** A referral as the fixture keeps it; `toReferralDto` is what the API answers (`AdminReferralDto`). */
interface Referral {
  id: string;
  referrer: ReturnType<typeof customerRef>;
  referee: ReturnType<typeof customerRef>;
  referralCode: string;
  attributedAt: string;
  firstOrder: { id: string; orderCode: string; grossAmount: string; claimWindowEndsAt: string | null } | null;
  status: Schemas["ReferralStatus"];
  fraudFlags: string[];
  approvalRequestId: string | null;
  rewardPoints: number | null;
}

const DAY = 24 * 60;
const MARKETER = PERSONAS.find((persona) => persona.key === "marketing")!;
const owner = { id: MARKETER.id, displayName: MARKETER.displayName };
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const customerRef = (index: number) => {
  const customer = customers[index]!;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    displayName: customer.displayName,
    companyName: customer.companyName,
  };
};

/** Marketing reads with `marketing.read` and writes with `marketing.manage`. */
function allowed(request: Request, manage = false): StaffPersona | Response {
  const who = staffPersonaOf(request);
  if (!who || !can(who, manage ? "promotions.manage" : "promotions.read")) return forbidden();
  return who;
}

/** An editable aggregate's weak ETag; the concurrency guard of api-conventions §3. */
function guard(request: Request, row: { id: string; updatedAt: string }, what: string): Response | null {
  const match = request.headers.get("if-match");
  if (!match) return problem(428, "http.precondition_required", "ต้องส่ง If-Match");
  if (match !== etagOf(row as never))
    return problem(412, "http.precondition_failed", `${what}ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่`);
  return null;
}

/* -------------------------------------------------------------------------------- campaigns */

type CampaignRow = Campaign & { updatedAt: string };

const alertPct = () => settingValue<string>("campaigns.budget_alert_pct");

function campaign(
  n: number,
  code: string,
  name: string,
  status: Campaign["status"],
  budget: number,
  spent: number,
  window: [number, number],
  goals: string | null,
): CampaignRow {
  return {
    id: mockId("cmp", n),
    code,
    name,
    status,
    startsAt: bangkokIso(window[0] * DAY),
    endsAt: bangkokIso(window[1] * DAY),
    budgetAmount: baht(budget * 100),
    spentAmount: baht(spent * 100),
    spentPct: "0",
    alertThresholdPct: "80",
    alertedAt: null,
    owner,
    promotionsCount: 0,
    createdAt: bangkokIso((window[0] - 7) * DAY),
    goals,
    performance: {
      redemptionsCount: 0,
      ordersCount: 0,
      discountAmount: "0.00",
      revenueAmount: "0.00",
      newCustomersCount: 0,
    },
    allowedActions: [],
    updatedAt: bangkokIso(-DAY),
  };
}

const campaigns: CampaignRow[] = [
  campaign(
    1,
    "YEAR-END-2026",
    "ส่งท้ายปี 2569 (ข้อมูลจำลอง)",
    "active",
    150000,
    126300,
    [-20, 40],
    "ลูกค้าใหม่ 300 ราย",
  ),
  campaign(2, "SME-BOOST", "เพิ่มยอด SME ไตรมาส 4 (ข้อมูลจำลอง)", "active", 80000, 21450, [-10, 60], null),
  campaign(3, "NEW-YEAR-2027", "ปีใหม่ 2570 (ข้อมูลจำลอง)", "scheduled", 120000, 0, [45, 80], "เปิดตัวกล่องของขวัญ"),
  campaign(4, "RAINY-2026", "หน้าฝน 2569 (ข้อมูลจำลอง)", "exhausted", 50000, 50000, [-120, -60], null),
  campaign(5, "SPRING-DRAFT", "ร่างแคมเปญหน้าร้อน (ข้อมูลจำลอง)", "draft", 60000, 0, [150, 200], null),
];

const CAMPAIGN_ACTIONS: Record<Campaign["status"], Campaign["allowedActions"]> = {
  draft: ["activate"],
  scheduled: ["pause", "end"],
  active: ["pause", "end"],
  paused: ["resume", "end"],
  exhausted: ["end"],
  ended: [],
};

/** The campaign as the API reports it: spend, the alert threshold in force, performance. */
function present(row: CampaignRow, who: StaffPersona | null): CampaignRow {
  const threshold = alertPct();
  const spentPct = Number(row.budgetAmount) > 0 ? (Number(row.spentAmount) / Number(row.budgetAmount)) * 100 : 0;
  // The API stamps the alert when spend first crosses the threshold (D-154); the mock does so on read.
  if (!row.alertedAt && spentPct >= Number(threshold)) row.alertedAt = bangkokIso(-60 * 5);
  const mine = promotions.filter((item) => item.campaign?.id === row.id);
  const redemptions = mine.reduce((sum, item) => sum + item.usage.redemptionsCount, 0);
  return {
    ...row,
    spentPct: spentPct.toFixed(4),
    alertThresholdPct: threshold,
    promotionsCount: mine.length,
    performance: {
      redemptionsCount: redemptions,
      ordersCount: redemptions,
      discountAmount: row.spentAmount,
      revenueAmount: baht(Number(row.spentAmount) * 100 * 9.4),
      newCustomersCount: Math.round(redemptions * 0.4),
    },
    allowedActions: who && can(who, "promotions.manage") ? CAMPAIGN_ACTIONS[row.status] : [],
  };
}

/* ------------------------------------------------------------------------------- promotions */

type PromotionRow = Promotion & { updatedAt: string };

const anyConditions = (extra: Partial<z.output<typeof promotionConditions>> = {}) => ({
  schemaVersion: 1 as const,
  channels: [],
  segments: [],
  productTypeCodes: [],
  minOrderValue: null,
  minQuantity: null,
  firstOrderOnly: false,
  paymentMethods: [],
  provinceIds: [],
  ...extra,
});
const benefitOf = (extra: Partial<z.output<typeof promotionBenefit>> & { type: Promotion["benefit"]["type"] }) => ({
  schemaVersion: 1 as const,
  pct: null,
  amount: null,
  maxAmount: null,
  tiers: [],
  rounds: null,
  multiplier: null,
  points: null,
  ...extra,
});

/** The one line the API writes from a benefit (in Thai, the mock's default language). */
function summarise(benefit: Promotion["benefit"]): string {
  switch (benefit.type) {
    case "percent":
      return `ลด ${Number(benefit.pct)} %${benefit.maxAmount ? ` สูงสุด ฿${Number(benefit.maxAmount).toLocaleString("en-US")}` : ""}`;
    case "fixed":
      return `ลด ฿${Number(benefit.amount).toLocaleString("en-US")}`;
    case "tiered_percent":
      return benefit.tiers
        .map((tier) => `ซื้อครบ ฿${Number(tier.minOrderValue).toLocaleString("en-US")} ลด ${Number(tier.pct)} %`)
        .join(" · ");
    case "free_shipping":
      return "ส่งฟรี";
    case "free_design_rounds":
      return `แก้แบบฟรีเพิ่ม ${benefit.rounds} รอบ`;
    case "free_mockup":
      return "ม็อกอัปฟรี";
    case "points_multiplier":
      return `แต้ม × ${Number(benefit.multiplier)}`;
    case "bonus_points":
      return `แต้มพิเศษ ${benefit.points} แต้ม`;
  }
}

function promotion(
  n: number,
  name: string,
  kind: Promotion["kind"],
  status: Promotion["status"],
  campaignIndex: number | null,
  conditions: Promotion["conditions"],
  benefit: Promotion["benefit"],
  usage: [number, number, number],
  limits: { total?: number; perCustomer?: number } = {},
): PromotionRow {
  const parent = campaignIndex === null ? null : campaigns[campaignIndex]!;
  return {
    id: mockId("prm", n),
    name,
    kind,
    status,
    campaign: parent ? { id: parent.id, code: parent.code, name: parent.name } : null,
    priority: n * 10,
    stacking: kind === "automatic" ? "best_of" : "exclusive",
    stackGroup: null,
    startsAt: parent?.startsAt ?? bangkokIso(-30 * DAY),
    endsAt: parent?.endsAt ?? null,
    benefitSummary: summarise(benefit),
    usage: { redemptionsCount: usage[0], discountAmount: baht(usage[1] * 100), cappedAmount: baht(usage[2] * 100) },
    conditions,
    benefit,
    usageLimitTotal: limits.total ?? null,
    usageLimitPerCustomer: limits.perCustomer ?? null,
    budgetAmount: null,
    allowedActions: [],
    updatedAt: bangkokIso(-2 * DAY),
  };
}

const promotions: PromotionRow[] = [
  promotion(
    1,
    "ลูกค้าใหม่ลด 10 % (ข้อมูลจำลอง)",
    "coupon",
    "active",
    0,
    anyConditions({ segments: ["new"], firstOrderOnly: true, channels: ["web"] }),
    benefitOf({ type: "percent", pct: "10", maxAmount: "500.00" }),
    [212, 84600, 1240],
    { perCustomer: 1 },
  ),
  promotion(
    2,
    "ส่งฟรีเมื่อซื้อครบ ฿5,000 (ข้อมูลจำลอง)",
    "automatic",
    "active",
    0,
    anyConditions({ minOrderValue: "5000.00" }),
    benefitOf({ type: "free_shipping" }),
    [318, 41700, 0],
  ),
  promotion(
    3,
    "ซื้อมากลดมาก (ข้อมูลจำลอง)",
    "automatic",
    "active",
    1,
    anyConditions({ productTypeCodes: ["folding_carton", "corrugated"] }),
    benefitOf({
      type: "tiered_percent",
      tiers: [
        { minOrderValue: "20000.00", pct: "3" },
        { minOrderValue: "50000.00", pct: "5" },
      ],
    }),
    [41, 21450, 3100],
  ),
  promotion(
    4,
    "โค้ดงานแสดงสินค้า (ข้อมูลจำลอง)",
    "coupon",
    "active",
    1,
    anyConditions({ channels: ["web", "cs"] }),
    benefitOf({ type: "fixed", amount: "300.00" }),
    [0, 0, 0],
    { total: 500, perCustomer: 1 },
  ),
  promotion(
    5,
    "ส่วนลดเพื่อนแนะนำ (ข้อมูลจำลอง)",
    "referral",
    "active",
    null,
    anyConditions({ firstOrderOnly: true }),
    benefitOf({ type: "percent", pct: "5", maxAmount: "500.00" }),
    [37, 14800, 0],
  ),
  promotion(
    6,
    "แต้มสองเท่าวันเกิด (ข้อมูลจำลอง)",
    "automatic",
    "paused",
    null,
    anyConditions(),
    benefitOf({ type: "points_multiplier", multiplier: "2" }),
    [12, 0, 0],
  ),
  promotion(
    7,
    "ปีใหม่ออกแบบฟรี (ข้อมูลจำลอง)",
    "coupon",
    "draft",
    2,
    anyConditions({ productTypeCodes: ["rigid_box"] }),
    benefitOf({ type: "free_design_rounds", rounds: 2 }),
    [0, 0, 0],
  ),
];

const PROMOTION_ACTIONS: Record<Promotion["status"], Promotion["allowedActions"]> = {
  draft: ["activate"],
  active: ["pause", "end"],
  paused: ["resume", "end"],
  ended: [],
};

const presentPromotion = (row: PromotionRow, who: StaffPersona | null): Promotion => ({
  ...row,
  benefitSummary: summarise(row.benefit),
  allowedActions: who && can(who, "promotions.manage") ? PROMOTION_ACTIONS[row.status] : [],
});
const summaryOf = (row: PromotionRow) => {
  const {
    stackGroup,
    conditions,
    benefit,
    usageLimitTotal,
    usageLimitPerCustomer,
    budgetAmount,
    allowedActions,
    ...rest
  } = presentPromotion(row, null);
  void [stackGroup, conditions, benefit, usageLimitTotal, usageLimitPerCustomer, budgetAmount, allowedActions];
  return rest;
};

/* ---------------------------------------------------------------------------------- coupons */

const batches: Batch[] = [
  {
    id: mockId("cpb", 1),
    promotionId: promotions[0]!.id,
    kind: "single",
    count: 1,
    prefix: null,
    usageLimitPerCode: null,
    generatedAt: bangkokIso(-25 * DAY),
    generatedBy: owner,
  },
  {
    id: mockId("cpb", 2),
    promotionId: promotions[3]!.id,
    kind: "bulk_unique",
    count: 6,
    prefix: "FAIR",
    usageLimitPerCode: 1,
    generatedAt: bangkokIso(-5 * DAY),
    generatedBy: owner,
  },
];
const codes: Code[] = [
  {
    id: mockId("cpc", 1),
    code: "WELCOME10",
    batchId: batches[0]!.id,
    assignedCustomer: null,
    usageLimit: null,
    usedCount: 212,
    status: "active",
  },
  ...["7K2Q", "9MXD", "3HTB", "P4VW", "Z8RN", "C6LJ"].map((tail, index): Code => ({
    id: mockId("cpc", 10 + index),
    code: `FAIR${tail}`,
    batchId: batches[1]!.id,
    assignedCustomer: null,
    usageLimit: 1,
    usedCount: index === 0 ? 1 : 0,
    status: index === 0 ? "used_up" : "active",
  })),
];
const codeOwner = new Map<string, string>(
  codes.map((item) => [item.id, batches.find((b) => b.id === item.batchId)!.promotionId]),
);
let codeSeq = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomTail = (seed: number) =>
  Array.from({ length: 6 }, (_, index) => ALPHABET[(seed * 7919 + index * 104729) % ALPHABET.length]).join("");

/* -------------------------------------------------------------------------------- referrals */

const REFERRER_POINTS = 200; // referral.rules referrerRewardBaht ÷ loyalty.point_value, rounded down (D-131)

const referrals: Referral[] = [
  [0, 3, "rewarded", []],
  [1, 4, "qualified", []],
  [2, 5, "under_review", ["phone_match"]],
  [2, 6, "under_review", ["address_match", "device_match"]],
  [7, 8, "pending", []],
  [9, 10, "rejected_fraud", ["card_match"]],
].map(([from, to, status, flags], index) => ({
  id: mockId("ref", index + 1),
  referrer: customerRef(from as number),
  referee: customerRef(to as number),
  referralCode: customers[from as number]!.referralCode,
  attributedAt: bangkokIso(-(40 - index * 5) * DAY),
  firstOrder:
    status === "pending"
      ? null
      : {
          id: mockId("ord", 900 + index),
          orderCode: `PK2569${String(1200 + index).padStart(6, "0")}`,
          grossAmount: baht((8000 + index * 3150) * 100),
          claimWindowEndsAt: bangkokIso(-(3 - index) * DAY),
        },
  status: status as Referral["status"],
  fraudFlags: flags as string[],
  approvalRequestId: null,
  rewardPoints: status === "rewarded" || status === "qualified" || status === "under_review" ? REFERRER_POINTS : null,
}));

function toReferralDto(item: Referral): Schemas["AdminReferralDto"] {
  const settled = item.status === "rewarded" || item.status === "rejected_fraud";
  return {
    id: item.id,
    code: item.referralCode,
    referrer: { id: item.referrer.id, displayName: item.referrer.displayName },
    referee: { id: item.referee.id, displayName: item.referee.displayName },
    attributedAt: item.attributedAt,
    firstOrderGroupId: item.firstOrder ? mockId("grp", 900 + referrals.indexOf(item)) : null,
    firstOrderGroupCode: item.firstOrder?.orderCode.replace(/^PK/, "PG") ?? null,
    status: item.status,
    fraudFlags: item.fraudFlags,
    approvalId: item.approvalRequestId,
    qualifiedAt: item.status === "pending" ? null : item.attributedAt,
    rewardedAt: item.status === "rewarded" ? item.attributedAt : null,
    decidedAt: settled ? item.attributedAt : null,
  };
}

/** Held referrals wait on Marketing in the approvals engine (policy `referral_review`, D-136). */
for (const item of referrals.filter((candidate) => candidate.status === "under_review")) {
  item.approvalRequestId = openApproval({
    policy: "referral_review",
    subjectType: "referral_attribution",
    subjectId: item.id,
    requester: PERSONAS.find((persona) => persona.key === "superadmin")!,
    payload: {
      referrer: `${item.referrer.customerCode} ${item.referrer.displayName}`,
      referee: `${item.referee.customerCode} ${item.referee.displayName}`,
      flags: item.fraudFlags.join(", "),
      firstOrder: item.firstOrder?.orderCode ?? null,
      rewardPoints: item.rewardPoints,
    },
  }).id;
}
onApprovalDecided("referral_review", (approval, outcome) => {
  const item = referrals.find((candidate) => candidate.id === approval.subjectId);
  if (item) item.status = outcome === "approved" ? "rewarded" : "rejected_fraud";
});

registerQueue("promotions.read", () => {
  const held = referrals.filter((item) => item.status === "under_review");
  return {
    key: "marketing.referral_review",
    path: "/admin/marketing/referrals?status=under_review",
    count: held.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});
registerQueue("promotions.read", () => {
  const alerted = campaigns.filter(
    (row) => ["active", "scheduled"].includes(row.status) && Number(present(row, null).spentPct) >= Number(alertPct()),
  );
  return {
    key: "marketing.budget_alerts",
    path: "/admin/marketing",
    count: alerted.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* --------------------------------------------------------------------------------- handlers */

const withEtag = <T extends { id: string; updatedAt: string }>(row: T, body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ETag: etagOf(row as never) },
  });

export const marketingHandlers = [
  mockRequest("GET /v1/admin/campaigns", ({ query, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    const rows = campaigns
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => matchesQuery(query.q, row.code, row.name))
      .map((row) => {
        const { goals, performance, allowedActions, updatedAt, ...summary } = present(row, who);
        void [goals, performance, allowedActions, updatedAt];
        return summary;
      });
    return paginate(rows, query);
  }),
  mockRequest("POST /v1/admin/campaigns", ({ body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    if (campaigns.some((row) => row.code === body.code))
      return problem(409, "campaign.duplicate_code", "มีแคมเปญรหัสนี้แล้ว", [
        { path: "code", code: "unique", message: "ซ้ำกับที่มีอยู่" },
      ]);
    if (Date.parse(body.endsAt) <= Date.parse(body.startsAt))
      return problem(422, "validation.failed", "วันสิ้นสุดต้องหลังวันเริ่ม", [
        { path: "endsAt", code: "after", message: "ต้องหลังวันเริ่ม" },
      ]);
    const row = campaign(campaigns.length + 1, body.code, body.name, "draft", 0, 0, [0, 0], body.goals ?? null);
    Object.assign(row, {
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      budgetAmount: body.budgetAmount,
      owner: { id: who.id, displayName: who.displayName },
      createdAt: bangkokIso(),
      updatedAt: bangkokIso(),
    });
    campaigns.unshift(row);
    return present(row, who);
  }),
  mockRequest("GET /v1/admin/campaigns/{campaignId}", ({ params, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    return row ? withEtag(row, present(row, who)) : problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
  }),
  mockRequest("PATCH /v1/admin/campaigns/{campaignId}", ({ params, body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    const refused = guard(request, row, "แคมเปญ");
    if (refused) return refused;
    if (body.budgetAmount && Number(body.budgetAmount) < Number(row.spentAmount))
      return problem(422, "campaign.budget_below_spent", "งบต้องไม่น้อยกว่าที่ใช้ไปแล้ว", [
        { path: "budgetAmount", code: "min", message: "น้อยกว่ายอดที่ใช้ไป" },
      ]);
    Object.assign(row, body, { updatedAt: bangkokIso() });
    // A topped-up budget brings an exhausted campaign back (D-154).
    if (row.status === "exhausted" && Number(row.budgetAmount) > Number(row.spentAmount)) row.status = "active";
    return withEtag(row, present(row, who));
  }),
  mockRequest("POST /v1/admin/campaigns/{campaignId}/actions/{action}", ({ params, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    const refused = guard(request, row, "แคมเปญ");
    if (refused) return refused;
    const action = params.action as Campaign["allowedActions"][number];
    if (!CAMPAIGN_ACTIONS[row.status].includes(action))
      return problem(409, "campaign.invalid_transition", "ทำรายการนี้กับแคมเปญในสถานะนี้ไม่ได้");
    row.status =
      action === "activate"
        ? Date.parse(row.startsAt) > Date.now()
          ? "scheduled"
          : "active"
        : action === "pause"
          ? "paused"
          : action === "resume"
            ? "active"
            : "ended";
    if (row.status === "ended")
      for (const item of promotions.filter((candidate) => candidate.campaign?.id === row.id)) item.status = "ended";
    row.updatedAt = bangkokIso();
    return withEtag(row, present(row, who));
  }),

  mockRequest("GET /v1/admin/promotions", ({ query, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    const rows = promotions
      .filter((row) => !query.kind || row.kind === query.kind)
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.campaignId || row.campaign?.id === query.campaignId)
      .filter((row) => matchesQuery(query.q, row.name, row.campaign?.code))
      .sort((a, b) => a.priority - b.priority)
      .map(summaryOf);
    return paginate(rows, query);
  }),
  mockRequest("POST /v1/admin/promotions", ({ body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const parent = body.campaignId ? campaigns.find((row) => row.id === body.campaignId) : null;
    if (body.campaignId && !parent)
      return problem(422, "validation.failed", "ไม่พบแคมเปญ", [
        { path: "campaignId", code: "exists", message: "ไม่พบแคมเปญ" },
      ]);
    const row: PromotionRow = {
      ...promotion(
        promotions.length + 1,
        body.name,
        body.kind,
        "draft",
        null,
        body.conditions,
        body.benefit,
        [0, 0, 0],
      ),
      ...body,
      campaign: parent ? { id: parent.id, code: parent.code, name: parent.name } : null,
      priority: Math.max(0, ...promotions.map((item) => item.priority)) + 10,
      updatedAt: bangkokIso(),
    };
    promotions.push(row);
    return presentPromotion(row, who);
  }),
  mockRequest("GET /v1/admin/promotions/{promotionId}", ({ params, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    const row = promotions.find((candidate) => candidate.id === params.promotionId);
    return row ? withEtag(row, presentPromotion(row, who)) : problem(404, "http.not_found", "ไม่พบโปรโมชันนี้");
  }),
  mockRequest("PATCH /v1/admin/promotions/{promotionId}", ({ params, body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const row = promotions.find((candidate) => candidate.id === params.promotionId);
    if (!row) return problem(404, "http.not_found", "ไม่พบโปรโมชันนี้");
    const refused = guard(request, row, "โปรโมชัน");
    if (refused) return refused;
    if (body.benefit && row.usage.redemptionsCount > 0 && JSON.stringify(body.benefit) !== JSON.stringify(row.benefit))
      return problem(
        409,
        "promotion.benefit_locked",
        "โปรโมชันนี้มีการใช้แล้ว เปลี่ยนสิทธิประโยชน์ไม่ได้ ให้สร้างโปรโมชันใหม่",
      );
    const parent = body.campaignId === undefined ? undefined : campaigns.find((item) => item.id === body.campaignId);
    Object.assign(row, body, {
      ...(body.campaignId !== undefined
        ? { campaign: parent ? { id: parent.id, code: parent.code, name: parent.name } : null }
        : {}),
      updatedAt: bangkokIso(),
    });
    return withEtag(row, presentPromotion(row, who));
  }),
  mockRequest("POST /v1/admin/promotions/{promotionId}/actions/{action}", ({ params, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const row = promotions.find((candidate) => candidate.id === params.promotionId);
    if (!row) return problem(404, "http.not_found", "ไม่พบโปรโมชันนี้");
    const refused = guard(request, row, "โปรโมชัน");
    if (refused) return refused;
    const action = params.action as Promotion["allowedActions"][number];
    if (!PROMOTION_ACTIONS[row.status].includes(action))
      return problem(409, "promotion.invalid_transition", "ทำรายการนี้กับโปรโมชันในสถานะนี้ไม่ได้");
    if (action === "activate" && row.kind === "coupon" && !codes.some((code) => codeOwner.get(code.id) === row.id))
      return problem(409, "promotion.no_codes", "สร้างโค้ดก่อนเปิดใช้โปรโมชันแบบโค้ด");
    row.status = action === "pause" ? "paused" : action === "end" ? "ended" : "active";
    row.updatedAt = bangkokIso();
    return withEtag(row, presentPromotion(row, who));
  }),
  mockRequest("PUT /v1/admin/promotions/priority", ({ body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    body.promotionIds.forEach((id, index) => {
      const row = promotions.find((candidate) => candidate.id === id);
      if (row) {
        row.priority = (index + 1) * 10;
        row.updatedAt = bangkokIso();
      }
    });
    return { updated: body.promotionIds.length };
  }),

  mockRequest("GET /v1/admin/promotions/{promotionId}/coupon-batches", ({ params, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    return batches.filter((batch) => batch.promotionId === params.promotionId);
  }),
  mockRequest("POST /v1/admin/promotions/{promotionId}/coupon-batches", ({ params, body, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const row = promotions.find((candidate) => candidate.id === params.promotionId);
    if (!row) return problem(404, "http.not_found", "ไม่พบโปรโมชันนี้");
    if (row.kind !== "coupon") return problem(409, "promotion.not_coupon", "โปรโมชันนี้ไม่ได้ใช้โค้ด");
    if (body.kind === "single" && !body.code)
      return problem(422, "validation.failed", "กรุณาระบุโค้ด", [
        { path: "code", code: "required", message: "จำเป็น" },
      ]);
    if (body.kind === "single" && codes.some((item) => item.code === body.code))
      return problem(409, "coupon.duplicate_code", "มีโค้ดนี้แล้ว", [{ path: "code", code: "unique", message: "ซ้ำ" }]);
    const count = body.kind === "single" ? 1 : (body.count ?? 0);
    if (count < 1)
      return problem(422, "validation.failed", "กรุณาระบุจำนวน", [
        { path: "count", code: "min", message: "อย่างน้อย 1" },
      ]);
    const batch: Batch = {
      id: mockId("cpb", 10 + batches.length),
      promotionId: row.id,
      kind: body.kind,
      count,
      prefix: body.prefix ?? null,
      usageLimitPerCode: body.usageLimitPerCode ?? (body.kind === "bulk_unique" ? 1 : null),
      generatedAt: bangkokIso(),
      generatedBy: { id: who.id, displayName: who.displayName },
    };
    batches.push(batch);
    for (let index = 0; index < count; index += 1) {
      const code: Code = {
        id: mockId("cpc", codeSeq++),
        code: body.kind === "single" ? body.code! : `${body.prefix ?? ""}${randomTail(codeSeq)}`,
        batchId: batch.id,
        assignedCustomer: null,
        usageLimit: batch.usageLimitPerCode,
        usedCount: 0,
        status: "active",
      };
      codes.push(code);
      codeOwner.set(code.id, row.id);
    }
    return batch;
  }),
  mockRequest("GET /v1/admin/promotions/{promotionId}/coupon-codes", ({ params, query, request }) => {
    const who = allowed(request);
    if (who instanceof Response) return who;
    const rows = codes
      .filter((code) => codeOwner.get(code.id) === params.promotionId)
      .filter((code) => !query.batchId || code.batchId === query.batchId)
      .filter((code) => !query.status || code.status === query.status)
      .filter((code) => matchesQuery(query.q, code.code));
    return paginate(rows, query);
  }),
  mockRequest("POST /v1/admin/coupon-codes/{codeId}/actions/disable", ({ params, request }) => {
    const who = allowed(request, true);
    if (who instanceof Response) return who;
    const code = codes.find((candidate) => candidate.id === params.codeId);
    if (!code) return problem(404, "http.not_found", "ไม่พบโค้ดนี้");
    if (code.status === "disabled") return problem(409, "coupon.already_disabled", "โค้ดนี้ถูกปิดไปแล้ว");
    code.status = "disabled";
    return code;
  }),

  // admin.referrals.list (U-F0.3): no referrerId filter, the first order as its group.
  http.get("*/v1/admin/referrals", ({ request }) => {
    const who = staffPersonaOf(request);
    if (!who || !can(who, "promotions.read")) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = referrals
      .filter((item) => !status || item.status === status)
      .filter((item) => matchesQuery(q, item.referralCode, item.referrer.displayName, item.referee.displayName))
      .map(toReferralDto);
    return HttpResponse.json(
      paginate(rows, {
        page: Number(url.searchParams.get("page") ?? 1),
        perPage: Number(url.searchParams.get("perPage") ?? 25),
      }),
    );
  }),
];
