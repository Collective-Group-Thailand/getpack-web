/**
 * The redeem page's own rules (loyalty P3, D-498): how the catalogue is grouped, which reason a blocked item shows,
 * what a coupon's stub says, and whether a coupon may still be cancelled. Everything else is the API's: costs, the
 * balance, whether an item can be redeemed and why not, the dates.
 *
 * The one figure the web works out is the confirm sheet's "คงเหลือ": the balance less the cost, two integers the API
 * sent, shown before the redeem; the success state shows the API's own `balanceAfter` (WEB-P3-NOTES §3).
 */

import type {
  RedemptionStatus,
  RewardBlockedReason,
  RewardItem,
  RewardKind,
  RewardRedemption,
} from "@/lib/api/requests/store-loyalty-p3";

export const REWARD_GROUPS = ["cash", "perks"] as const;
export type RewardGroup = (typeof REWARD_GROUPS)[number];

export const groupOf = (kind: RewardKind): RewardGroup => (kind === "cash_off" ? "cash" : "perks");

/** The catalogue split into "ส่วนลดค่าสินค้า" and "สิทธิพิเศษ", each in the API's order; empty groups are dropped. */
export function groupRewards(items: readonly RewardItem[]): { group: RewardGroup; items: RewardItem[] }[] {
  return REWARD_GROUPS.map((group) => ({ group, items: items.filter((item) => groupOf(item.kind) === group) })).filter(
    (entry) => entry.items.length > 0,
  );
}

/** The reason a signed-in customer cannot redeem, or null. A guest's item carries none (`canRedeem` is null). */
export function blockedReasonOf(item: RewardItem): RewardBlockedReason | null {
  if (item.canRedeem !== false) return null;
  return item.blockedReason ?? "held";
}

/** The icon beside each reason: never `warning` (a reason is information, not an error). */
export const BLOCKED_ICON = {
  insufficient_points: "info",
  tier: "lock",
  frequency: "clock",
  open_limit: "wallet",
  held: "shield",
} as const satisfies Record<RewardBlockedReason, string>;

/** The confirm sheet's preview of the balance after the redeem (two API integers); never below zero. */
export function balanceAfter(balance: number, cost: number): number {
  return Math.max(0, balance - cost);
}

/** The coupon's stub word per kind — short enough for the 64 px stub. */
export const STUB_WORD: Record<RewardKind, string> = {
  cash_off: "cash",
  free_shipping: "shipping",
  free_sample: "sample",
  free_rush: "rush",
  free_addon: "upgrade",
  revision_round: "revision",
};

/** Whether "ยกเลิกการแลก" is offered: a catalogue coupon, unused, before its window closes (the API decides the rest). */
export function isCancellable(redemption: RewardRedemption, now: number): boolean {
  if (redemption.source !== "catalogue" || redemption.status !== "issued" || !redemption.cancellableUntil) return false;
  return Date.parse(redemption.cancellableUntil) > now;
}

export const COUPON_TABS = ["issued", "used", "expired", "cancelled"] as const satisfies readonly RedemptionStatus[];

/** How many coupons each tab holds, from the list the API sent. */
export function countByStatus(redemptions: readonly RewardRedemption[]): Record<RedemptionStatus, number> {
  const counts: Record<RedemptionStatus, number> = { issued: 0, used: 0, expired: 0, cancelled: 0 };
  for (const redemption of redemptions) counts[redemption.status] += 1;
  return counts;
}

/** `2026-Q4` → `{ quarter: 4, year: 2026 }`, for "ไตรมาส 4/2569"; null for anything else. */
export function quarterOf(period: string | null | undefined): { quarter: number; year: number } | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(period ?? "");
  return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
}

/** The anchor a `/deals` reward card links to (`/account/points/redeem#free_shipping`). */
export const redeemHref = (code: string) => `/account/points/redeem#${code}`;
