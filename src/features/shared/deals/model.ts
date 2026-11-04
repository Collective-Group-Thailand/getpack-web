/**
 * Loyalty P1.5: the deal surface's rules that are the web's (everything else is the API's). Pure, so the tests and
 * every surface — the storefront, LIFF and the admin preview — read the same answer. Money is never computed:
 * savings are compared as decimal strings, and every figure shown is the API's, formatted.
 */

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { ApplicableCode, Deal } from "./types";

/** What the stub shows: a small word, the figure, and the cap on the same baseline. */
export interface StubValue {
  /** "ลด", "ลดสูงสุด" (tiered: the top tier), "แต้ม", or none for a word value ("ส่งฟรี"). */
  word: "off" | "upTo" | "points" | null;
  /** The figure as text, already formatted: "10%", "฿300", "×2", or a word ("ส่งฟรี", "สิทธิพิเศษ"). */
  figure: { kind: "number"; text: string } | { kind: "word"; key: "freeShipping" | "perk" };
  /** "สูงสุด ฿1,500": the formatted cap amount, or null. */
  cap: string | null;
}

/** "฿300" for "300.00", "฿12.50" for "12.50": a stub drops zero satang, it never rounds. */
export function thbCompact(amount: string, locale: Locale): string {
  return formatTHB(amount, locale, /\.0+$/.test(amount.trim()) ? { decimals: 0 } : {});
}

export function stubValue(
  benefit: Deal["benefit"],
  format: { thbWhole: (amount: string) => string; percent: (value: string) => string },
): StubValue {
  const cap = benefit.maxDiscount ? format.thbWhole(benefit.maxDiscount) : null;
  const value = benefit.value;
  switch (benefit.kind) {
    case "percent":
      if (value === null) break;
      return { word: "off", figure: { kind: "number", text: format.percent(value) }, cap };
    case "amount":
      if (value === null) break;
      return { word: "off", figure: { kind: "number", text: format.thbWhole(value) }, cap };
    case "tiered":
      // The API's value is the top tier: a percent ("15") or an amount ("500.00").
      if (value === null) break;
      return {
        word: "upTo",
        figure: { kind: "number", text: value.includes(".") ? format.thbWhole(value) : format.percent(value) },
        cap,
      };
    case "points_multiplier":
      if (value === null) break;
      return { word: "points", figure: { kind: "number", text: `×${value}` }, cap: null };
    case "free_shipping":
      return { word: null, figure: { kind: "word", key: "freeShipping" }, cap };
    case "perk":
      break;
  }
  // A perk (special unit price, free design / mock-up / revision rounds, bonus points), or a figure the API left
  // out: a word on the stub; the ticket's headline and `summary` say which.
  return { word: null, figure: { kind: "word", key: "perk" }, cap: null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days left before `endsAt`, counted up ("เหลือ 2 วัน" for 30 hours) — shown only when the API says the deal
 * is ending soon (< 72 h, D-481), as a static label. Null without an end or once it has passed.
 */
export function daysLeft(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null;
  const left = Date.parse(endsAt) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  return Math.max(1, Math.ceil(left / DAY_MS));
}

/** The card's state, from the deal and who is looking. */
export type DealState = "guest" | "claimable" | "saved" | "used" | "ineligible" | "automatic";

export function dealState(deal: Pick<Deal, "code" | "myStatus">, signedIn: boolean): DealState {
  if (deal.myStatus === "used") return "used";
  if (deal.myStatus === "not_eligible") return "ineligible";
  if (!deal.code) return "automatic";
  if (deal.myStatus === "saved") return "saved";
  return signedIn ? "claimable" : "guest";
}

/** The deal the page leads with: the first the API marks featured (its order), else none. */
export function featuredDeal<T extends Pick<Deal, "featured">>(deals: readonly T[]): T | null {
  return deals.find((entry) => entry.featured) ?? null;
}

/* ------------------------------------------------------------------------------------- cart picker */

/**
 * Compares two non-negative decimal strings ("1331.00", "250.00") without turning them into numbers: longer whole
 * part first, then digit by digit. Returns > 0 when `a` is larger.
 */
export function compareDecimal(a: string, b: string): number {
  const [aWhole = "0", aFraction = ""] = a.trim().split(".");
  const [bWhole = "0", bFraction = ""] = b.trim().split(".");
  const aw = aWhole.replace(/^0+(?=\d)/, "");
  const bw = bWhole.replace(/^0+(?=\d)/, "");
  if (aw.length !== bw.length) return aw.length - bw.length;
  if (aw !== bw) return aw < bw ? -1 : 1;
  const width = Math.max(aFraction.length, bFraction.length);
  const af = aFraction.padEnd(width, "0");
  const bf = bFraction.padEnd(width, "0");
  return af === bf ? 0 : af < bf ? -1 : 1;
}

/** The picker's order: the API's best first, then the larger saving, then the code — stable for equal rows. */
export function sortApplicable<T extends Pick<ApplicableCode, "best" | "saving" | "code">>(codes: readonly T[]): T[] {
  return [...codes].sort(
    (a, b) => Number(b.best) - Number(a.best) || compareDecimal(b.saving, a.saving) || a.code.localeCompare(b.code),
  );
}

export type PickerRowState =
  { kind: "applied" } | { kind: "available" } | { kind: "conflict"; with: string } | { kind: "full"; max: number };

/**
 * Whether a row can be ticked: ticked when the cart holds it; blocked when it cannot stack with a code the cart holds
 * (the API's `conflictsWith`, either side); blocked when the cart already holds `maxCodes` (D-452).
 */
export function pickerRowState(
  row: Pick<ApplicableCode, "code" | "conflictsWith">,
  held: readonly string[],
  all: readonly Pick<ApplicableCode, "code" | "conflictsWith">[],
  maxCodes: number,
): PickerRowState {
  if (held.includes(row.code)) return { kind: "applied" };
  const clash = held.find(
    (code) =>
      row.conflictsWith.includes(code) || all.find((other) => other.code === code)?.conflictsWith.includes(row.code),
  );
  if (clash) return { kind: "conflict", with: clash };
  if (held.length >= maxCodes) return { kind: "full", max: maxCodes };
  return { kind: "available" };
}
