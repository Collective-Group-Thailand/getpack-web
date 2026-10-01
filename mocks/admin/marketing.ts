/**
 * Marketing on the published contract (`admin.campaigns.*`, `admin.promotions.*`, U-F0.3):
 * campaigns with budgets (D-154), promotions with typed conditions and benefits (D-053), their
 * coupon codes and their batches, the priority reorder and the promotion report; and referral
 * attributions held for review (D-136). Referral promotions are system-managed (409
 * `promotions.system_managed`), as packio-api answers.
 *
 * The promotion engine is the API's: this mock only stores configuration and reports usage.
 * The budget alert threshold comes from the setting `campaigns.budget_alert_pct`; a held referral
 * opens a `referral_review` approval, and deciding it in the approvals engine moves the referral.
 */

import type { Schemas } from "@/lib/api/types";

import { http, HttpResponse } from "msw";

import { staffPersonaOf } from "../auth";
import { can, PERSONAS } from "../personas";
import { bangkokIso, matchesQuery, mockId, paginate, precondition, problem, withEtag } from "../support";
import { baht, customers } from "./commerce";
import { registerQueue } from "./console";
import type { CampaignRow, CouponCodeRow, PromotionRow } from "./marketing-model";
import { onApprovalDecided, openApproval, settingValue } from "./platform";
import { etagOf as tableEtag } from "./tables";

/** A coupon batch as the fixture keeps it; `toCouponBatchDto` is what the API answers. */
interface Batch {
  id: string;
  promotionId: string;
  kind: Schemas["CouponKind"];
  count: number;
  prefix: string | null;
  usageLimitPerCode: number | null;
  generatedAt: string;
  generatedBy: { id: string; displayName: string } | null;
}
/** A referral as the fixture keeps it; `toReferralDto` is what the API answers (`AdminReferralDto`). */
interface Referral {
  id: string;
  referrer: ReturnType<typeof customerRef>;
  referee: ReturnType<typeof customerRef>;
  referralCode: string;
  attributedAt: string;
  firstOrder: { id: string; orderCode: string; grossAmount: string; claimWindowEndsAt: string | null } | null;
  status: Schemas["ReferralStatus"];
  fraudFlags: Schemas["ReferralFraudFlag"][];
  approvalRequestId: string | null;
  rewardPoints: number | null;
}

const DAY = 24 * 60;
const MARKETER = PERSONAS.find((persona) => persona.key === "marketing")!;
const owner = { id: MARKETER.id, displayName: MARKETER.displayName };
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const invalid = (path: string, message: string) =>
  problem(422, "validation.failed", message, [{ path, code: "invalid", message }]);
const customerRef = (index: number) => {
  const customer = customers[index]!;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    displayName: customer.displayName,
    companyName: customer.companyName,
  };
};

/** The operation's `x-required-permissions`: reads are `promotions.read`, writes name their own. */
function allowed(request: Request, permission: "promotions.read" | "promotions.manage" | "campaigns.manage") {
  const who = staffPersonaOf(request);
  return who && can(who, permission) ? who : null;
}

const pageOf = (url: URL) => ({
  page: Number(url.searchParams.get("page") ?? 1),
  perPage: Number(url.searchParams.get("perPage") ?? 25),
});
/** Sums decimal strings in satang, so the mock's report adds up exactly. */
const sum = (amounts: readonly string[]) =>
  baht(amounts.reduce((total, amount) => total + Math.round(Number(amount) * 100), 0));

/* -------------------------------------------------------------------------------- campaigns */

const alertPct = () => settingValue<string>("campaigns.budget_alert_pct");

function campaign(
  n: number,
  code: string,
  name: string,
  status: CampaignRow["status"],
  budget: number | null,
  spent: number,
  window: [number, number | null],
  goals: Record<string, unknown> = {},
): CampaignRow {
  return {
    id: mockId("cmp", n),
    code,
    name,
    status,
    startsAt: bangkokIso(window[0] * DAY),
    endsAt: window[1] === null ? null : bangkokIso(window[1] * DAY),
    budgetAmount: budget === null ? null : baht(budget * 100),
    spentAmount: baht(spent * 100),
    alertedAt: null,
    goals,
    owner,
    createdAt: bangkokIso((window[0] - 7) * DAY),
    updatedAt: bangkokIso(-DAY),
  };
}

