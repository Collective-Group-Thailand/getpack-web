/**
 * Loyalty P3 (API-CHANGES-P3): the reward catalogue, redeeming, my reward coupons and the 7-day cancel, kept in memory
 * per persona; and the fields P3 adds to `store.loyalty.get` (perks, active multipliers, open coupons).
 *
 * Every handler answers in the generated shapes (getpack-api `feat/loyalty-p3-catalogue-tiers`, pinned in
 * `contract.lock.json`), including `store.rewards.preview` — the balance after a redeem is worked out here, as the API
 * does, never by a screen. The eight items are the UAT seed's (API-CHANGES-P3 "Seed"). The review
 * customer holds one open free-shipping coupon (redeemed two days ago, still cancellable) and redeemed a free sample
 * 50 days ago, so that item says when it can be redeemed again. A newcomer has 0 points and nothing redeemed.
 *
 * Redeeming takes the points off the persona's balance — the same `points` `store.loyalty.get` reports — and cancel
 * puts them back. The mock never offers a cash or transfer path (D-498).
 */

import { http, HttpResponse } from "msw";

import type {
  LoyaltyPerk,
  LoyaltySummaryP3,
  LoyaltyTierP3,
  RewardItem,
  RewardKind,
  RewardPreview,
  RewardRedemption,
} from "@/features/shared/loyalty-p3/types";
import type { Schemas } from "@/lib/api/types";

import { bangkokIso, mockId, paginate, problem } from "../support";
import { customerOf, type MockCustomer } from "./customers";

const DAY = 24 * 60;
type Lang = "th" | "en";
const langOf = (request: Request): Lang =>
  (request.headers.get("accept-language") ?? "th").toLowerCase().startsWith("en") ? "en" : "th";
const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
const t = (th: string, en: string) => ({ th, en });

interface Fixture {
  n: number;
  code: string;
  kind: RewardKind;
  name: { th: string; en: string };
  valueText: { th: string; en: string };
  conditions: { th: string; en: string }[];
  costPoints: number;
  tierRequired: LoyaltyTierP3 | null;
  /** Free sample: once every N months per customer. */
  everyMonths?: number;
}

/** The UAT seed's eight items, in the API's order (cash-off first, then perks; `sortOrder`). */
export const REWARD_FIXTURES: readonly Fixture[] = [
  {
    n: 1,
    code: "cash_off_50",
    kind: "cash_off",
    name: t("ส่วนลด ฿50", "฿50 off"),
    valueText: t("ลด ฿50", "฿50 off"),
    conditions: [t("ขั้นต่ำ ฿250", "Minimum ฿250")],
    costPoints: 20,
    tierRequired: null,
  },
  {
    n: 2,
    code: "cash_off_100",
    kind: "cash_off",
    name: t("ส่วนลด ฿100", "฿100 off"),
    valueText: t("ลด ฿100", "฿100 off"),
    conditions: [t("ขั้นต่ำ ฿500", "Minimum ฿500")],
    costPoints: 40,
    tierRequired: null,
  },
  {
    n: 3,
    code: "cash_off_250",
    kind: "cash_off",
    name: t("ส่วนลด ฿250", "฿250 off"),
    valueText: t("ลด ฿250", "฿250 off"),
    conditions: [t("ขั้นต่ำ ฿1,250", "Minimum ฿1,250")],
    costPoints: 100,
    tierRequired: null,
  },
  {
    n: 4,
    code: "free_shipping",
    kind: "free_shipping",
    name: t("ส่งฟรี 1 คำสั่งซื้อ", "Free shipping on one order"),
    valueText: t("ส่งฟรี", "Free shipping"),
    conditions: [t("ขั้นต่ำ ฿2,000", "Minimum ฿2,000")],
    costPoints: 60,
    tierRequired: null,
  },
  {
    n: 5,
    code: "free_sample",
    kind: "free_sample",
    name: t("ตัวอย่างฟรี 1 ชิ้นงาน", "One free sample"),
    valueText: t("ตัวอย่างฟรี", "Free sample"),
    conditions: [t("สูงสุด ฿500", "Up to ฿500"), t("1 ครั้งต่อ 3 เดือน", "Once every 3 months")],
    costPoints: 80,
    tierRequired: null,
    everyMonths: 3,
  },
  {
    n: 6,
    code: "free_rush",
    kind: "free_rush",
    name: t("ผลิตด่วนฟรี (ตามคิว)", "Free rush production (subject to the queue)"),
    valueText: t("ผลิตด่วน", "Rush"),
    conditions: [t("เร็วขึ้น 2 วันทำการ เมื่อคิวผลิตรับได้", "2 working days sooner when the queue allows")],
    costPoints: 120,
    tierRequired: null,
  },
  {
    n: 7,
    code: "print_upgrade",
    kind: "free_addon",
    name: t("อัปเกรดเคลือบ Spot UV", "Spot UV upgrade"),
    valueText: t("Spot UV", "Spot UV"),
    conditions: [
      t("กล่องพิมพ์ที่เลือก Spot UV", "Printed boxes with Spot UV selected"),
      t("สูงสุด ฿1,500", "Up to ฿1,500"),
    ],
    costPoints: 100,
    tierRequired: null,
  },
  {
    n: 8,
    code: "artwork_round",
    kind: "revision_round",
    name: t("แก้แบบเพิ่มฟรี 1 รอบ", "One extra free artwork revision"),
    valueText: t("แก้แบบ", "Revision"),
    conditions: [t("ใช้กับคำสั่งซื้อที่จ้างออกแบบ", "For orders with a design service")],
    costPoints: 40,
    tierRequired: null,
  },
];

