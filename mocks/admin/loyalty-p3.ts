/**
 * Loyalty P3 (API-CHANGES-P3, Admin): the reward catalogue and its redemptions, admin loyalty campaigns, the
 * credit-limit tier uplift and capacity-deal drafts — kept in memory, in the generated shapes (getpack-api
 * `feat/loyalty-p3-catalogue-tiers`, pinned in `contract.lock.json`). Admin lists answer the paginated `{ data, meta }`
 * (API-CHANGES-P3 deviation 5).
 *
 * The catalogue is the UAT seed's eight items (all active). One uplift row is capped (Platinum ×2 over ฿1,000,000),
 * one is not. Capacity is per product type only: no factory id, name or count anywhere (D-502).
 */

import { http, HttpResponse } from "msw";

import type {
  AdminLoyaltyCampaign,
  AdminRedemption,
  BenefitV2,
  CreditUplift,
  CreditUpliftMode,
  CreditUpliftRow,
  RewardCatalogInput,
  RewardCatalogItem,
} from "@/features/shared/loyalty-p3/types";
import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { REWARD_FIXTURES } from "../store/loyalty-p3";
import { companyCreditOf } from "./companies";
import { fundingOf } from "./cofunding-state";
import { capacityDealPromotions } from "./marketing";

const DAY = 24 * 60;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const allowed = (request: Request, permission: string) => can(staffPersonaOf(request), permission);
const invalid = (path: string, code: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code, message }]);
const json = <T>(body: T, init: { status?: number; etag?: string } = {}) =>
  HttpResponse.json(body as never, {
    status: init.status ?? 200,
    ...(init.etag ? { headers: { ETag: init.etag } } : {}),
  });
const bodyOf = async <T>(request: Request): Promise<T> => (await request.json().catch(() => ({}))) as T;
const pageOf = (query: URLSearchParams) => ({
  page: Number(query.get("page") ?? 1),
  perPage: Number(query.get("perPage") ?? 25),
});

/* ------------------------------------------------------------------------------ reward catalogue */

const VALUE_OF: Record<string, BenefitV2> = {
  cash_off_50: { type: "fixed", amount: "50.00" },
  cash_off_100: { type: "fixed", amount: "100.00" },
  cash_off_250: { type: "fixed", amount: "250.00" },
  free_shipping: { type: "free_shipping" },
  free_sample: { type: "free_sample", maxAmount: "500.00" },
  free_rush: { type: "free_rush", daysSaved: 2 },
  print_upgrade: { type: "free_addon", addonCode: "spot_uv", maxAmount: "1500.00" },
  artwork_round: { type: "revision_round", rounds: 1 },
};
const MIN_OF: Record<string, string | null> = {
  cash_off_50: "250.00",
  cash_off_100: "500.00",
  cash_off_250: "1250.00",
  free_shipping: "2000.00",
};

interface ItemRow extends RewardCatalogItem {
  version: number;
}

const VALUE_TEXT: Record<BenefitV2["type"], (value: BenefitV2) => string> = {
  fixed: (value) => `ลด ฿${Number((value as { amount: string }).amount).toLocaleString("en-US")}`,
  free_shipping: () => "ส่งฟรี",
  free_sample: () => "ตัวอย่างฟรี",
  free_rush: () => "ผลิตด่วนฟรี",
  free_addon: () => "อัปเกรดงานพิมพ์ฟรี",
  revision_round: () => "แก้แบบเพิ่มฟรี",
};
const valueTextOf = (value: Record<string, unknown>) => {
  const benefit = value as BenefitV2;
  return VALUE_TEXT[benefit.type]?.(benefit) ?? "";
};

const items: ItemRow[] = REWARD_FIXTURES.map((fixture, at) => ({
  id: mockId("rwi", fixture.n),
  code: fixture.code,
  kind: fixture.kind,
  name: fixture.name,
  description: { th: null, en: null },
  costPoints: fixture.costPoints,
  value: VALUE_OF[fixture.code]!,
  valueTextTh: valueTextOf(VALUE_OF[fixture.code]!),
  constraints: {
    minOrderValue: MIN_OF[fixture.code] ?? null,
    productTypeCodes: fixture.code === "print_upgrade" ? ["folding_carton"] : null,
    perUserEveryMonths: fixture.everyMonths ?? null,
  },
  tierRequired: fixture.tierRequired,
  validityDays: 90,
  activeFrom: "2026-11-01T00:00:00+07:00",
  activeTo: null,
  sortOrder: (at + 1) * 10,
  status: "active",
  promotionId: mockId("prm", 200 + fixture.n),
  redemptions30d: [42, 31, 9, 58, 12, 6, 4, 17][at] ?? 0,
  updatedAt: bangkokIso(-10 * DAY),
  version: 1,
}));