const campaigns: CampaignRow[] = [
  campaign(1, "year-end-2026", "ส่งท้ายปี 2569 (ข้อมูลจำลอง)", "active", 150000, 126300, [-20, 40], {
    newCustomers: 300,
  }),
  campaign(2, "sme-boost", "เพิ่มยอด SME ไตรมาส 4 (ข้อมูลจำลอง)", "active", 80000, 21450, [-10, 60]),
  campaign(3, "new-year-2027", "ปีใหม่ 2570 (ข้อมูลจำลอง)", "scheduled", 120000, 0, [45, 80], {
    note: "เปิดตัวกล่องของขวัญ",
  }),
  campaign(4, "rainy-2026", "หน้าฝน 2569 (ข้อมูลจำลอง)", "exhausted", 50000, 50000, [-120, -60]),
  campaign(5, "spring-draft", "ร่างแคมเปญหน้าร้อน (ข้อมูลจำลอง)", "draft", 60000, 0, [150, 200]),
];

/** Spend has reached the alert threshold of the budget (D-154); an unlimited campaign never alerts. */
function crossed(row: CampaignRow): boolean {
  if (row.budgetAmount === null || Number(row.budgetAmount) <= 0) return false;
  return Number(row.spentAmount) * 100 >= Number(row.budgetAmount) * Number(alertPct());
}

function toCampaignDto(row: CampaignRow): Schemas["CampaignDto"] {
  // The API stamps the alert when spend first crosses the threshold (D-154); the mock does so on read.
  if (!row.alertedAt && crossed(row)) row.alertedAt = bangkokIso(-60 * 5);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    budgetAmount: row.budgetAmount,
    spentAmount: row.spentAmount,
    alertThresholdPct: Number(alertPct()).toFixed(4),
    alertedAt: row.alertedAt,
    // Spent as a share of the budget, as `crossed` reads it (D-154); none without a budget.
    spentPct:
      row.budgetAmount === null || Number(row.budgetAmount) <= 0
        ? null
        : ((Number(row.spentAmount) * 100) / Number(row.budgetAmount)).toFixed(2),
    goals: row.goals,
    promotionsCount: promotions.filter((promotion) => promotion.campaignId === row.id).length,
    owner: row.owner,
    createdAt: row.createdAt,
    currency: "THB",
  };
}

/** `activate | pause | end` (activate resumes a paused one); `null` when the status forbids it. */
function nextCampaignStatus(row: CampaignRow, action: string): CampaignRow["status"] | null {
  const upcoming = Date.parse(row.startsAt) > Date.now();
  if (action === "activate" && (row.status === "draft" || row.status === "paused"))
    return upcoming ? "scheduled" : "active";
  if (action === "pause" && (row.status === "active" || row.status === "scheduled")) return "paused";
  if (action === "end" && row.status !== "ended") return "ended";
  return null;
}

/* ------------------------------------------------------------------------------- promotions */

function promotion(
  n: number,
  name: string,
  kind: PromotionRow["kind"],
  status: PromotionRow["status"],
  campaignIndex: number | null,
  conditions: PromotionRow["conditions"],
  benefit: PromotionRow["benefit"],
  usage: [number, number, number],
  limits: { total?: number; perCustomer?: number } = {},
): PromotionRow {
  const parent = campaignIndex === null ? null : campaigns[campaignIndex]!;
  return {
    id: mockId("prm", n),
    name,
    description: null,
    kind,
    status,
    campaignId: parent?.id ?? null,
    priority: n * 10,
    stacking: kind === "automatic" ? "best_of" : "exclusive",
    stackGroup: null,
    startsAt: parent?.startsAt ?? bangkokIso(-30 * DAY),
    endsAt: parent?.endsAt ?? null,
    conditions,
    benefit,
    usageLimitTotal: limits.total ?? null,
    usageLimitPerCustomer: limits.perCustomer ?? null,
    budgetAmount: null,
    usage: { redemptions: usage[0], discountAmount: baht(usage[1] * 100), cappedAmount: baht(usage[2] * 100) },
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
    { segments: ["new"], firstOrderOnly: true, channels: ["web"] },
    { type: "percent", pct: "10", maxAmount: "500.00" },
    [212, 84600, 1240],
    { perCustomer: 1 },
  ),
  promotion(
    2,
    "ส่งฟรีเมื่อซื้อครบ ฿5,000 (ข้อมูลจำลอง)",
    "automatic",
    "active",
    0,
    { minOrderValue: "5000.00" },
    { type: "free_shipping" },
    [318, 41700, 0],
  ),
  promotion(
    3,
    "ซื้อมากลดมาก (ข้อมูลจำลอง)",
    "automatic",
    "active",
    1,
    { productTypeCodes: ["folding_carton", "corrugated"] },
    {
      type: "tiered",
      basis: "value",
      tiers: [
        { min: "20000.00", pct: "3" },
        { min: "50000.00", pct: "5" },
      ],
    },
    [41, 21450, 3100],
  ),
  promotion(
    4,
    "โค้ดงานแสดงสินค้า (ข้อมูลจำลอง)",
    "coupon",
    "active",
    1,
    { channels: ["web", "cs"] },
    { type: "fixed", amount: "300.00" },
    [0, 0, 0],
    { total: 500, perCustomer: 1 },
  ),
  promotion(
    5,
    "ส่วนลดเพื่อนแนะนำ (ข้อมูลจำลอง)",
    "referral",
    "active",
    null,
    { firstOrderOnly: true },
    { type: "percent", pct: "5", maxAmount: "500.00" },
    [37, 14800, 0],
  ),
  promotion(
    6,
    "แต้มสองเท่าวันเกิด (ข้อมูลจำลอง)",
    "automatic",
    "paused",
    null,
    {},
    { type: "points_multiplier", multiplier: "2" },
    [12, 0, 0],
  ),
  promotion(
    7,
    "ปีใหม่ออกแบบฟรี (ข้อมูลจำลอง)",
    "coupon",
    "draft",
    2,
    { productTypeCodes: ["rigid_box"] },
    { type: "free_revision_rounds", rounds: 2 },
    [0, 0, 0],
  ),
];

