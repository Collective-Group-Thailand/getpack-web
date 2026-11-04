/**
 * Sample rewards for stories and tests — the API-CHANGES-P3 samples and the UAT seed's items, in Thai. Not used by any
 * screen (the mock API has its own, `mocks/store/loyalty-p3.ts`).
 */

import type { LoyaltySummaryP3 } from "@/features/shared/loyalty-p3/read";
import type { RewardItem, RewardList, RewardRedemption } from "@/lib/api/requests/store-loyalty-p3";

const base = {
  description: null,
  tierRequired: null,
  validityDays: 90,
  canRedeem: true,
  blockedReason: null,
  missingPoints: 0,
  nextAvailableAt: null,
} satisfies Partial<RewardItem>;

const id = (n: number) => `0192f3a0-7c1e-7d2a-9b1f-0000000e${String(n).padStart(4, "0")}`;

export const SAMPLE_REWARDS: RewardItem[] = [
  {
    ...base,
    id: id(1),
    code: "cash_off_50",
    kind: "cash_off",
    name: "ส่วนลด ฿50",
    costPoints: 20,
    valueText: "ลด ฿50",
    conditions: ["ขั้นต่ำ ฿250"],
  },
  {
    ...base,
    id: id(2),
    code: "cash_off_100",
    kind: "cash_off",
    name: "ส่วนลด ฿100",
    costPoints: 40,
    valueText: "ลด ฿100",
    conditions: ["ขั้นต่ำ ฿500"],
  },
  {
    ...base,
    id: id(4),
    code: "free_shipping",
    kind: "free_shipping",
    name: "ส่งฟรี 1 คำสั่งซื้อ",
    costPoints: 60,
    valueText: "ส่งฟรี",
    conditions: ["ขั้นต่ำ ฿2,000"],
  },
  {
    ...base,
    id: id(5),
    code: "free_sample",
    kind: "free_sample",
    name: "ตัวอย่างฟรี 1 ชิ้นงาน",
    costPoints: 80,
    valueText: "ตัวอย่างฟรี",
    conditions: ["สูงสุด ฿500", "1 ครั้งต่อ 3 เดือน"],
    canRedeem: false,
    blockedReason: "frequency",
    nextAvailableAt: "2027-01-12T10:00:00+07:00",
  },
  {
    ...base,
    id: id(6),
    code: "free_rush",
    kind: "free_rush",
    name: "ผลิตด่วนฟรี (ตามคิว)",
    costPoints: 120,
    valueText: "ผลิตด่วน",
    conditions: ["เร็วขึ้น 2 วันทำการ เมื่อคิวผลิตรับได้"],
  },
];

/** One item per blocked reason, for the review states. */
export const BLOCKED_REWARDS: RewardItem[] = [
  { ...SAMPLE_REWARDS[2]!, id: id(21), canRedeem: false, blockedReason: "insufficient_points", missingPoints: 12 },
  { ...SAMPLE_REWARDS[4]!, id: id(22), canRedeem: false, blockedReason: "tier", tierRequired: "gold" },
  { ...SAMPLE_REWARDS[1]!, id: id(23), canRedeem: false, blockedReason: "open_limit" },
  { ...SAMPLE_REWARDS[0]!, id: id(24), canRedeem: false, blockedReason: "held" },
];

export const SAMPLE_LIST: RewardList = { balance: 1250, items: SAMPLE_REWARDS, cancelWindowDays: 7 };

