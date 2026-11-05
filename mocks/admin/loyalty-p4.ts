/**
 * Loyalty P4 (API-CHANGES-P4): the back office's co-funding offers and contributions, the programme budget with its
 * override approval, the rollout (advance through approval, rollback at once, cohort lookup) and the funding split.
 *
 * Every handler is a contract request (`mockRequest`), validated against `src/lib/api/requests/admin-loyalty-p4.ts`.
 * The offers live in `./cofunding-state.ts` (shared with the partner portal). The rollout is the `loyalty.rollout`
 * setting of `./platform.ts`, edited only here (the generic editor refuses it, `settings.dedicated_editor`). The
 * budget is ฿200,000 a month with this month raised to ฿250,000 and ฿210,000 spent (84 %, the 80 % alert fired);
 * `setMockBudgetSpent` moves it for the 100 % state.
 */

import type { LoyaltyRollout, ProgrammeBudget, RolloutTarget } from "@/lib/api/requests/admin-loyalty-p4";

import { staffPersonaOf } from "../auth";
import { can } from "../personas";
import { mockRequest } from "../route";
import { bangkokIso, mockId, paginate, problem } from "../support";
import {
  adminContributionOf,
  adminOfferOf,
  CAPACITY_DEAL_ID,
  cofunding,
  expireDue,
  F001,
  FACTORY_B,
  FACTORY_NAMES,
  fundingOf,
  accruedOf,
  type OfferRow,
} from "./cofunding-state";
import { onApprovalDecided, openApproval, settings } from "./platform";

const forbidden = () => problem(403, "auth.forbidden", "คุณไม่มีสิทธิ์ทำรายการนี้");
const notFound = () => problem(404, "http.not_found", "ไม่พบรายการนี้");
const invalid = (path: string, code: string, message: string) =>
  problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", [{ path, code, message }]);
const allowed = (request: Request, permission: string) => can(staffPersonaOf(request), permission);
const satang = (amount: string) => Math.round(Number(amount) * 100);
const baht = (value: number) => (value / 100).toFixed(2);

/* ------------------------------------------------------------------------------------- surfaces */

type SurfaceSetting = Record<
  "deals" | "dealsLiff" | "redeem" | "tierPerks" | "capacityDeals" | "checklist" | "pointsLiff" | "quoteRecovery",
  boolean
>;

function settingRow(key: string) {
  const row = settings.find((candidate) => candidate.key === key);
  if (!row?.current) throw new Error(`mock setting ${key} is not seeded`);
  return row;
}

/** `loyalty.surfaces` in force (the store and the admin guards read it). */
export const surfaceSetting = (): SurfaceSetting => settingRow("loyalty.surfaces").current!.value as SurfaceSetting;

/* --------------------------------------------------------------------------------------- budget */

const thisMonth = () => bangkokIso(0).slice(0, 7);
const budget = {
  monthlyBaht: "200000.00",
  overrides: {} as Record<string, string>,
  spent: { points: "121400.00", discounts: "78250.00", tierPerks: "16900.00", factoryShare: "6550.00" },
  pending: null as ProgrammeBudget["pendingOverride"],
};
function resetBudget() {
  budget.monthlyBaht = "200000.00";
  budget.overrides = { [thisMonth()]: "250000.00" };
  budget.spent = { points: "121400.00", discounts: "78250.00", tierPerks: "16900.00", factoryShare: "6550.00" };
  budget.pending = null;
}
resetBudget();

/** Moves this month's spend (the points part) so the total is `total` — for the 100 % state in stories and tests. */
export function setMockBudgetSpent(total: string) {
  const others = satang(budget.spent.discounts) + satang(budget.spent.tierPerks) - satang(budget.spent.factoryShare);
  budget.spent.points = baht(satang(total) - others);
}