function toPromotionDto(row: PromotionRow): Schemas["PromotionDto"] {
  const campaign = campaigns.find((candidate) => candidate.id === row.campaignId);
  // The spend is the discount given: what the promotion's own budget is measured against.
  return {
    ...row,
    usage: { ...row.usage },
    spentAmount: row.usage.discountAmount,
    campaign: campaign ? { id: campaign.id, code: campaign.code, name: campaign.name } : null,
    benefitSummaryTh: benefitSummary(row.benefit).th,
    benefitSummaryEn: benefitSummary(row.benefit).en,
  };
}

/**
 * The benefit in words, Thai and English — packio-api's `benefit-summary.ts` at v0.6.0, so the
 * screens never word a benefit themselves. Amounts are the stored decimal strings.
 */
function benefitSummary(benefit: Schemas["PromotionBenefitDto"]): { th: string; en: string } {
  const cap = benefit.maxAmount ?? null;
  const capTh = cap ? ` สูงสุด ${cap} บาท` : "";
  const capEn = cap ? `, up to THB ${cap}` : "";
  switch (benefit.type) {
    case "percent":
      return { th: `ลด ${benefit.pct}%${capTh}`, en: `${benefit.pct}% off${capEn}` };
    case "fixed":
      return { th: `ลด ${benefit.amount} บาท`, en: `THB ${benefit.amount} off` };
    case "tiered": {
      const tiers = benefit.tiers ?? [];
      const byQty = benefit.basis === "quantity";
      const th = tiers
        .map(
          (t) =>
            `${byQty ? `${t.min} ชิ้นขึ้นไป` : `${t.min} บาทขึ้นไป`} ลด ${t.pct ? `${t.pct}%` : `${t.amount} บาท`}`,
        )
        .join(", ");
      const en = tiers
        .map(
          (t) => `${byQty ? `${t.min}+ pieces` : `THB ${t.min}+`}: ${t.pct ? `${t.pct}% off` : `THB ${t.amount} off`}`,
        )
        .join("; ");
      return { th: th + capTh, en: en + capEn };
    }
    case "unit_price_override":
      return { th: `ราคาพิเศษ ${benefit.unitPrice} บาท/ชิ้น`, en: `Special price THB ${benefit.unitPrice} per piece` };
    case "free_revision_rounds":
      return { th: `แก้แบบฟรี ${benefit.rounds} รอบ`, en: `${benefit.rounds} free revision rounds` };
    case "points_multiplier":
      return { th: `คะแนน x${benefit.multiplier}`, en: `${benefit.multiplier}× points` };
    case "bonus_points":
      return { th: `รับคะแนนพิเศษ ${benefit.points} คะแนน`, en: `${benefit.points} bonus points` };
    case "free_shipping":
      return { th: "ส่งฟรี", en: "Free shipping" };
    case "free_design":
      return { th: "ออกแบบฟรี", en: "Free design" };
    case "free_mockup":
      return { th: "ตัวอย่างฟรี", en: "Free mock-up" };
    default:
      return { th: "—", en: "—" };
  }
}