const itemId = (fixture: Fixture) => mockId("rwi", fixture.n);
const CANCEL_WINDOW = 7 * DAY;
const VALIDITY_DAYS = 90;
const MAX_OPEN_PER_ITEM = 2;

interface Held {
  id: string;
  code: string;
  source: "catalogue" | "tier_perk";
  pointsSpent: number;
  status: RewardRedemption["status"];
  couponCode: string;
  /** Minutes from now (negative = past), so the fixture stays relative to the clock. */
  createdAt: string;
  expiresAt: string;
  cancellableUntil: string | null;
  usedOrderCode: string | null;
  perkPeriod: string | null;
}

const states = new Map<string, { held: Held[]; seq: number }>();
function stateOf(customer: MockCustomer) {
  if (!states.has(customer.persona)) {
    const reviewCase = customer.ownerIndex !== null;
    states.set(customer.persona, {
      seq: 10,
      held: reviewCase
        ? [
            {
              id: mockId("rwr", 1),
              code: "free_shipping",
              source: "catalogue",
              pointsSpent: 60,
              status: "issued",
              couponCode: "GP-RW-7Q4K-M2XD",
              createdAt: bangkokIso(-2 * DAY),
              expiresAt: bangkokIso(88 * DAY),
              cancellableUntil: bangkokIso(5 * DAY),
              usedOrderCode: null,
              perkPeriod: null,
            },
            {
              id: mockId("rwr", 2),
              code: "free_sample",
              source: "catalogue",
              pointsSpent: 80,
              status: "used",
              couponCode: "GP-RW-2HDA-91KE",
              createdAt: bangkokIso(-50 * DAY),
              expiresAt: bangkokIso(40 * DAY),
              cancellableUntil: null,
              usedOrderCode: "OR-2609-0118",
              perkPeriod: null,
            },
            {
              id: mockId("rwr", 3),
              code: "cash_off_100",
              source: "catalogue",
              pointsSpent: 40,
              status: "expired",
              couponCode: "GP-RW-8LZC-40QN",
              createdAt: bangkokIso(-130 * DAY),
              expiresAt: bangkokIso(-40 * DAY),
              cancellableUntil: null,
              usedOrderCode: null,
              perkPeriod: null,
            },
          ]
        : [],
    });
  }
  return states.get(customer.persona)!;
}