const etagOf = (row: ItemRow) => `W/"${row.id}.${row.version}"`;
const strip = ({ version, ...row }: ItemRow): RewardCatalogItem => {
  void version;
  return row;
};
const VALUE_TYPE: Record<RewardCatalogItem["kind"], BenefitV2["type"]> = {
  cash_off: "fixed",
  free_shipping: "free_shipping",
  free_sample: "free_sample",
  free_rush: "free_rush",
  free_addon: "free_addon",
  revision_round: "revision_round",
};
const KNOWN_ADDONS = new Set(["spot_uv", "matte_lamination", "gloss_lamination", "hot_foil", "emboss"]);

/** The API's item rules: value of the kind, the cash-off floor (D-133 20 % cap), a known addon. */
function itemProblem(input: Partial<RewardCatalogInput>, current?: ItemRow): Response | null {
  const kind = input.kind ?? current?.kind;
  const value = (input.value ?? current?.value) as BenefitV2 | undefined;
  const constraints = input.constraints ?? current?.constraints;
  if (kind && value && VALUE_TYPE[kind] !== value.type)
    return invalid("value.type", "kind_mismatch", "สิทธิ์ไม่ตรงกับประเภทของรางวัล");
  if (value?.type === "fixed" && kind === "cash_off") {
    const floor = Number(value.amount) * 5;
    if (!constraints?.minOrderValue || Number(constraints.minOrderValue) < floor)
      return invalid("constraints.minOrderValue", "cap_floor", `ยอดขั้นต่ำต้องไม่น้อยกว่า ${floor.toFixed(2)} บาท`);
  }
  if (value?.type === "free_addon" && !KNOWN_ADDONS.has(value.addonCode))
    return invalid("value.addonCode", "unknown_addon", "ไม่พบตัวเลือกงานพิมพ์นี้");
  return null;
}

/* ------------------------------------------------------------------------------------ redemptions */

const redemptions: AdminRedemption[] = [
  ["free_shipping", "issued", 2, null],
  ["cash_off_100", "used", 6, "OR-2610-0233"],
  ["free_sample", "used", 50, "OR-2609-0118"],
  ["cash_off_50", "cancelled", 12, null],
  ["free_rush", "issued", 34, null],
  ["artwork_round", "expired", 120, null],
].map(([code, status, daysAgo, used], at) => {
  const fixture = REWARD_FIXTURES.find((candidate) => candidate.code === code)!;
  const perk = code === "free_rush";
  return {
    id: mockId("rwr", 100 + at),
    customer: {
      id: mockId("cus", 1 + (at % 3)),
      displayName: ["คุณสมชาย ใจดี", "บริษัท ตัวอย่าง จำกัด", "คุณวิภา แสงทอง"][at % 3]!,
    },
    item: { code: fixture.code, name: fixture.name.th, kind: fixture.kind },
    source: perk ? ("tier_perk" as const) : ("catalogue" as const),
    pointsSpent: perk ? 0 : fixture.costPoints,
    bahtValue: perk ? "0.00" : (fixture.costPoints * 2.5).toFixed(2),
    balanceAfter: null,
    status: status as AdminRedemption["status"],
    coupon: {
      code: `GP-${perk ? "TP" : "RW"}-${(4000 + at).toString(36).toUpperCase()}-Q${at}7K`,
      expiresAt: bangkokIso((90 - Number(daysAgo)) * DAY),
    },
    cancellableUntil: !perk && status === "issued" ? bangkokIso((7 - Number(daysAgo)) * DAY) : null,
    usedOrderCode: (used as string | null) ?? null,
    perkPeriod: perk ? "2026-Q4" : null,
    cancelledAt: status === "cancelled" ? bangkokIso((-Number(daysAgo) + 1) * DAY) : null,
    cancelReason: status === "cancelled" ? "ลูกค้าขอยกเลิก — แลกผิดรายการ" : null,
    createdAt: bangkokIso(-Number(daysAgo) * DAY),
  };
});

/* ----------------------------------------------------------------------------- loyalty campaigns */