/** What a benefit of each type must carry, so a half-filled form is refused like the API would. */
function benefitProblem(benefit: Schemas["PromotionBenefitDto"] | undefined): Response | null {
  if (!benefit?.type) return invalid("benefit.type", "กรุณาเลือกสิทธิประโยชน์");
  const needs: Partial<Record<Schemas["PromotionBenefitType"], [keyof Schemas["PromotionBenefitDto"], string]>> = {
    percent: ["pct", "กรุณาระบุเปอร์เซ็นต์ส่วนลด"],
    fixed: ["amount", "กรุณาระบุจำนวนเงินส่วนลด"],
    unit_price_override: ["unitPrice", "กรุณาระบุราคาต่อชิ้น"],
    free_revision_rounds: ["rounds", "กรุณาระบุจำนวนรอบ"],
    points_multiplier: ["multiplier", "กรุณาระบุตัวคูณแต้ม"],
    bonus_points: ["points", "กรุณาระบุจำนวนแต้ม"],
  };
  const need = needs[benefit.type];
  if (need && (benefit[need[0]] === undefined || benefit[need[0]] === ""))
    return invalid(`benefit.${need[0]}`, need[1]);
  if (benefit.type === "tiered" && !benefit.tiers?.length) return invalid("benefit.tiers", "กรุณาระบุขั้นส่วนลด");
  return null;
}

function nextPromotionStatus(row: PromotionRow, action: string): PromotionRow["status"] | null {
  if (action === "activate" && (row.status === "draft" || row.status === "paused")) return "active";
  if (action === "pause" && row.status === "active") return "paused";
  if (action === "end" && row.status !== "ended") return "ended";
  return null;
}

/** The promotion report (`PromotionReportDto`) over some promotions: the mock's usage, summed. */
function reportOf(rows: readonly PromotionRow[]): Schemas["PromotionReportDto"] {
  const redemptions = rows.reduce((total, row) => total + row.usage.redemptions, 0);
  const discountSatang = rows.reduce((total, row) => total + Math.round(Number(row.usage.discountAmount) * 100), 0);
  return {
    redemptions,
    appliedRedemptions: redemptions,
    discountAmount: baht(discountSatang),
    cappedAmount: sum(rows.map((row) => row.usage.cappedAmount)),
    orderGroups: redemptions,
    grossAmount: baht(discountSatang * 9.4),
    customers: Math.round(redemptions * 0.9),
    currency: "THB",
  };
}

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
const codes: CouponCodeRow[] = [
  {
    id: mockId("cpc", 1),
    code: "WELCOME10",
    promotionId: promotions[0]!.id,
    batchId: batches[0]!.id,
    assignedCustomerId: null,
    usageLimit: null,
    usedCount: 212,
    status: "active",
  },
  ...["7K2Q", "9MXD", "3HTB", "P4VW", "Z8RN", "C6LJ"].map((tail, index): CouponCodeRow => ({
    id: mockId("cpc", 10 + index),
    code: `FAIR${tail}`,
    promotionId: promotions[3]!.id,
    batchId: batches[1]!.id,
    assignedCustomerId: null,
    usageLimit: 1,
    usedCount: index === 0 ? 1 : 0,
    status: index === 0 ? "used_up" : "active",
  })),
];
let codeSeq = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomTail = (seed: number) =>
  Array.from({ length: 6 }, (_, index) => ALPHABET[(seed * 7919 + index * 104729) % ALPHABET.length]).join("");

function toCouponCodeDto(row: CouponCodeRow): Schemas["CouponCodeDto"] {
  const assigned = customers.find((customer) => customer.id === row.assignedCustomerId);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    assignedCustomerId: row.assignedCustomerId,
    assignedCustomer: assigned ? { id: assigned.id, displayName: assigned.displayName } : null,
    batchId: row.batchId,
  };
}

/** Generated batches by `Idempotency-Key`, so a retried generate replays instead of making another. */
const generated = new Map<string, Schemas["CouponBatchResultDto"]>();

/* -------------------------------------------------------------------------------- referrals */

const REFERRER_POINTS = 200; // referral.rules referrerRewardBaht ÷ loyalty.point_value, rounded down (D-131)