function budgetOf(month: string): ProgrammeBudget {
  const effective = budget.overrides[month] ?? budget.monthlyBaht;
  const current = month === thisMonth();
  const spent = current
    ? budget.spent
    : { points: "98200.00", discounts: "61400.00", tierPerks: "12000.00", factoryShare: "0.00" };
  const total = satang(spent.points) + satang(spent.discounts) + satang(spent.tierPerks) - satang(spent.factoryShare);
  const usedPct = ((total / satang(effective)) * 100).toFixed(2);
  const used = Number(usedPct);
  return {
    month,
    budget: {
      monthlyBaht: budget.monthlyBaht,
      override: budget.overrides[month] ?? null,
      effective,
      settingVersionId: mockId("stv", 4001),
    },
    spent: { ...spent, total: baht(total) },
    usedPct,
    state: used >= 100 ? "exhausted" : used >= 80 ? "warning" : "ok",
    alertPcts: [80, 100],
    alerts: [80, 100]
      .filter((pct) => used >= pct)
      .map((pct) => ({
        thresholdPct: pct,
        firedAt: current ? bangkokIso(-24 * 60) : `${month}-21T10:15:00+07:00`,
        budget: effective,
        spent: baht(Math.round((satang(effective) * pct) / 100) + 41_000),
      })),
    pendingOverride: current ? budget.pending : null,
    asOf: bangkokIso(0),
    currency: "THB",
  };
}

/** Whether this month's budget is used up — the publish guard `budget_exhausted` (`./marketing.ts` may read it). */
export const budgetExhausted = () => budgetOf(thisMonth()).state === "exhausted";

onApprovalDecided("programme_budget_override", (approval, outcome) => {
  const payload = approval.payload as { month?: string; amount?: string };
  if (outcome === "approved" && payload.month && payload.amount) budget.overrides[payload.month] = payload.amount;
  budget.pending = null;
});

/* -------------------------------------------------------------------------------------- rollout */

type RolloutValue = RolloutTarget & { gates: Record<string, string> };
const STAGE_ORDER = ["internal", "uat", "percent", "all"] as const;
const rolloutValue = () => settingRow("loyalty.rollout").current!.value as unknown as RolloutValue;
let pendingAdvance: LoyaltyRollout["pendingAdvance"] = null;
let history: LoyaltyRollout["history"] = [];
let versionSeq = 3;

function resetRollout() {
  const row = settingRow("loyalty.rollout");
  row.current = {
    ...row.current!,
    value: {
      stage: "percent",
      percent: 10,
      allowlistCompanyIds: [mockId("c", 1)],
      allowlistUserIds: [],
      gates: {
        minRedemptionPct: "15.00",
        maxLiabilityBaht: "500000.00",
        minMarginAfterPromotionsPct: "18.00",
        maxBudgetUsePct: "100.00",
      },
    } as never,
  };
  pendingAdvance = null;
  versionSeq = 3;
  const maree = { id: "00000000-0000-4000-8000-00000000510c", displayName: "ฝ่ายการตลาด ตัวอย่าง (ข้อมูลจำลอง)" };
  const fm = { id: "00000000-0000-4000-8000-00000000510a", displayName: "ผู้จัดการการเงิน ตัวอย่าง (ข้อมูลจำลอง)" };
  history = [
    {
      settingVersionId: mockId("stv", 5003),
      stage: "percent",
      percent: 10,
      kind: "advance",
      reason: "ผ่านเกณฑ์ UAT สองสัปดาห์",
      by: maree,
      approvedBy: fm,
      effectiveFrom: "2026-11-20T09:00:00+07:00",
    },
    {
      settingVersionId: mockId("stv", 5002),
      stage: "uat",
      percent: 0,
      kind: "advance",
      reason: "เริ่มทดสอบกับบริษัท UAT",
      by: maree,
      approvedBy: fm,
      effectiveFrom: "2026-11-06T10:30:00+07:00",
    },
    {
      settingVersionId: mockId("stv", 5001),
      stage: "internal",
      percent: 0,
      kind: "seed",
      reason: null,
      by: null,
      approvedBy: null,
      effectiveFrom: "2026-11-05T00:00:00+07:00",
    },
  ];
}
resetRollout();

/** The rollout in force, for the store mock's cohort (`../store/loyalty-p4.ts`). */
export const rolloutInForce = (): RolloutTarget => {
  const { stage, percent, allowlistCompanyIds, allowlistUserIds } = rolloutValue();
  return { stage, percent, allowlistCompanyIds, allowlistUserIds };
};