const campaigns: (AdminLoyaltyCampaign & { version: number })[] = [
  {
    id: mockId("lcr", 1),
    name: "สะสมแต้มกล่องลูกฟูก ×1.5",
    kind: "admin_rule",
    multiplier: "1.50",
    startsAt: "2026-11-01T00:00:00+07:00",
    endsAt: "2026-11-30T23:59:59+07:00",
    productTypeCodes: ["corrugated_rsc"],
    audience: { tiers: ["silver", "gold", "platinum"] },
    reason: "corrugated_nov_2026",
    status: "active",
    createdBy: { id: mockId("usr", 7), displayName: "ฝ่ายการตลาด (ข้อมูลจำลอง)" },
    customer: null,
    productTypeCode: "corrugated_rsc",
    convertedOrderCode: null,
    version: 1,
  },
  {
    id: mockId("lcr", 2),
    name: "ปลายปีแต้ม ×2",
    kind: "admin_rule",
    multiplier: "2.00",
    startsAt: "2026-12-01T00:00:00+07:00",
    endsAt: "2026-12-31T23:59:59+07:00",
    productTypeCodes: null,
    audience: {},
    reason: "year_end_2026",
    // The API has no `scheduled`: an active campaign whose start is ahead (the web shows "รอเริ่ม").
    status: "active",
    createdBy: { id: mockId("usr", 7), displayName: "ฝ่ายการตลาด (ข้อมูลจำลอง)" },
    customer: null,
    productTypeCode: null,
    convertedOrderCode: null,
    version: 1,
  },
];

/** Admin rule campaigns as `admin.loyaltyCampaigns.list` rows (`./loyalty-p2.ts`). */
export function adminRuleCampaignRows(): AdminLoyaltyCampaign[] {
  return campaigns.map((row) => strippedCampaign(row));
}

function campaignProblem(input: Partial<Schemas["CreateLoyaltyCampaignDto"]>): Response | null {
  if (input.multiplier !== undefined && !(Number(input.multiplier) >= 1.01 && Number(input.multiplier) <= 5))
    return invalid("multiplier", "range", "ตัวคูณ 1.01–5.00");
  if (input.startsAt && input.endsAt) {
    const span = Date.parse(input.endsAt) - Date.parse(input.startsAt);
    if (span <= 0) return invalid("endsAt", "after", "วันสิ้นสุดต้องหลังวันเริ่ม");
    if (span > 92 * 86_400_000) return invalid("endsAt", "max_window", "ช่วงแคมเปญไม่เกิน 92 วัน");
  }
  return null;
}
function strippedCampaign({ version, ...row }: (typeof campaigns)[number]): AdminLoyaltyCampaign {
  void version;
  return row;
}

/* ------------------------------------------------------------------------------- credit uplift */

const modes = new Map<string, { mode: CreditUpliftMode; reason: string | null }>();

const UPLIFT_ROWS: CreditUpliftRow[] = [
  {
    versionId: mockId("clv", 9001),
    company: { id: mockId("cmy", 1), legalName: "บริษัท ตัวอย่าง จำกัด" },
    companyTier: "platinum",
    companySpend12m: "612400.00",
    baseLimit: "600000.00",
    factor: "2.00",
    target: "1200000.00",
    newLimit: "1000000.00",
    previousLimit: "900000.00",
    capped: true,
    aboveCapTarget: "1200000.00",
    effectiveFrom: "2026-11-04T03:10:00+07:00",
    mode: "auto",
    origin: "tier_uplift",
    pendingRequest: null,
  },
  {
    versionId: mockId("clv", 9002),
    company: { id: mockId("cmy", 2), legalName: "บริษัท แพ็คดี ซัพพลาย จำกัด (ข้อมูลจำลอง)" },
    companyTier: "gold",
    companySpend12m: "248900.00",
    baseLimit: "200000.00",
    factor: "1.50",
    target: "300000.00",
    newLimit: "300000.00",
    previousLimit: "200000.00",
    capped: false,
    aboveCapTarget: null,
    effectiveFrom: "2026-11-03T03:10:00+07:00",
    mode: "auto",
    origin: "tier_uplift",
    pendingRequest: null,
  },
];

/** A company's credit before P3's fields (the companies mock builds it; {@link withCreditP3} completes it). */
export type BaseCredit = Omit<Schemas["AdminCompanyCreditDto"], "uplift" | "versions"> & {
  versions: Omit<Schemas["CreditLimitVersionDto"], "origin" | "baseVersionId" | "upliftFactor" | "companyTier">[];
};