const referrals: Referral[] = [
  [0, 3, "rewarded", []],
  [1, 4, "qualified", []],
  [2, 5, "under_review", ["phone_match"]],
  [2, 6, "under_review", ["address_match", "device_match"]],
  [7, 8, "pending", []],
  [9, 10, "rejected_fraud", ["card_token_match"]],
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
  fraudFlags: flags as Schemas["ReferralFraudFlag"][],
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
    firstOrderGrossAmount: item.firstOrder?.grossAmount ?? null,
    firstOrderClaimWindowEndsAt: item.firstOrder?.claimWindowEndsAt ?? null,
    rewardPoints: item.rewardPoints ?? 0,
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
  const alerted = campaigns.filter((row) => ["active", "scheduled"].includes(row.status) && crossed(row));
  return {
    key: "marketing.budget_alerts",
    path: "/admin/marketing",
    count: alerted.length,
    overdueCount: 0,
    nextDueAt: null,
  };
});

/* --------------------------------------------------------------------------------- handlers */

/** The weak ETag the table mocks use, from the row's id and last change. */
const etagOf = (row: { id: string; updatedAt: string }) => tableEtag(row as never);
const campaignOf = (id: unknown) => campaigns.find((row) => row.id === id);
const promotionOf = (id: unknown) => promotions.find((row) => row.id === id);
const noCampaign = () => problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
const noPromotion = () => problem(404, "http.not_found", "ไม่พบโปรโมชันนี้");
const systemManaged = () =>
  problem(409, "promotions.system_managed", "โปรโมชันชวนเพื่อนจัดการโดยระบบ แก้ไขหรือเปลี่ยนสถานะไม่ได้");
const touch = (row: { updatedAt: string }) => {
  // A new ETag on every change, even two within the same millisecond.
  row.updatedAt = new Date(Math.max(Date.now(), Date.parse(row.updatedAt) + 1)).toISOString();
};

