/**
 * Loyalty P3 (API-CHANGES-P3, Admin): the reward catalogue and its redemptions, admin loyalty campaigns, the
 * credit-limit tier uplift and capacity-deal drafts — kept in memory. Every handler is a contract request
 * (`mockRequest`), so its answer is validated against `src/lib/api/requests/admin-loyalty-p3.ts`.
 *
 * The catalogue is the UAT seed's eight items (all active). One uplift row is capped (Platinum ×2 over ฿1,000,000),
 * one is not. Capacity is per product type only: no factory id, name or count anywhere (D-502).
 */

import type {
  AdminLoyaltyCampaignRule,
  AdminRedemption,
  BenefitV2,
  CreditUplift,
  CreditUpliftMode,
  CreditUpliftRow,
  CreditVersionP3Fields,
  RewardCatalogInput,
  RewardCatalogItem,
} from "@/lib/api/requests/admin-loyalty-p3";
import type { Schemas } from "@/lib/api/types";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import { REWARD_FIXTURES } from "../store/loyalty-p3";
import { capacityDealPromotions } from "./marketing";

const DAY = 24 * 60;
const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const allowed = (request: Request, permission: string) => can(staffPersonaOf(request), permission);
const invalid = (path: string, code: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code, message }]);

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

const items: ItemRow[] = REWARD_FIXTURES.map((fixture, at) => ({
  id: mockId("rwi", fixture.n),
  code: fixture.code,
  kind: fixture.kind,
  name: fixture.name,
  description: null,
  costPoints: fixture.costPoints,
  value: VALUE_OF[fixture.code]!,
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
  openCoupons: [11, 8, 3, 19, 2, 2, 1, 5][at] ?? 0,
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
  const value = input.value ?? current?.value;
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
      code: ["C-000112", "C-000245", "C-000318"][at % 3]!,
    },
    item: { code: fixture.code, name: fixture.name.th, kind: fixture.kind },
    source: perk ? ("tier_perk" as const) : ("catalogue" as const),
    pointsSpent: perk ? 0 : fixture.costPoints,
    status: status as AdminRedemption["status"],
    couponCode: `GP-${perk ? "TP" : "RW"}-${(4000 + at).toString(36).toUpperCase()}-Q${at}7K`,
    expiresAt: bangkokIso((90 - Number(daysAgo)) * DAY),
    usedOrderCode: (used as string | null) ?? null,
    cancelledAt: status === "cancelled" ? bangkokIso((-Number(daysAgo) + 1) * DAY) : null,
    cancelReason: status === "cancelled" ? "ลูกค้าขอยกเลิก — แลกผิดรายการ" : null,
    createdAt: bangkokIso(-Number(daysAgo) * DAY),
  };
});

/* ----------------------------------------------------------------------------- loyalty campaigns */

const campaigns: (AdminLoyaltyCampaignRule & { version: number })[] = [
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
    cancelledAt: null,
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
    status: "scheduled",
    createdBy: { id: mockId("usr", 7), displayName: "ฝ่ายการตลาด (ข้อมูลจำลอง)" },
    cancelledAt: null,
    version: 1,
  },
];

/** Admin rule campaigns as `admin.loyaltyCampaigns.list` rows, P3 fields included (`./loyalty-p2.ts`). */
export function adminRuleCampaignRows() {
  return campaigns.map(({ version, ...row }) => {
    void version;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status === "scheduled" ? "active" : row.status,
      multiplier: row.multiplier,
      customer: null,
      productTypeCode: row.productTypeCodes?.[0] ?? null,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      convertedOrderCode: null,
      reason: row.reason,
      name: row.name,
      productTypeCodes: row.productTypeCodes,
      audience: row.audience,
      createdBy: row.createdBy,
    };
  });
}

function campaignProblem(input: Partial<AdminLoyaltyCampaignRule>): Response | null {
  if (input.multiplier !== undefined && !(Number(input.multiplier) >= 1.01 && Number(input.multiplier) <= 5))
    return invalid("multiplier", "range", "ตัวคูณ 1.01–5.00");
  if (input.startsAt && input.endsAt) {
    const span = Date.parse(input.endsAt) - Date.parse(input.startsAt);
    if (span <= 0) return invalid("endsAt", "after", "วันสิ้นสุดต้องหลังวันเริ่ม");
    if (span > 92 * 86_400_000) return invalid("endsAt", "max_window", "ช่วงแคมเปญไม่เกิน 92 วัน");
  }
  return null;
}
const strippedCampaign = ({ version, ...row }: (typeof campaigns)[number]): AdminLoyaltyCampaignRule => {
  void version;
  return row;
};

/* ------------------------------------------------------------------------------- credit uplift */

