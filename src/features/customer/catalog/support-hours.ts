import type { Schemas } from "@/lib/api/types";

/**
 * CS / LINE answering hours in words (D-447, DECISIONS-STAGE-A §11.7): built per locale from the
 * structured setting `storefront.support_hours` (`PublicConfigDto.supportHours`), never from the
 * Thai-only text of `storefront.support_channels`. Pure — the caller passes the locale's words.
 */
export type SupportHours = Schemas["SupportHoursDto"];
export type SupportDays = SupportHours["days"];

export function formatSupportHours(
  hours: SupportHours | null | undefined,
  words: { days: (days: SupportDays) => string; text: (parts: { days: string; open: string; close: string }) => string },
): string | null {
  if (!hours || !hours.open || !hours.close) return null;
  return words.text({ days: words.days(hours.days), open: hours.open, close: hours.close });
}

const SCHEMA_DAYS: Record<SupportDays, string | null> = {
  daily: "Mo-Su",
  mon_fri: "Mo-Fr",
  mon_sat: "Mo-Sa",
  // Working days of the national calendar (D-161) have no schema.org form: left out.
  business_days: null,
};

/** schema.org `openingHours` (`Mo-Su 09:00-18:00`), or null when the days have no such form. */
export function schemaOpeningHours(hours: SupportHours | null | undefined): string | null {
  if (!hours) return null;
  const days = SCHEMA_DAYS[hours.days];
  return days ? `${days} ${hours.open}-${hours.close}` : null;
}