/** The uplift block of a company's credit (`admin.companyCredit.get`), from its approved permanent base. */
function upliftOf(companyId: string, credit: BaseCredit): CreditUplift {
  const row = UPLIFT_ROWS.find((candidate) => candidate.company.id === companyId);
  const override = modes.get(companyId);
  if (row)
    return {
      mode: override?.mode ?? row.mode,
      modeReason: override?.reason ?? null,
      baseLimit: row.baseLimit,
      companyTier: row.companyTier,
      companySpend12m: row.companySpend12m,
      target: row.target,
      capped: row.capped,
      aboveCapTarget: row.aboveCapTarget,
    };
  const base = credit.versions.find((version) => version.status === "approved" && !version.validUntil);
  return {
    mode: override?.mode ?? "auto",
    modeReason: override?.reason ?? null,
    baseLimit: base?.limitAmount ?? null,
    companyTier: base ? "silver" : null,
    companySpend12m: "86500.00",
    target: base?.limitAmount ?? null,
    capped: false,
    aboveCapTarget: null,
  };
}

/** `admin.companyCredit.get` from P3 on: the uplift and each version's origin. */
export function withCreditP3(companyId: string, credit: BaseCredit): Schemas["AdminCompanyCreditDto"] {
  const row = UPLIFT_ROWS.find((candidate) => candidate.company.id === companyId);
  const versions = credit.versions.map((version): Schemas["CreditLimitVersionDto"] => ({
    ...version,
    origin: "request",
    baseVersionId: null,
    upliftFactor: null,
    companyTier: null,
  }));
  if (row && versions.length > 0) {
    const base = versions[versions.length - 1]!;
    versions.unshift({
      ...base,
      id: row.versionId,
      limitAmount: row.newLimit,
      reason: "tier_uplift",
      status: "approved",
      effectiveFrom: row.effectiveFrom,
      requestedAt: row.effectiveFrom,
      requestedBy: null,
      approvalId: null,
      origin: modes.get(companyId)?.mode === "off" ? "tier_uplift_override" : "tier_uplift",
      baseVersionId: base.id,
      upliftFactor: row.factor,
      companyTier: row.companyTier,
    });
  }
  return { ...credit, versions, uplift: upliftOf(companyId, credit) };
}

/* ------------------------------------------------------------------------------------- handlers */

const itemById = (id: unknown) => items.find((candidate) => candidate.id === id);
const campaignById = (id: unknown) => campaigns.find((candidate) => candidate.id === id);

