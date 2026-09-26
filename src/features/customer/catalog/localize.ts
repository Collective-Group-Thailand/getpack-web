import type { Locale } from "@/i18n/routing";

/**
 * The API sends both languages (`nameTh`, `nameEn`); English falls back to Thai, which is the
 * language every record is guaranteed to have.
 */
export function pick(locale: Locale | string, th: string, en: string | null | undefined): string {
  return locale === "en" && en ? en : th;
}