/** Back to the review case — for tests that redeem or cancel. */
export function resetRewardsMock() {
  states.clear();
}

/** The persona's tier, as `store.loyalty.get` reports it (set by `orders.ts`). */
let tierOf: (customer: MockCustomer) => LoyaltyTierP3 = () => "member";
export function setRewardTierSource(source: (customer: MockCustomer) => LoyaltyTierP3) {
  tierOf = source;
}

const TIER_RANK: Record<LoyaltyTierP3, number> = { member: 0, silver: 1, gold: 2, platinum: 3 };
const isOpen = (held: Held) => held.status === "issued";

function blockedOf(fixture: Fixture, customer: MockCustomer) {
  const state = stateOf(customer);
  if (fixture.tierRequired && TIER_RANK[tierOf(customer)] < TIER_RANK[fixture.tierRequired])
    return { reason: "tier" as const };
  if (fixture.everyMonths) {
    const last = state.held
      .filter((held) => held.code === fixture.code && held.source === "catalogue" && held.status !== "cancelled")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (last) {
      const next = new Date(new Date(last.createdAt).getTime() + fixture.everyMonths * 30 * DAY * 60_000);
      if (next.getTime() > Date.now())
        return { reason: "frequency" as const, nextAvailableAt: bangkokIso((next.getTime() - Date.now()) / 60_000) };
    }
  }
  if (state.held.filter((held) => held.code === fixture.code && isOpen(held)).length >= MAX_OPEN_PER_ITEM)
    return { reason: "open_limit" as const };
  if (customer.points < fixture.costPoints)
    return { reason: "insufficient_points" as const, missingPoints: fixture.costPoints - customer.points };
  return null;
}

function itemOf(fixture: Fixture, customer: MockCustomer | null, lang: Lang): RewardItem {
  const blocked = customer ? blockedOf(fixture, customer) : null;
  return {
    id: itemId(fixture),
    code: fixture.code,
    kind: fixture.kind,
    name: fixture.name[lang],
    description: null,
    costPoints: fixture.costPoints,
    valueText: fixture.valueText[lang],
    conditions: fixture.conditions.map((condition) => condition[lang]),
    tierRequired: fixture.tierRequired,
    validityDays: VALIDITY_DAYS,
    canRedeem: customer ? blocked === null : null,
    blockedReason: blocked?.reason ?? null,
    missingPoints: blocked?.reason === "insufficient_points" ? blocked.missingPoints : 0,
    nextAvailableAt: blocked?.reason === "frequency" ? blocked.nextAvailableAt : null,
    cancelWindowDays: CANCEL_WINDOW / DAY,
  };
}

function redemptionOf(held: Held, lang: Lang, balanceAfter: number | null = null): RewardRedemption {
  const fixture = REWARD_FIXTURES.find((candidate) => candidate.code === held.code)!;
  return {
    id: held.id,
    item: { code: fixture.code, name: fixture.name[lang], kind: fixture.kind },
    source: held.source,
    pointsSpent: held.pointsSpent,
    balanceAfter,
    status: held.status,
    coupon: { code: held.couponCode, expiresAt: held.expiresAt },
    // Past the window the API still sends the date; the web stops offering the cancel itself.
    cancellableUntil: held.source === "catalogue" && held.status === "issued" ? held.cancellableUntil : null,
    usedOrderCode: held.usedOrderCode,
    perkPeriod: held.perkPeriod,
    createdAt: held.createdAt,
  };
}

/** The tier perks the persona's tier carries this quarter (D-500), as `store.loyalty.get` lists them. */
export type LoyaltyP3Fields = Pick<
  LoyaltySummaryP3,
  "perks" | "nextTierPerks" | "activeMultipliers" | "maxCombinedMultiplier" | "anniversaryMonth" | "rewardCoupons"
>;

const perk = (code: LoyaltyPerk["code"], extra: Partial<LoyaltyPerk> = {}): LoyaltyPerk => ({
  code,
  status: "active",
  period: null,
  redemptionId: null,
  couponExpiresAt: null,
  ...extra,
});

