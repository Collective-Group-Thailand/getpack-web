import { getLocale, getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { cn } from "@/ui/lib/cn";

const BANGKOK = "Asia/Bangkok";

/**
 * "ทีมออนไลน์อยู่ตอนนี้" / "กลับมาตอบ 09:00 น." (business pack Phase 2 item 1): computed by the API in Asia/Bangkok
 * from the configured support hours and the national calendar (`store.support.contactOptions`, D-458); this only
 * words it. Hidden when the hours are not set.
 */
export async function TeamStatus({
  status,
  hours,
}: {
  status: Schemas["SupportTeamStatusDto"] | null;
  hours: string | null;
}) {
  if (!status) return null;
  const [t, locale] = await Promise.all([getTranslations("help.contact.status"), getLocale()]);
  const tag = locale === "en" ? "en-GB" : "th-TH";
  let line: string;
  if (status.openNow) line = t("open");
  else if (status.nextOpenAt) {
    const at = new Date(status.nextOpenAt);
    const time = new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: BANGKOK,
    }).format(at);
    const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK }).format(date);
    line =
      day(at) === day(new Date())
        ? t("closed", { time })
        : t("closedDay", {
            day: new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: BANGKOK }).format(at),
            time,
          });
  } else return null;
  return (
    <div
      role="status"
      className="border-border bg-surface rounded-panel flex items-center gap-3 border px-4 py-3.5 lg:mb-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-3 shrink-0 rounded-full",
          status.openNow ? "bg-success ring-success/25 ring-4 motion-safe:animate-pulse" : "bg-subtle",
        )}
      />
      <span>
        <b className="block font-semibold">{line}</b>
        {hours ? <small className="text-subtle block text-[12.5px]">{t("hours", { hours })}</small> : null}
      </span>
    </div>
  );
}