export const SAMPLE_REDEMPTIONS: RewardRedemption[] = [
  {
    id: "0192f3a0-7c1e-7d2a-9b1f-0000000e1001",
    item: { code: "free_shipping", name: "ส่งฟรี 1 คำสั่งซื้อ", kind: "free_shipping", valueText: "ส่งฟรี" },
    source: "catalogue",
    pointsSpent: 60,
    status: "issued",
    coupon: { code: "GP-RW-7Q4K-M2XD", expiresAt: "2027-02-02T23:59:59+07:00" },
    cancellableUntil: "2026-11-11T14:05:00+07:00",
    usedOrderCode: null,
    perkPeriod: null,
    createdAt: "2026-11-04T14:05:00+07:00",
  },
  {
    id: "0192f3a0-7c1e-7d2a-9b1f-0000000e1002",
    item: { code: "free_rush", name: "ผลิตด่วนฟรี (ตามคิว)", kind: "free_rush", valueText: "ผลิตด่วน" },
    source: "tier_perk",
    pointsSpent: 0,
    status: "issued",
    coupon: { code: "GP-TP-3HX8-QW71", expiresAt: "2027-01-31T23:59:59+07:00" },
    cancellableUntil: null,
    usedOrderCode: null,
    perkPeriod: "2026-Q4",
    createdAt: "2026-10-01T00:05:00+07:00",
  },
  {
    id: "0192f3a0-7c1e-7d2a-9b1f-0000000e1003",
    item: { code: "free_sample", name: "ตัวอย่างฟรี 1 ชิ้นงาน", kind: "free_sample", valueText: "ตัวอย่างฟรี" },
    source: "catalogue",
    pointsSpent: 80,
    status: "used",
    coupon: { code: "GP-RW-2HDA-91KE", expiresAt: "2026-12-14T23:59:59+07:00" },
    cancellableUntil: null,
    usedOrderCode: "OR-2609-0118",
    perkPeriod: null,
    createdAt: "2026-09-15T10:00:00+07:00",
  },
];

/** The moment the samples are read at: inside the free-shipping coupon's cancel window. */
export const SAMPLE_NOW = Date.parse("2026-11-05T10:00:00+07:00");

export const SAMPLE_POINTS = {
  multiplier: "2.00",
  spend12m: "612400.00",
  nextTierMinSpend12m: null,
  nextTierProgressPct: "100.00",
  spendBasisTh: "นับยอดเมื่อคำสั่งซื้อเสร็จสิ้นหลังได้รับของ · ยอดก่อน VAT ไม่รวมค่าส่ง · ย้อนหลัง 12 เดือน",
  spendBasisEn: "Counts orders once completed after delivery · before VAT, without shipping · last 12 months",
  spendNotYetCounted: "0.00",
};

export const PLATINUM: LoyaltySummaryP3 = {
  tier: "platinum",
  nextTier: null,
  perks: [
    { code: "free_shipping_every_order", status: "active" },
    { code: "priority_support", status: "active" },
    { code: "priority_production_slot", status: "active" },
    {
      code: "quarterly_free_rush",
      status: "granted",
      period: "2026-Q4",
      redemptionId: "0192f3a0-7c1e-7d2a-9b1f-0000000e1002",
      couponExpiresAt: "2027-01-31T23:59:59+07:00",
    },
  ],
  nextTierPerks: [],
  activeMultipliers: [
    { source: "tier", multiplier: "2.00" },
    { source: "anniversary", multiplier: "2.00", endsOn: "2026-11-30" },
    { source: "campaign", multiplier: "1.50", name: "สะสมแต้มกล่องลูกฟูก", endsAt: "2026-11-30T23:59:59+07:00" },
  ],
  maxCombinedMultiplier: "3.00",
  anniversaryMonth: 11,
  rewardCoupons: 2,
};

export const GOLD_POINTS = {
  ...SAMPLE_POINTS,
  multiplier: "1.50",
  spend12m: "325000.00",
  nextTierMinSpend12m: "500000.00",
  nextTierProgressPct: "65.00",
};

export const GOLD: LoyaltySummaryP3 = {
  ...PLATINUM,
  tier: "gold",
  nextTier: "platinum",
  perks: [
    { code: "free_shipping_every_order", status: "active" },
    { code: "priority_support", status: "active" },
  ],
  nextTierPerks: [
    { code: "priority_production_slot", status: "next_quarter" },
    { code: "quarterly_free_rush", status: "next_quarter" },
  ],
  activeMultipliers: [{ source: "tier", multiplier: "1.50" }],
};