export function loyaltyP3FieldsOf(customer: MockCustomer, tier: LoyaltyTierP3): LoyaltyP3Fields {
  const quarterly = (code: "quarterly_free_shipping" | "quarterly_free_rush") =>
    perk(code, { status: "next_quarter", period: "2026-Q4" });
  const byTier: Record<LoyaltyTierP3, LoyaltyPerk[]> = {
    member: [],
    silver: [quarterly("quarterly_free_shipping")],
    gold: [perk("free_shipping_every_order"), perk("priority_support")],
    platinum: [
      perk("free_shipping_every_order"),
      perk("priority_support"),
      perk("priority_production_slot"),
      perk("quarterly_free_rush", {
        status: "granted",
        period: "2026-Q4",
        redemptionId: mockId("rwr", 9),
        couponExpiresAt: "2027-01-31T23:59:59+07:00",
      }),
    ],
  };
  const next: Record<LoyaltyTierP3, LoyaltyTierP3 | null> = {
    member: "silver",
    silver: "gold",
    gold: "platinum",
    platinum: null,
  };
  const nextTier = next[tier];
  // The next tier's perks are codes (API-CHANGES-P3 deviation 10).
  const nextPerks = nextTier
    ? byTier[nextTier]
        .filter((candidate) => !byTier[tier].some((own) => own.code === candidate.code))
        .map((candidate) => candidate.code)
    : [];
  const multiplier = { member: "1.00", silver: "1.25", gold: "1.50", platinum: "2.00" }[tier];
  const reviewCase = customer.ownerIndex !== null;
  return {
    perks: byTier[tier],
    nextTierPerks: nextPerks,
    activeMultipliers: [
      ...(tier === "member" ? [] : [{ source: "tier" as const, multiplier }]),
      ...(reviewCase
        ? [
            { source: "anniversary" as const, multiplier: "2.00", endsOn: "2026-11-30" },
            {
              source: "campaign" as const,
              multiplier: "1.50",
              name: "สะสมแต้มกล่องลูกฟูก",
              endsAt: "2026-11-30T23:59:59+07:00",
            },
          ]
        : []),
    ],
    maxCombinedMultiplier: "3.00",
    // Every member has one: the month the account was opened (the review case's is this month).
    anniversaryMonth: reviewCase ? 11 : 3,
    rewardCoupons: stateOf(customer).held.filter(isOpen).length,
  };
}

/** `counts.points` of `/deals`: the active items (every customer and guests see the same catalogue). */
export const REWARD_COUNT = REWARD_FIXTURES.length;

let couponSeq = 4100;
const couponCode = () => {
  couponSeq += 1;
  return `GP-RW-${couponSeq.toString(36).toUpperCase().padStart(4, "0")}-M${(couponSeq % 97).toString().padStart(2, "0")}X`;
};

const json = <T>(body: T, status = 200) => HttpResponse.json(body as never, { status });