/** A stand-in for the API's sha256 bucket: stable per id, 0–99. */
export function bucketOf(id: string): number {
  let hash = 0;
  for (const char of `getpack.loyalty.rollout:${id}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 100;
}

function applyRollout(
  target: RolloutTarget,
  kind: "advance" | "rollback",
  reason: string,
  by: { id: string; displayName: string },
  approvedBy: { id: string; displayName: string } | null,
) {
  const row = settingRow("loyalty.rollout");
  versionSeq += 1;
  row.current = {
    versionNo: versionSeq,
    effectiveFrom: bangkokIso(0),
    value: { ...rolloutValue(), ...target } as never,
  };
  history = [
    {
      settingVersionId: mockId("stv", 5000 + versionSeq),
      stage: target.stage,
      percent: target.percent,
      kind,
      reason,
      by,
      approvedBy,
      effectiveFrom: bangkokIso(0),
    },
    ...history,
  ].slice(0, 10);
}

/** Grows: a later stage, a higher percent at the same stage, or added allowlist ids (a mixed change counts). */
function grows(from: RolloutTarget, to: RolloutTarget): boolean {
  const order = (stage: RolloutTarget["stage"]) => STAGE_ORDER.indexOf(stage);
  if (order(to.stage) > order(from.stage)) return true;
  if (to.stage === from.stage && to.percent > from.percent) return true;
  return (
    to.allowlistCompanyIds.some((id) => !from.allowlistCompanyIds.includes(id)) ||
    to.allowlistUserIds.some((id) => !from.allowlistUserIds.includes(id))
  );
}

function rolloutOf(): LoyaltyRollout {
  const value = rolloutValue();
  const percent = value.stage === "all" ? 100 : value.stage === "percent" ? value.percent : 0;
  const companies = Math.round((402 * percent) / 100) + value.allowlistCompanyIds.length;
  return {
    current: {
      ...rolloutInForce(),
      settingVersionId: mockId("stv", 5000 + versionSeq),
      effectiveFrom: history[0]!.effectiveFrom,
    },
    cohort: {
      companies: Math.min(companies, 402),
      companiesTotal: 402,
      usersWithoutCompany: Math.min(Math.round((3120 * percent) / 100) + value.allowlistUserIds.length, 3120),
      usersWithoutCompanyTotal: 3120,
    },
    gates: [
      {
        metric: "redemption_rate",
        value: "18.40",
        target: value.gates.minRedemptionPct ?? "15.00",
        direction: "min",
        status: "pass",
        window: "3m",
      },
      {
        metric: "points_liability",
        value: "412800.00",
        target: value.gates.maxLiabilityBaht ?? "500000.00",
        direction: "max",
        status: "pass",
        window: "now",
      },
      {
        metric: "margin_after_promotions",
        value: "17.10",
        target: value.gates.minMarginAfterPromotionsPct ?? "18.00",
        direction: "min",
        status: "attention",
        window: "3m",
      },
      {
        metric: "budget_use",
        value: budgetOf(thisMonth()).usedPct,
        target: value.gates.maxBudgetUsePct ?? "100.00",
        direction: "max",
        status: budgetExhausted() ? "attention" : "pass",
        window: "month",
      },
    ],
    pendingAdvance,
    history,
  };
}

onApprovalDecided("loyalty_rollout_advance", (_approval, outcome, decider) => {
  if (outcome === "approved" && pendingAdvance)
    applyRollout(pendingAdvance.target, "advance", pendingAdvance.reason, pendingAdvance.requestedBy, {
      id: decider.id,
      displayName: decider.displayName,
    });
  pendingAdvance = null;
});

/** Known company / user ids for `unknown_id` (the mock's companies are `c`-namespaced, users `usr`). */
const knownId = (id: string) => /^00000000-0000-4000-8000-/.test(id);

/* ------------------------------------------------------------------------------------- co-funding */

const CANDIDATES = [F001, FACTORY_B, mockId("fac", 3)];

export function resetLoyaltyP4AdminMock() {
  resetBudget();
  resetRollout();
}

export const adminLoyaltyP4Handlers = [
  // CONTRACT-REQUEST admin.cofunding-offers
  mockRequest("GET /v1/admin/promotions/{promotionId}/cofunding-candidates", ({ request, params }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    if (params.promotionId !== CAPACITY_DEAL_ID)
      return problem(422, "cofunding.deal_not_eligible", "ร่วมสนับสนุนได้เฉพาะดีลจากคิวผลิตว่าง");
    if (!surfaceSetting().capacityDeals) return problem(404, "loyalty.feature_disabled", "ส่วนนี้ปิดอยู่");
    const live = (factoryId: string) =>
      cofunding.offers.some(
        (offer) =>
          offer.promotionId === params.promotionId &&
          offer.factoryId === factoryId &&
          ["proposed", "accepted"].includes(offer.status),
      );
    return paginate(
      CANDIDATES.map((factoryId) => ({ factoryId, name: FACTORY_NAMES[factoryId]!, hasLiveOffer: live(factoryId) })),
      { perPage: 50 },
    );
  }),
  // CONTRACT-REQUEST admin.cofunding-offers
  mockRequest("GET /v1/admin/promotions/{promotionId}/cofunding-offers", ({ request, params, query }) => {
    if (!allowed(request, "promotions.read")) return forbidden();
    expireDue();
    const rows = cofunding.offers
      .filter((offer) => offer.promotionId === params.promotionId && (!query.status || offer.status === query.status))
      .map(adminOfferOf);
    return paginate(rows, { page: query.page, perPage: query.perPage ?? 50 });
  }),
  // CONTRACT-REQUEST admin.cofunding-offers
  mockRequest("POST /v1/admin/promotions/{promotionId}/cofunding-offers", ({ request, params, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    if (params.promotionId !== CAPACITY_DEAL_ID)
      return problem(422, "cofunding.deal_not_eligible", "ร่วมสนับสนุนได้เฉพาะดีลจากคิวผลิตว่าง");
    if (!surfaceSetting().capacityDeals) return problem(404, "loyalty.feature_disabled", "ส่วนนี้ปิดอยู่");
    if (!CANDIDATES.includes(body.factoryId))
      return invalid("factoryId", "not_a_candidate", "โรงงานนี้ผลิตประเภทนี้ไม่ได้");
    const pctMode = body.mode === "pct_of_discount";
    if (pctMode ? !body.sharePct || body.fixedAmount !== null : !body.fixedAmount || body.sharePct !== null)
      return invalid(pctMode ? "sharePct" : "fixedAmount", "mode_value_mismatch", "ค่าไม่ตรงกับรูปแบบ");
    if (pctMode && (Number(body.sharePct) < 1 || Number(body.sharePct) > 100))
      return invalid("sharePct", "above_max", "1–100");
    if (!pctMode && Number(body.fixedAmount) > 5000) return invalid("fixedAmount", "above_max", "สูงสุด ฿5,000");
    if (Number(body.capAmount) > 200000) return invalid("capAmount", "above_max", "สูงสุด ฿200,000");
    const deal = cofunding.offers.find((offer) => offer.promotionId === CAPACITY_DEAL_ID)!.deal;
    if (body.validFrom < deal.startsAt.slice(0, 10) || body.validTo > deal.endsAt)
      return invalid("validTo", "out_of_deal_window", "ต้องอยู่ในช่วงของดีล");
    const respondBy = body.respondBy ?? bangkokIso(3 * 24 * 60);
    if (respondBy > body.validTo) return invalid("respondBy", "respond_by_after_end", "ต้องตอบก่อนจบช่วง");
    if (
      cofunding.offers.some(
        (offer) =>
          offer.promotionId === params.promotionId &&
          offer.factoryId === body.factoryId &&
          ["proposed", "accepted"].includes(offer.status),
      )
    )
      return problem(409, "cofunding.offer_exists", "มีข้อเสนอที่ยังเปิดอยู่กับโรงงานนี้แล้ว");
    const row: OfferRow = {
      id: mockId("cfo", 100 + cofunding.offers.length),
      promotionId: params.promotionId!,
      factoryId: body.factoryId,
      mode: body.mode,
      sharePct: body.sharePct,
      fixedAmount: body.fixedAmount,
      capAmount: body.capAmount,
      validFrom: body.validFrom,
      validTo: body.validTo,
      respondBy,
      status: "proposed",
      note: body.note?.trim() || null,
      proposedAt: bangkokIso(0),
      answeredAt: null,
      answeredBy: null,
      declineReason: null,
      withdrawnAt: null,
      withdrawReason: null,
      rowVersion: 1,
      deal,
    };
    cofunding.offers.push(row);
    return adminOfferOf(row);
  }),
  // CONTRACT-REQUEST admin.cofunding-offers
  mockRequest("POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw", ({ request, params, body }) => {
    if (!allowed(request, "promotions.manage")) return forbidden();
    const offer = cofunding.offers.find((candidate) => candidate.id === params.offerId);
    if (!offer) return notFound();
    const match = request.headers.get("if-match");
    if (match && match !== `W/"${offer.rowVersion}"`)
      return problem(412, "concurrency.stale", "ข้อมูลนี้ถูกแก้ไขไปแล้ว กรุณาโหลดใหม่");
    if (!["proposed", "accepted"].includes(offer.status))
      return problem(409, "cofunding.invalid_transition", "ถอนข้อเสนอนี้ไม่ได้แล้ว");
    Object.assign(offer, {
      status: "withdrawn",
      withdrawnAt: bangkokIso(0),
      withdrawReason: body.reason,
      rowVersion: offer.rowVersion + 1,
    });
    return adminOfferOf(offer);
  }),
  // CONTRACT-REQUEST admin.cofunding-contributions
  mockRequest("GET /v1/admin/cofunding-contributions", ({ request, query }) => {
    if (!allowed(request, "promotions.read") && !allowed(request, "factory_payables.read")) return forbidden();
    const rows = cofunding.contributions
      .map(adminContributionOf)
      .filter(
        (row) =>
          (!query.promotionId || row.promotionId === query.promotionId) &&
          (!query.offerId || row.offerId === query.offerId) &&
          (!query.factoryId || row.factory.id === query.factoryId) &&
          (!query.status || row.status === query.status),
      );
    return paginate(rows, { page: query.page, perPage: query.perPage ?? 50 });
  }),
  // CONTRACT-REQUEST admin.programme-budget
  mockRequest("GET /v1/admin/loyalty/programme-budget", ({ request, query }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    return budgetOf(query.month ?? thisMonth());
  }),
  // CONTRACT-REQUEST admin.programme-budget
  mockRequest("POST /v1/admin/loyalty/programme-budget/overrides", ({ request, body }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "loyalty.programme.manage")) return forbidden();
    const month = thisMonth();
    const next = bangkokIso(40 * 24 * 60).slice(0, 7);
    if (body.month !== month && body.month !== next)
      return invalid("month", "month_out_of_range", "เฉพาะเดือนนี้หรือเดือนหน้า");
    if (satang(body.amount) <= satang(budgetOf(body.month).budget.effective))
      return invalid("amount", "must_raise", "ต้องมากกว่างบที่ใช้อยู่");
    if (budget.pending) return problem(409, "settings.pending_exists", "มีคำขอรออนุมัติอยู่แล้ว");
    const opened = openApproval({
      policy: "programme_budget_override",
      subjectType: "setting_version",
      subjectId: mockId("stv", 4100),
      requester: persona!,
      amount: body.amount,
      payload: { key: "loyalty.programme_budget", month: body.month, amount: body.amount, reason: body.reason },
    });
    budget.pending = {
      approvalId: opened.id,
      amount: body.amount,
      requestedBy: { id: persona!.id, displayName: persona!.displayName },
      requestedAt: bangkokIso(0),
    };
    return { approvalId: opened.id, status: "pending" as const };
  }),
  // CONTRACT-REQUEST admin.loyalty-rollout
  mockRequest("GET /v1/admin/loyalty/rollout", ({ request }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    return rolloutOf();
  }),
  // CONTRACT-REQUEST admin.loyalty-rollout
  mockRequest("POST /v1/admin/loyalty/rollout/actions/advance", ({ request, body }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "loyalty.programme.manage")) return forbidden();
    const { reason, ...target } = body;
    if ((target.stage === "percent") !== target.percent >= 1)
      return invalid("percent", "invalid", "1–99 เฉพาะขั้นบางส่วน");
    if ([...target.allowlistCompanyIds, ...target.allowlistUserIds].some((id) => !knownId(id)))
      return invalid("allowlistCompanyIds", "unknown_id", "ไม่พบรายชื่อนี้");
    if (!grows(rolloutInForce(), target)) return invalid("stage", "not_an_advance", "ต้องขยายกลุ่ม");
    if (pendingAdvance) return problem(409, "settings.pending_exists", "มีคำขอเลื่อนขั้นรออนุมัติอยู่แล้ว");
    const opened = openApproval({
      policy: "loyalty_rollout_advance",
      subjectType: "setting_version",
      subjectId: mockId("stv", 5100 + versionSeq),
      requester: persona!,
      payload: { key: "loyalty.rollout", before: rolloutInForce(), after: target, reason },
    });
    pendingAdvance = {
      approvalId: opened.id,
      target,
      reason,
      requestedBy: { id: persona!.id, displayName: persona!.displayName },
      requestedAt: bangkokIso(0),
    };
    return { approvalId: opened.id, status: "pending" as const };
  }),
  // CONTRACT-REQUEST admin.loyalty-rollout
  mockRequest("POST /v1/admin/loyalty/rollout/actions/rollback", ({ request, body }) => {
    const persona = staffPersonaOf(request);
    if (!can(persona, "loyalty.programme.manage")) return forbidden();
    const { reason, ...target } = body;
    if ((target.stage === "percent") !== target.percent >= 1)
      return invalid("percent", "invalid", "1–99 เฉพาะขั้นบางส่วน");
    if (grows(rolloutInForce(), target)) return invalid("stage", "not_a_rollback", "การถอยกลับต้องไม่ขยายกลุ่ม");
    pendingAdvance = null;
    applyRollout(target, "rollback", reason, { id: persona!.id, displayName: persona!.displayName }, null);
    return rolloutOf();
  }),
  // CONTRACT-REQUEST admin.loyalty-rollout
  mockRequest("GET /v1/admin/loyalty/rollout/cohort", ({ request, query }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    if (Boolean(query.companyId) === Boolean(query.userId))
      return invalid("companyId", "exactly_one", "ระบุบริษัทหรือบัญชีอย่างใดอย่างหนึ่ง");
    const key = query.companyId ? ("company" as const) : ("user" as const);
    const keyId = (query.companyId ?? query.userId)!;
    const rollout = rolloutInForce();
    const bucket = bucketOf(keyId);
    const allowlisted =
      key === "company" ? rollout.allowlistCompanyIds.includes(keyId) : rollout.allowlistUserIds.includes(keyId);
    const reason =
      rollout.stage === "all"
        ? ("stage_all" as const)
        : allowlisted
          ? key === "company"
            ? ("allowlisted_company" as const)
            : ("allowlisted_user" as const)
          : rollout.stage === "percent"
            ? bucket < rollout.percent
              ? ("bucket_below_percent" as const)
              : ("bucket_above_percent" as const)
            : ("not_allowlisted" as const);
    const inCohort = ["stage_all", "allowlisted_company", "allowlisted_user", "bucket_below_percent"].includes(reason);
    return { key, keyId, bucket, inCohort, reason };
  }),
  // CONTRACT-REQUEST admin.loyalty-analytics.funding
  mockRequest("GET /v1/admin/loyalty/analytics/funding", ({ request, query }) => {
    if (!allowed(request, "loyalty.read")) return forbidden();
    const deals = [...new Set(cofunding.offers.map((offer) => offer.promotionId))].map((promotionId) => {
      const offers = cofunding.offers.filter((offer) => offer.promotionId === promotionId);
      const deal = offers[0]!.deal;
      const accepted = offers.filter((offer) => offer.status === "accepted" || offer.status === "ended");
      const factory = accepted.reduce((sum, offer) => sum + satang(accruedOf(offer.id)), 0);
      const reversed = cofunding.contributions
        .filter((row) => offers.some((offer) => offer.id === row.offerId) && row.status === "reversed")
        .reduce((sum, row) => sum + satang(row.shareAmount), 0);
      const discount =
        promotionId === CAPACITY_DEAL_ID ? 3_875_000 : promotionId === mockId("prm", 41) ? 2_216_000 : 940_000;
      return {
        promotionId,
        name: deal.name,
        productTypeName: deal.productTypeName,
        weekStart: deal.weekStart,
        orders: promotionId === CAPACITY_DEAL_ID ? 31 : promotionId === mockId("prm", 41) ? 18 : 7,
        discountTotal: baht(discount),
        factoryShare: baht(factory),
        getpackShare: baht(discount - factory),
        reversed: baht(reversed),
        factoryCount: accepted.length,
        offersAccepted: accepted.length,
      };
    });
    const sum = (field: "discountTotal" | "factoryShare" | "getpackShare") =>
      baht(deals.reduce((total, row) => total + satang(row[field]), 0));
    const paged = paginate(deals, { page: query.page, perPage: query.perPage ?? 50 });
    return {
      ...paged,
      meta: {
        ...paged.meta,
        totals: {
          discountTotal: sum("discountTotal"),
          factoryShare: sum("factoryShare"),
          getpackShare: sum("getpackShare"),
        },
      },
      asOf: bangkokIso(0),
      currency: "THB" as const,
    };
  }),
];

export { fundingOf };