export const loyaltyP3AdminHandlers = [
  // admin.rewardCatalog.list (paginated)
  http.get("*/v1/admin/loyalty/rewards", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const query = new URL(request.url).searchParams;
    const status = query.get("status");
    return json(paginate(items.filter((row) => !status || row.status === status).map(strip), pageOf(query)));
  }),
  // admin.rewardCatalog.create — a draft and its hidden system promotion
  http.post("*/v1/admin/loyalty/rewards", async ({ request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const body = await bodyOf<RewardCatalogInput>(request);
    if (items.some((row) => row.code === body.code)) return problem(409, "rewards.code_taken", "มีรหัสรางวัลนี้แล้ว");
    const refused = itemProblem(body);
    if (refused) return refused;
    const row: ItemRow = {
      code: body.code,
      kind: body.kind,
      name: body.name,
      description: { th: body.description?.th ?? null, en: body.description?.en ?? null },
      costPoints: body.costPoints,
      value: body.value,
      valueTextTh: valueTextOf(body.value),
      constraints: body.constraints ?? {},
      tierRequired: body.tierRequired ?? null,
      validityDays: body.validityDays,
      activeFrom: body.activeFrom,
      activeTo: body.activeTo ?? null,
      sortOrder: body.sortOrder ?? (items.length + 1) * 10,
      id: mockId("rwi", 50 + items.length),
      status: "draft",
      promotionId: mockId("prm", 250 + items.length),
      redemptions30d: 0,
      updatedAt: bangkokIso(),
      version: 1,
    };
    items.push(row);
    return json(strip(row), { status: 201, etag: etagOf(row) });
  }),
  // admin.rewardCatalog.get
  http.get("*/v1/admin/loyalty/rewards/:itemId", ({ request, params }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = itemById(params.itemId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    return json(strip(row), { etag: etagOf(row) });
  }),
  // admin.rewardCatalog.update (If-Match); code and kind are frozen while active
  http.patch("*/v1/admin/loyalty/rewards/:itemId", async ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = itemById(params.itemId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    const match = request.headers.get("if-match");
    if (match && match !== etagOf(row)) return problem(412, "concurrency.stale", "มีคนแก้ไขรายการนี้ไปแล้ว");
    const body = await bodyOf<Schemas["UpdateRewardItemDto"]>(request);
    if (row.status === "active" && ((body.code && body.code !== row.code) || (body.kind && body.kind !== row.kind)))
      return problem(409, "rewards.item_active", "เปลี่ยนรหัสหรือประเภทระหว่างเปิดใช้ไม่ได้");
    const refused = itemProblem(body, row);
    if (refused) return refused;
    Object.assign(row, body, {
      description: { th: body.description?.th ?? row.description.th, en: body.description?.en ?? row.description.en },
      valueTextTh: valueTextOf(body.value ?? row.value),
      updatedAt: bangkokIso(),
      version: row.version + 1,
    });
    return json(strip(row), { etag: etagOf(row) });
  }),
  // admin.rewardCatalog.action — activate | pause | archive
  http.post("*/v1/admin/loyalty/rewards/:itemId/actions/:action", ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = itemById(params.itemId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    const next = { activate: "active", pause: "paused", archive: "archived" }[String(params.action)] as
      ItemRow["status"] | undefined;
    const from: Record<string, ItemRow["status"][]> = {
      active: ["draft", "paused"],
      paused: ["active"],
      archived: ["draft", "active", "paused"],
    };
    if (!next || !from[next]!.includes(row.status))
      return problem(409, "rewards.invalid_transition", "ทำรายการนี้กับรางวัลในสถานะนี้ไม่ได้");
    Object.assign(row, { status: next, updatedAt: bangkokIso(), version: row.version + 1 });
    return json(strip(row), { etag: etagOf(row) });
  }),
  // admin.rewardRedemptions.list (paginated)
  http.get("*/v1/admin/loyalty/reward-redemptions", ({ request }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    const query = new URL(request.url).searchParams;
    const q = query.get("q")?.toLowerCase();
    const itemId = query.get("itemId");
    const itemCode = itemId ? itemById(itemId)?.code : null;
    const rows = redemptions
      .filter((row) => !itemId || row.item.code === itemCode)
      .filter((row) => !query.get("status") || row.status === query.get("status"))
      .filter((row) => !query.get("source") || row.source === query.get("source"))
      .filter((row) => !query.get("customerId") || row.customer.id === query.get("customerId"))
      .filter(
        (row) => !q || row.customer.displayName.toLowerCase().includes(q) || row.coupon.code.toLowerCase().includes(q),
      );
    return json(paginate(rows, pageOf(query)));
  }),
  // admin.rewardRedemptions.cancel — loyalty.adjust, a reason
  http.post("*/v1/admin/loyalty/reward-redemptions/:redemptionId/actions/cancel", async ({ request, params }) => {
    if (!allowed(request, "loyalty.adjust")) return forbidden();
    const row = redemptions.find((candidate) => candidate.id === params.redemptionId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    if (row.source !== "catalogue") return problem(409, "rewards.not_cancellable", "สิทธิ์ตามระดับยกเลิกไม่ได้");
    if (row.status !== "issued") return problem(409, "rewards.coupon_used", "คูปองนี้ใช้หรือปิดไปแล้ว");
    const body = await bodyOf<Schemas["DownloadWithReasonDto"]>(request);
    Object.assign(row, {
      status: "cancelled",
      cancelledAt: bangkokIso(),
      cancelReason: body.reason,
      cancellableUntil: null,
    });
    return json(row);
  }),
  // admin.loyaltyCampaigns.create — an admin rule
  http.post("*/v1/admin/loyalty/campaigns", async ({ request }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const body = await bodyOf<Schemas["CreateLoyaltyCampaignDto"]>(request);
    const refused = campaignProblem(body);
    if (refused) return refused;
    const who = staffPersonaOf(request);
    const row: (typeof campaigns)[number] = {
      id: mockId("lcr", 10 + campaigns.length),
      kind: body.kind,
      name: body.name,
      multiplier: body.multiplier,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      productTypeCodes: body.productTypeCodes ?? null,
      productTypeCode: body.productTypeCodes?.[0] ?? null,
      audience: body.audience ?? null,
      reason: body.reason,
      status: "active",
      createdBy: who ? { id: mockId("usr", 7), displayName: who.displayName } : null,
      customer: null,
      convertedOrderCode: null,
      version: 1,
    };
    campaigns.push(row);
    return json(strippedCampaign(row), { status: 201, etag: `W/"${row.id}.${row.version}"` });
  }),
  // admin.loyaltyCampaigns.get
  http.get("*/v1/admin/loyalty/campaigns/:campaignId", ({ request, params }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = campaignById(params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    return json(strippedCampaign(row), { etag: `W/"${row.id}.${row.version}"` });
  }),
  // admin.loyaltyCampaigns.update — before startsAt only
  http.patch("*/v1/admin/loyalty/campaigns/:campaignId", async ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = campaignById(params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    if (Date.parse(row.startsAt) <= Date.now())
      return problem(409, "loyalty.campaign_started", "แคมเปญเริ่มแล้ว แก้ไขไม่ได้ ยกเลิกแล้วสร้างใหม่แทน");
    const body = await bodyOf<Schemas["UpdateLoyaltyCampaignDto"]>(request);
    const refused = campaignProblem({
      multiplier: body.multiplier ?? row.multiplier,
      startsAt: body.startsAt ?? row.startsAt,
      endsAt: body.endsAt ?? row.endsAt,
    });
    if (refused) return refused;
    Object.assign(row, body, {
      productTypeCode: (body.productTypeCodes ?? row.productTypeCodes)?.[0] ?? null,
      version: row.version + 1,
    });
    return json(strippedCampaign(row), { etag: `W/"${row.id}.${row.version}"` });
  }),
  // admin.loyaltyCampaigns.cancel — the reason is optional
  http.post("*/v1/admin/loyalty/campaigns/:campaignId/actions/cancel", ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = campaignById(params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    if (row.status === "cancelled" || row.status === "ended")
      return problem(409, "loyalty.campaign_closed", "แคมเปญนี้ปิดไปแล้ว");
    Object.assign(row, { status: "cancelled", version: row.version + 1 });
    return json(strippedCampaign(row));
  }),
  // admin.companyCredit.setUpliftMode — answers the whole credit
  http.put("*/v1/admin/companies/:companyId/credit/uplift", async ({ request, params }) => {
    if (!allowed(request, "company_credit.manage")) return forbidden();
    const companyId = String(params.companyId);
    const row = UPLIFT_ROWS.find((candidate) => candidate.company.id === companyId);
    if (!row) return problem(422, "companies.uplift_not_eligible", "บริษัทนี้ยังไม่มีวงเงินฐานที่อนุมัติแบบถาวร");
    const body = await bodyOf<Schemas["SetUpliftModeDto"]>(request);
    modes.set(companyId, { mode: body.mode, reason: body.reason });
    row.mode = body.mode;
    const credit = companyCreditOf(companyId);
    return credit ? json(credit) : problem(404, "http.not_found", "ไม่พบบริษัทนี้");
  }),
  // admin.creditUplifts.list (paginated)
  http.get("*/v1/admin/credit-uplifts", ({ request }) => {
    if (!allowed(request, "company_credit.manage") && !allowed(request, "companies.read")) return forbidden();
    const query = new URL(request.url).searchParams;
    const companyId = query.get("companyId");
    const aboveCap = query.get("aboveCap");
    const rows = UPLIFT_ROWS.filter((row) => !companyId || row.company.id === companyId).filter(
      (row) => aboveCap === null || String(row.capped) === aboveCap,
    );
    return json(paginate(rows, pageOf(query)));
  }),
  // admin.capacityDeals.list (paginated) — per product type, never a factory
  http.get("*/v1/admin/promotions/capacity-deals", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const rows: Schemas["CapacityDealDto"][] = capacityDealPromotions().map((row) => ({
      promotionId: row.id,
      productTypeCode: row.capacityDeal!.productTypeCode,
      productTypeName: "กล่องลูกฟูก",
      weekStart: row.capacityDeal!.weekStart,
      freePct: row.capacityDeal!.freePct,
      discountPct: row.benefit.pct ?? "0",
      visibility: row.visibility ?? "hidden",
      status: row.status,
      approval: row.capacityDeal!.approval,
      createdAt: bangkokIso(-4 * 60),
      // Loyalty P4 (D-506): who funds the discount (CONTRACT-REQUEST admin.loyalty.p4-fields).
      ...({ funding: fundingOf(row.id) } as object),
    }));
    return json(paginate(rows, pageOf(new URL(request.url).searchParams)));
  }),
];