export const loyaltyP3Handlers = [
  // store.rewards.list — public: a guest sees costs, no balance, no verdict
  http.get("*/v1/store/rewards", ({ request }) => {
    const customer = customerOf(request);
    const lang = langOf(request);
    return json<Schemas["RewardListDto"]>({
      balance: customer ? customer.points : null,
      items: REWARD_FIXTURES.map((fixture) => itemOf(fixture, customer, lang)),
    });
  }),
  // store.rewards.listMine — newest first, with the tier perk coupons of the persona's tier (paginated)
  http.get("*/v1/store/rewards/redemptions", ({ request }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const lang = langOf(request);
    const query = new URL(request.url).searchParams;
    const status = query.get("status");
    const perks: Held[] =
      tierOf(customer) === "platinum"
        ? [
            {
              id: mockId("rwr", 9),
              code: "free_rush",
              source: "tier_perk",
              pointsSpent: 0,
              status: "issued",
              couponCode: "GP-TP-3HX8-QW71",
              createdAt: "2026-10-01T00:05:00+07:00",
              expiresAt: "2027-01-31T23:59:59+07:00",
              cancellableUntil: null,
              usedOrderCode: null,
              perkPeriod: "2026-Q4",
            },
          ]
        : [];
    const rows = [...stateOf(customer).held, ...perks]
      .filter((held) => !status || held.status === status)
      .map((held) => redemptionOf(held, lang));
    return json(paginate(rows, { page: Number(query.get("page") ?? 1), perPage: Number(query.get("perPage") ?? 50) }));
  }),
  // store.rewards.preview — the API's balance after; nothing is written
  http.get("*/v1/store/rewards/:itemId/preview", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const fixture = REWARD_FIXTURES.find((candidate) => itemId(candidate) === params.itemId);
    if (!fixture) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    const blocked = blockedOf(fixture, customer);
    return json<RewardPreview>({
      costPoints: fixture.costPoints,
      balanceAfter: blocked ? null : customer.points - fixture.costPoints,
      eligible: blocked === null,
      reason: blocked?.reason ?? null,
    });
  }),
  // store.rewards.redeem
  http.post("*/v1/store/rewards/:itemId/actions/redeem", async ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const fixture = REWARD_FIXTURES.find((candidate) => itemId(candidate) === params.itemId);
    if (!fixture) return problem(404, "http.not_found", "ไม่พบรายการนี้");
    const body = (await request.json().catch(() => null)) as Schemas["RedeemRewardDto"] | null;
    if (body?.expectedCostPoints !== undefined && body.expectedCostPoints !== fixture.costPoints)
      return problem(409, "rewards.cost_changed", "จำนวนแต้มที่ใช้แลกเปลี่ยนไปแล้ว");
    const blocked = blockedOf(fixture, customer);
    if (blocked) {
      const codes = {
        insufficient_points: [422, "rewards.insufficient_points", "แต้มไม่พอ"],
        tier: [422, "rewards.tier_required", "ระดับสมาชิกยังไม่ถึง"],
        frequency: [422, "rewards.frequency_limit", "แลกได้อีกครั้งภายหลัง"],
        open_limit: [422, "rewards.open_limit", "มีคูปองนี้ที่ยังไม่ใช้ครบแล้ว"],
      } as const;
      const [status, code, title] = codes[blocked.reason];
      return problem(status, code, title);
    }
    const state = stateOf(customer);
    state.seq += 1;
    customer.points -= fixture.costPoints;
    const held: Held = {
      id: mockId("rwr", state.seq),
      code: fixture.code,
      source: "catalogue",
      pointsSpent: fixture.costPoints,
      status: "issued",
      couponCode: couponCode(),
      createdAt: bangkokIso(0),
      expiresAt: bangkokIso(VALIDITY_DAYS * DAY),
      cancellableUntil: bangkokIso(CANCEL_WINDOW),
      usedOrderCode: null,
      perkPeriod: null,
    };
    state.held.unshift(held);
    return json(redemptionOf(held, langOf(request), customer.points), 201);
  }),
  // store.rewards.cancel — only an issued catalogue coupon, before its window closes
  http.post("*/v1/store/rewards/redemptions/:redemptionId/actions/cancel", ({ request, params }) => {
    const customer = customerOf(request);
    if (!customer) return unauthenticated();
    const held = stateOf(customer).held.find((candidate) => candidate.id === params.redemptionId);
    if (!held) return problem(404, "http.not_found", "ไม่พบคูปองนี้");
    if (held.source !== "catalogue") return problem(409, "rewards.not_cancellable", "สิทธิ์ตามระดับยกเลิกไม่ได้");
    if (held.status === "used") return problem(409, "rewards.coupon_used", "คูปองนี้ใช้ไปแล้ว");
    if (held.status !== "issued" || !held.cancellableUntil || held.cancellableUntil < bangkokIso(0))
      return problem(409, "rewards.cancel_window_closed", "พ้นช่วงที่ยกเลิกได้แล้ว");
    held.status = "cancelled";
    customer.points += held.pointsSpent;
    return json(redemptionOf(held, langOf(request)));
  }),
];