const modes = new Map<string, { mode: CreditUpliftMode; reason: string | null }>();

const UPLIFT_ROWS: CreditUpliftRow[] = [
  {
    versionId: mockId("clv", 9001),
    company: { id: mockId("cmp", 1), legalName: "บริษัท ตัวอย่าง จำกัด" },
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
    pendingRequest: null,
  },
  {
    versionId: mockId("clv", 9002),
    company: { id: mockId("cmp", 2), legalName: "บริษัท แพ็คดี ซัพพลาย จำกัด (ข้อมูลจำลอง)" },
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
    pendingRequest: null,
  },
];

/** The uplift block of a company's credit (`admin.companyCredit.get`), from its approved permanent base. */
function upliftOf(companyId: string, credit: Schemas["AdminCompanyCreditDto"]): CreditUplift {
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

/** `admin.companyCredit.get` from P3 on: the uplift and each version's origin (CONTRACT-REQUEST admin.loyalty.p3-fields). */
export function withCreditP3(companyId: string, credit: Schemas["AdminCompanyCreditDto"]) {
  const row = UPLIFT_ROWS.find((candidate) => candidate.company.id === companyId);
  const versions = credit.versions.map((version): Schemas["CreditLimitVersionDto"] & CreditVersionP3Fields => ({
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

export const loyaltyP3AdminHandlers = [
  // CONTRACT-REQUEST admin.reward-catalog
  mockRequest("GET /v1/admin/loyalty/rewards", ({ request, query }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    return { items: items.filter((row) => !query?.status || row.status === query.status).map(strip) };
  }),
  // CONTRACT-REQUEST admin.reward-catalog
  mockRequest("POST /v1/admin/loyalty/rewards", ({ request, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    if (items.some((row) => row.code === body.code)) return problem(409, "rewards.code_taken", "มีรหัสรางวัลนี้แล้ว");
    const refused = itemProblem(body);
    if (refused) return refused;
    const row: ItemRow = {
      ...body,
      id: mockId("rwi", 50 + items.length),
      status: "draft",
      promotionId: mockId("prm", 250 + items.length),
      redemptions30d: 0,
      openCoupons: 0,
      updatedAt: bangkokIso(),
      version: 1,
    };
    items.push(row);
    return strip(row);
  }),
  // CONTRACT-REQUEST admin.reward-catalog
  mockRequest("GET /v1/admin/loyalty/rewards/{itemId}", ({ request, params }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = items.find((candidate) => candidate.id === params.itemId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    return new Response(JSON.stringify(strip(row)), {
      headers: { "Content-Type": "application/json", ETag: etagOf(row) },
    });
  }),
  // CONTRACT-REQUEST admin.reward-catalog
  mockRequest("PATCH /v1/admin/loyalty/rewards/{itemId}", ({ request, params, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = items.find((candidate) => candidate.id === params.itemId);
    if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    const match = request.headers.get("if-match");
    if (match && match !== etagOf(row)) return problem(412, "concurrency.stale", "มีคนแก้ไขรายการนี้ไปแล้ว");
    if (row.status === "active" && ((body.code && body.code !== row.code) || (body.kind && body.kind !== row.kind)))
      return problem(409, "rewards.item_active", "เปลี่ยนรหัสหรือประเภทระหว่างเปิดใช้ไม่ได้");
    const refused = itemProblem(body, row);
    if (refused) return refused;
    Object.assign(row, body, { updatedAt: bangkokIso(), version: row.version + 1 });
    return new Response(JSON.stringify(strip(row)), {
      headers: { "Content-Type": "application/json", ETag: etagOf(row) },
    });
  }),
  // CONTRACT-REQUEST admin.reward-catalog
  mockRequest("POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}", ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = items.find((candidate) => candidate.id === params.itemId);
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
    return strip(row);
  }),
  // CONTRACT-REQUEST admin.reward-redemptions
  mockRequest("GET /v1/admin/loyalty/reward-redemptions", ({ request, query }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    const q = query?.q?.toLowerCase();
    const rows = redemptions
      .filter((row) => !query?.itemCode || row.item.code === query.itemCode)
      .filter((row) => !query?.status || row.status === query.status)
      .filter(
        (row) =>
          !q ||
          row.customer.displayName.toLowerCase().includes(q) ||
          row.customer.code.toLowerCase().includes(q) ||
          row.couponCode.toLowerCase().includes(q),
      );
    return paginate(rows, { page: query?.page ?? 1, perPage: query?.perPage ?? 25 });
  }),
  // CONTRACT-REQUEST admin.reward-redemptions
  mockRequest(
    "POST /v1/admin/loyalty/reward-redemptions/{redemptionId}/actions/cancel",
    ({ request, params, body }) => {
      if (!allowed(request, "loyalty.adjust")) return forbidden();
      const row = redemptions.find((candidate) => candidate.id === params.redemptionId);
      if (!row) return problem(404, "http.not_found", "ไม่พบรายการนี้");
      if (row.source !== "catalogue") return problem(409, "rewards.not_cancellable", "สิทธิ์ตามระดับยกเลิกไม่ได้");
      if (row.status !== "issued") return problem(409, "rewards.coupon_used", "คูปองนี้ใช้หรือปิดไปแล้ว");
      Object.assign(row, { status: "cancelled", cancelledAt: bangkokIso(), cancelReason: body.reason });
      return row;
    },
  ),
  // CONTRACT-REQUEST admin.loyalty.campaign-rules
  mockRequest("POST /v1/admin/loyalty/campaigns", ({ request, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const refused = campaignProblem(body);
    if (refused) return refused;
    const who = staffPersonaOf(request);
    const row = {
      ...body,
      id: mockId("lcr", 10 + campaigns.length),
      status: Date.parse(body.startsAt) > Date.now() ? ("scheduled" as const) : ("active" as const),
      createdBy: who ? { id: mockId("usr", 7), displayName: who.displayName } : null,
      cancelledAt: null,
      version: 1,
    };
    campaigns.push(row);
    return strippedCampaign(row);
  }),
  // CONTRACT-REQUEST admin.loyalty.campaign-rules
  mockRequest("GET /v1/admin/loyalty/campaigns/{campaignId}", ({ request, params }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    return new Response(JSON.stringify(strippedCampaign(row)), {
      headers: { "Content-Type": "application/json", ETag: `W/"${row.id}.${row.version}"` },
    });
  }),
  // CONTRACT-REQUEST admin.loyalty.campaign-rules — before startsAt only
  mockRequest("PATCH /v1/admin/loyalty/campaigns/{campaignId}", ({ request, params, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    if (Date.parse(row.startsAt) <= Date.now())
      return problem(409, "loyalty.campaign_started", "แคมเปญเริ่มแล้ว แก้ไขไม่ได้ ยกเลิกแล้วสร้างใหม่แทน");
    const refused = campaignProblem({ ...row, ...body });
    if (refused) return refused;
    Object.assign(row, body, { version: row.version + 1 });
    return strippedCampaign(row);
  }),
  // CONTRACT-REQUEST admin.loyalty.campaign-rules
  mockRequest("POST /v1/admin/loyalty/campaigns/{campaignId}/actions/cancel", ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const row = campaigns.find((candidate) => candidate.id === params.campaignId);
    if (!row) return problem(404, "http.not_found", "ไม่พบแคมเปญนี้");
    if (row.status === "cancelled" || row.status === "ended")
      return problem(409, "loyalty.campaign_closed", "แคมเปญนี้ปิดไปแล้ว");
    Object.assign(row, { status: "cancelled", cancelledAt: bangkokIso(), version: row.version + 1 });
    return strippedCampaign(row);
  }),
  // CONTRACT-REQUEST admin.credit-uplift
  mockRequest("PUT /v1/admin/companies/{companyId}/credit/uplift", ({ request, params, body }) => {
    if (!allowed(request, "company_credit.manage")) return forbidden();
    const row = UPLIFT_ROWS.find((candidate) => candidate.company.id === params.companyId);
    if (!row) return problem(422, "companies.uplift_not_eligible", "บริษัทนี้ยังไม่มีวงเงินฐานที่อนุมัติแบบถาวร");
    modes.set(row.company.id, { mode: body.mode, reason: body.reason });
    row.mode = body.mode;
    return {
      uplift: {
        mode: body.mode,
        modeReason: body.reason,
        baseLimit: row.baseLimit,
        companyTier: row.companyTier,
        companySpend12m: row.companySpend12m,
        target: row.target,
        capped: row.capped,
        aboveCapTarget: row.aboveCapTarget,
      },
    };
  }),
  // CONTRACT-REQUEST admin.credit-uplift
  mockRequest("GET /v1/admin/credit-uplifts", ({ request, query }) => {
    if (!allowed(request, "company_credit.manage") && !allowed(request, "companies.read")) return forbidden();
    return {
      items: UPLIFT_ROWS.filter((row) => !query?.companyId || row.company.id === query.companyId).filter(
        (row) => query?.aboveCap === undefined || String(row.capped) === query.aboveCap,
      ),
    };
  }),
  // CONTRACT-REQUEST admin.capacity-deals — per product type, never a factory
  mockRequest("GET /v1/admin/promotions/capacity-deals", ({ request }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    return {
      provider: "capacity_bookings",
      items: capacityDealPromotions().map((row) => ({
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
      })),
    };
  }),
];
