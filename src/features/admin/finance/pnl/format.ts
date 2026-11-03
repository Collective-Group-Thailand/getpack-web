"use client";

import { useLocale } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

import type { PnlLine } from "./resources";

/** A true minus sign: a finance grid's negatives read as numbers, not as hyphenated words. */
const minus = (text: string) => text.replace(/^-/, "−");

/**
 * How the planner prints its figures (D-472): the API's decimal strings, never re-computed — money with two places and
 * no ฿ in the grid (the unit sits in the header), percentages and days as the API rounded them. Labels and tooltip
 * texts in the reader's language, falling back to Thai where the catalogue has no English yet (`en: null`).
 */
export function usePnlFormat() {
  const format = useFormat();
  const locale = useLocale() as Locale;
  const plain = (value: string | null | undefined) =>
    value === null || value === undefined ? "—" : minus(formatTHB(value, locale, { withSymbol: false }));
  return {
    locale,
    plain,
    /** A cell or total by the line's unit. */
    value(line: Pick<PnlLine, "unit">, value: string | null | undefined): string {
      if (value === null || value === undefined) return "—";
      if (line.unit === "percent") return minus(format.percent(value));
      return plain(value);
    },
    /** Money with the baht sign, for the summary strip and tooltips. */
    thb: (value: string | null | undefined) => (value === null || value === undefined ? "—" : minus(format.thb(value))),
    percent: (value: string | null | undefined) =>
      value === null || value === undefined ? "—" : minus(format.percent(value)),
    /** `2026-03` → "มี.ค. 2569" / "Mar 2026". */
    month: (month: string) => format.date(`${month}-15T12:00:00+07:00`, { style: "month" }),
    /** The plan year as the reader counts it: Buddhist era in Thai, as legacy showed it. */
    year: (year: number) => String(locale === "th" ? year + 543 : year),
    dateTime: (value: string | null | undefined) => format.dateTime(value),
    label: (line: Pick<PnlLine, "labelTh" | "labelEn">) => (locale === "th" ? line.labelTh : line.labelEn),
    /** A catalogue text; English falls back to Thai until Finance writes it (recorded in DESIGN-NOTES P6). */
    text: (value: { th: string; en: string | null } | null | undefined) =>
      value ? (locale === "th" ? value.th : (value.en ?? value.th)) : null,
  };
}

export type PnlFormat = ReturnType<typeof usePnlFormat>;