/** `admin.campaigns.*` and `admin.promotions.*` on their published paths (U-F0.3). */
export const marketingContractHandlers = [
  http.get("*/v1/admin/campaigns", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q") ?? undefined;
    const rows = campaigns
      .filter((row) => !status || row.status === status)
      .filter((row) => matchesQuery(q, row.code, row.name))
      .map(toCampaignDto);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.post("*/v1/admin/campaigns", async ({ request }) => {
    const who = allowed(request, "campaigns.manage");
    if (!who) return forbidden();
    const body = (await request.json()) as Schemas["CreateCampaignDto"];
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(body.code ?? ""))
      return invalid("code", "รหัสแคมเปญเป็นตัวพิมพ์เล็ก ตัวเลข - หรือ _");
    if (campaigns.some((row) => row.code.toLowerCase() === body.code.toLowerCase()))
      return problem(409, "promotions.code_taken", "มีแคมเปญรหัสนี้แล้ว", [
        { path: "code", code: "unique", message: "ซ้ำกับที่มีอยู่" },
      ]);
    if (body.endsAt && Date.parse(body.endsAt) <= Date.parse(body.startsAt))
      return invalid("endsAt", "วันสิ้นสุดต้องหลังวันเริ่ม");
    const row: CampaignRow = {
      ...campaign(campaigns.length + 1, body.code, body.name, "draft", null, 0, [0, null], body.goals ?? {}),
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
      budgetAmount: body.budgetAmount ?? null,
      owner: { id: who.id, displayName: who.displayName },
      createdAt: bangkokIso(),
      updatedAt: new Date().toISOString(),
    };
    campaigns.unshift(row);
    return withEtag(toCampaignDto(row), etagOf(row), 201);
  }),
  http.get("*/v1/admin/campaigns/:campaignId", ({ params, request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = campaignOf(params.campaignId);
    return row ? withEtag(toCampaignDto(row), etagOf(row)) : noCampaign();
  }),
  http.patch("*/v1/admin/campaigns/:campaignId", async ({ params, request }) => {
    if (!allowed(request, "campaigns.manage")) return forbidden();
    const row = campaignOf(params.campaignId);
    if (!row) return noCampaign();
    const refused = precondition(request, etagOf(row));
    if (refused) return refused;
    if (row.status === "ended") return problem(409, "promotions.ended", "แคมเปญนี้สิ้นสุดแล้ว แก้ไขไม่ได้");
    const body = (await request.json()) as Schemas["UpdateCampaignDto"];
    if (body.budgetAmount && Number(body.budgetAmount) < Number(row.spentAmount))
      return invalid("budgetAmount", "งบต้องไม่น้อยกว่าที่ใช้ไปแล้ว");
    const next = { ...row, ...body };
    if (next.endsAt && Date.parse(next.endsAt) <= Date.parse(next.startsAt))
      return invalid("endsAt", "วันสิ้นสุดต้องหลังวันเริ่ม");
    if (body.name !== undefined) row.name = body.name;
    if (body.startsAt !== undefined) row.startsAt = body.startsAt;
    if (body.endsAt !== undefined) row.endsAt = body.endsAt;
    if (body.budgetAmount !== undefined) row.budgetAmount = body.budgetAmount;
    if (body.goals !== undefined) row.goals = body.goals;
    // A topped-up budget brings an exhausted campaign back (D-154), and re-arms its alert.
    if (row.status === "exhausted" && (row.budgetAmount === null || Number(row.budgetAmount) > Number(row.spentAmount)))
      row.status = "active";
    if (!crossed(row)) row.alertedAt = null;
    touch(row);
    return withEtag(toCampaignDto(row), etagOf(row));
  }),
  http.post("*/v1/admin/campaigns/:campaignId/actions/:action", ({ params, request }) => {
    if (!allowed(request, "campaigns.manage")) return forbidden();
    const row = campaignOf(params.campaignId);
    if (!row) return noCampaign();
    const next = nextCampaignStatus(row, String(params.action));
    if (!next) return problem(409, "promotions.invalid_transition", "ทำรายการนี้กับแคมเปญในสถานะนี้ไม่ได้");
    row.status = next;
    // Ending a campaign ends its promotions (D-154).
    if (next === "ended")
      for (const item of promotions.filter((candidate) => candidate.campaignId === row.id)) {
        item.status = "ended";
        touch(item);
      }
    touch(row);
    return withEtag(toCampaignDto(row), etagOf(row));
  }),

  http.get("*/v1/admin/promotions", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const url = new URL(request.url);
    const [kind, status, campaignId] = ["kind", "status", "campaignId"].map((name) => url.searchParams.get(name));
    const q = url.searchParams.get("q") ?? undefined;
    const rows = promotions
      .filter((row) => !kind || row.kind === kind)
      .filter((row) => !status || row.status === status)
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .filter((row) => matchesQuery(q, row.name, campaignOf(row.campaignId)?.code))
      .sort((a, b) => a.priority - b.priority)
      .map(toPromotionDto);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.post("*/v1/admin/promotions", async ({ request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const body = (await request.json()) as Schemas["CreatePromotionDto"];
    if (!body.name?.trim()) return invalid("name", "กรุณาระบุชื่อโปรโมชัน");
    if (!Number.isInteger(body.priority)) return invalid("priority", "กรุณาระบุลำดับเป็นจำนวนเต็ม");
    if (body.campaignId && !campaignOf(body.campaignId)) return invalid("campaignId", "ไม่พบแคมเปญ");
    const refused = benefitProblem(body.benefit);
    if (refused) return refused;
    const row: PromotionRow = {
      ...promotion(
        promotions.length + 1,
        body.name,
        body.kind,
        "draft",
        null,
        body.conditions ?? {},
        body.benefit,
        [0, 0, 0],
      ),
      description: body.description ?? null,
      campaignId: body.campaignId ?? null,
      priority: body.priority,
      stacking: body.stacking,
      stackGroup: body.stackGroup ?? null,
      startsAt: body.startsAt,
      endsAt: body.endsAt ?? null,
      usageLimitTotal: body.usageLimitTotal ?? null,
      usageLimitPerCustomer: body.usageLimitPerCustomer ?? null,
      budgetAmount: body.budgetAmount ?? null,
      updatedAt: new Date().toISOString(),
    };
    promotions.push(row);
    return withEtag(toPromotionDto(row), etagOf(row), 201);
  }),
  // Before `:promotionId`, which would otherwise take "report" for an id.
  http.get("*/v1/admin/promotions/report", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    const promotionId = url.searchParams.get("promotionId");
    const rows = promotions
      .filter((row) => !campaignId || row.campaignId === campaignId)
      .filter((row) => !promotionId || row.id === promotionId);
    return HttpResponse.json(reportOf(rows));
  }),
  http.get("*/v1/admin/promotions/:promotionId", ({ params, request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = promotionOf(params.promotionId);
    return row ? withEtag(toPromotionDto(row), etagOf(row)) : noPromotion();
  }),
  http.patch("*/v1/admin/promotions/:promotionId", async ({ params, request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = promotionOf(params.promotionId);
    if (!row) return noPromotion();
    const refused = precondition(request, etagOf(row));
    if (refused) return refused;
    if (row.kind === "referral") return systemManaged();
    if (row.status === "ended") return problem(409, "promotions.ended", "โปรโมชันนี้สิ้นสุดแล้ว แก้ไขไม่ได้");
    const body = (await request.json()) as Schemas["UpdatePromotionDto"];
    if (body.benefit) {
      if (row.usage.redemptions > 0 && JSON.stringify(body.benefit) !== JSON.stringify(row.benefit))
        return invalid("benefit", "โปรโมชันนี้มีการใช้แล้ว เปลี่ยนสิทธิประโยชน์ไม่ได้ ให้สร้างโปรโมชันใหม่");
      const wrong = benefitProblem(body.benefit);
      if (wrong) return wrong;
    }
    if (body.priority !== undefined && !Number.isInteger(body.priority))
      return invalid("priority", "กรุณาระบุลำดับเป็นจำนวนเต็ม");
    // Anything but the kind and the campaign (triage `admin.promotions`).
    const { kind, campaignId, ...changes } = body as Schemas["UpdatePromotionDto"] & {
      kind?: unknown;
      campaignId?: unknown;
    };
    void [kind, campaignId];
    Object.assign(row, changes);
    touch(row);
    return withEtag(toPromotionDto(row), etagOf(row));
  }),
  http.post("*/v1/admin/promotions/:promotionId/actions/:action", ({ params, request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = promotionOf(params.promotionId);
    if (!row) return noPromotion();
    if (row.kind === "referral") return systemManaged();
    const next = nextPromotionStatus(row, String(params.action));
    if (!next) return problem(409, "promotions.invalid_transition", "ทำรายการนี้กับโปรโมชันในสถานะนี้ไม่ได้");
    if (params.action === "activate" && row.kind === "coupon" && !codes.some((code) => code.promotionId === row.id))
      return problem(409, "promotions.no_codes", "สร้างโค้ดก่อนเปิดใช้โปรโมชันแบบโค้ด");
    row.status = next;
    touch(row);
    return withEtag(toPromotionDto(row), etagOf(row));
  }),

  http.get("*/v1/admin/promotions/:promotionId/coupons", ({ params, request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    if (!promotionOf(params.promotionId)) return noPromotion();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const [batchId, status] = ["batchId", "status"].map((name) => url.searchParams.get(name));
    const rows = codes
      .filter((code) => code.promotionId === params.promotionId)
      .filter((code) => matchesQuery(q, code.code))
      .filter((code) => !batchId || code.batchId === batchId)
      .filter((code) => !status || code.status === status)
      .map(toCouponCodeDto);
    return HttpResponse.json(paginate(rows, pageOf(url)));
  }),
  http.post("*/v1/admin/promotions/:promotionId/coupons", async ({ params, request }) => {
    const who = allowed(request, "promotions.manage");
    if (!who) return forbidden();
    const key = request.headers.get("idempotency-key");
    if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key");
    const replay = generated.get(`${String(params.promotionId)}:${key}`);
    if (replay) return HttpResponse.json(replay, { status: 201 });
    const row = promotionOf(params.promotionId);
    if (!row) return noPromotion();
    if (row.kind !== "coupon") return problem(409, "promotions.not_a_coupon", "โปรโมชันนี้ไม่ได้ใช้โค้ด");
    if (row.status === "ended") return problem(409, "promotions.ended", "โปรโมชันนี้สิ้นสุดแล้ว");
    const body = (await request.json()) as Schemas["GenerateCouponsDto"];
    if (body.kind === "single" && !/^[A-Za-z0-9-]{3,40}$/.test(body.code ?? ""))
      return invalid("code", "โค้ด 3–40 ตัว ตัวอักษร ตัวเลข หรือ -");
    if (body.kind === "single" && codes.some((item) => item.code.toLowerCase() === body.code!.toLowerCase()))
      return problem(409, "promotions.code_taken", "มีโค้ดนี้แล้ว", [{ path: "code", code: "unique", message: "ซ้ำ" }]);
    if (body.prefix !== undefined && !/^[A-Za-z0-9]{1,12}$/.test(body.prefix))
      return invalid("prefix", "คำนำหน้าเป็นตัวอักษรหรือตัวเลข สูงสุด 12 ตัว");
    const assignees = body.kind === "per_customer" ? (body.customerIds ?? []) : [];
    const count = body.kind === "single" ? 1 : body.kind === "per_customer" ? assignees.length : (body.count ?? 0);
    if (count < 1 || count > 10000) return invalid("count", "จำนวนโค้ด 1–10,000");
    const batch: Batch = {
      id: mockId("cpb", 10 + batches.length),
      promotionId: row.id,
      kind: body.kind,
      count,
      prefix: body.prefix ?? null,
      usageLimitPerCode: body.usageLimit ?? (body.kind === "single" ? null : 1),
      generatedAt: bangkokIso(),
      generatedBy: { id: who.id, displayName: who.displayName },
    };
    batches.push(batch);
    for (let index = 0; index < count; index += 1) {
      codeSeq += 1;
      codes.push({
        id: mockId("cpc", codeSeq),
        code: body.kind === "single" ? body.code! : `${body.prefix ?? ""}${randomTail(codeSeq)}`,
        promotionId: row.id,
        batchId: batch.id,
        assignedCustomerId: assignees[index] ?? null,
        usageLimit: batch.usageLimitPerCode,
        usedCount: 0,
        status: "active",
      });
    }
    const result: Schemas["CouponBatchResultDto"] = {
      batchId: batch.id,
      count,
      kind: batch.kind,
      prefix: batch.prefix,
      usageLimit: batch.usageLimitPerCode,
      generatedAt: batch.generatedAt,
      generatedBy: batch.generatedBy,
    };
    generated.set(`${row.id}:${key}`, result);
    return HttpResponse.json(result, { status: 201 });
  }),
  http.post("*/v1/admin/promotions/:promotionId/coupons/:couponId/actions/:action", ({ params, request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const code = codes.find(
      (candidate) => candidate.id === params.couponId && candidate.promotionId === params.promotionId,
    );
    if (!code) return problem(404, "http.not_found", "ไม่พบโค้ดนี้");
    if (params.action !== "disable" && params.action !== "enable") return invalid("action", "ทำรายการนี้ไม่ได้");
    // Enabling brings a code back as far as its uses allow (D-053); a disabled code is refused at the cart.
    code.status =
      params.action === "disable"
        ? "disabled"
        : code.usageLimit !== null && code.usedCount >= code.usageLimit
          ? "used_up"
          : "active";
    return HttpResponse.json(toCouponCodeDto(code));
  }),
];

/** Reorders already answered, by Idempotency-Key. */
const reorders = new Map<string, Schemas["PromotionPriorityResultDto"]>();

function toCouponBatchDto(batch: Batch): Schemas["CouponBatchDto"] {
  return {
    id: batch.id,
    kind: batch.kind,
    count: batch.count,
    prefix: batch.prefix,
    usageLimit: batch.usageLimitPerCode,
    generatedAt: batch.generatedAt,
    generatedBy: batch.generatedBy,
  };
}

/** The priority reorder and coupon batches (published in v0.5.0), and the referral queue. */
export const marketingHandlers = [
  // admin.promotions.reorder (`promotions.manage`, optional Idempotency-Key): priorities 10, 20, …
  http.put("*/v1/admin/promotions/priority", async ({ request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const key = request.headers.get("idempotency-key");
    const replay = key ? reorders.get(key) : undefined;
    if (replay) return HttpResponse.json(replay, { headers: { "Idempotent-Replayed": "true" } });
    const body = (await request.json().catch(() => null)) as Schemas["PromotionPriorityDto"] | null;
    const ids = [...new Set(body?.promotionIds ?? [])];
    if (ids.length === 0) return invalid("promotionIds", "เลือกโปรโมชันอย่างน้อยหนึ่งรายการ");
    const rows = ids.map(promotionOf);
    if (rows.some((row) => !row)) return noPromotion();
    if (rows.some((row) => row!.kind === "referral")) return systemManaged();
    let updated = 0;
    rows.forEach((row, index) => {
      const priority = (index + 1) * 10;
      if (row!.priority === priority) return;
      row!.priority = priority;
      touch(row!);
      updated += 1;
    });
    const result = { updated };
    if (key) reorders.set(key, result);
    return HttpResponse.json(result);
  }),
  // admin.promotions.listCouponBatches (`promotions.read`): newest first.
  http.get("*/v1/admin/promotions/:promotionId/coupon-batches", ({ params, request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    if (!promotionOf(params.promotionId)) return noPromotion();
    return HttpResponse.json(
      batches
        .filter((batch) => batch.promotionId === params.promotionId)
        .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))
        .map(toCouponBatchDto),
    );
  }),
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
