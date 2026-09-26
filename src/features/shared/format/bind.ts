import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTHB,
  type DateFormatOptions,
} from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

/** Every formatter, with the locale already applied. Money stays a string throughout. */
export function bindFormat(locale: Locale) {
  return {
    locale,
    thb: (amount: string | null | undefined) =>
      amount === null || amount === undefined ? "—" : formatTHB(amount, locale),
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    percent: (value: string | null | undefined, maxDecimals?: number) =>
      value === null || value === undefined ? "—" : formatPercent(value, locale, maxDecimals),
    date: (value: string | null | undefined, options?: DateFormatOptions) =>
      value ? formatDate(value, locale, options) : "—",
    dateTime: (value: string | null | undefined, options?: DateFormatOptions) =>
      value ? formatDateTime(value, locale, options) : "—",
    relative: (value: string | null | undefined, now?: number) =>
      value ? formatRelativeTime(value, locale, now) : "—",
    duration: (milliseconds: number) => formatDuration(milliseconds, locale),
    bytes: (bytes: number) => formatBytes(bytes, locale),
  };
}

export type BoundFormat = ReturnType<typeof bindFormat>;
