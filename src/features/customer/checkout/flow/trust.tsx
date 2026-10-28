"use client";

import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import type { CartItem } from "@/features/customer/cart/cart";

import type { TrustLine } from "./OrderSummary";

/**
 * The latest earliest-ship date of the lines (the API's dates, compared as text — nothing is computed): the cart is
 * ready to ship once its last line is. Null when a line has none.
 */
export function readyDateOf(items: readonly Pick<CartItem, "earliestShipDate">[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    if (!item.earliestShipDate) return null;
    if (latest === null || item.earliestShipDate > latest) latest = item.earliestShipDate;
  }
  return latest;
}

/** The production working days after artwork approval (GLOBAL-RULES §6, from data) — the longest line's. */
export function leadDaysOf(items: readonly Pick<CartItem, "leadTimeDays">[]): number | null {
  if (items.length === 0 || items.some((item) => item.leadTimeDays === null)) return null;
  return Math.max(...items.map((item) => item.leadTimeDays!));
}

/**
 * The summary's trust lines (checkout redesign item 6): when it can ship (or how long production takes), the work
 * guarantee and its tolerance (decided copy, GLOBAL-RULES §6), and the payment methods the preview offers. A line
 * whose data is missing is left out.
 */
export function useTrustLines({
  items,
  readyDate,
  methods,
}: {
  items: readonly CartItem[];
  /** The estimate's / preview's ready date when known, else the lines'. */
  readyDate?: string | null;
  /** Names of the methods offered now; none → no methods line. */
  methods?: readonly string[];
}): TrustLine[] {
  const t = useTranslations("checkout.flow.summary");
  const format = useFormat();
  const locale = useLocale();
  const ready = readyDate ?? readyDateOf(items);
  const lead = leadDaysOf(items);
  return [
    ...(ready
      ? [{ icon: "truck" as const, text: t("ready", { date: format.date(ready) }) }]
      : lead !== null
        ? [{ icon: "truck" as const, text: t("production", { days: lead }) }]
        : []),
    { icon: "shield-check" as const, text: t("warranty") },
    ...(methods && methods.length > 0
      ? [
          {
            icon: "lock" as const,
            text: t("methods", { list: new Intl.ListFormat(locale, { type: "disjunction" }).format(methods) }),
          },
        ]
      : []),
  ];
}
