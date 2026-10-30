import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TrendChart } from "@/features/partner/charts";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.performance"))("title") };
}

const METRICS = [
  ["acceptance", "onTimeAcceptancePct"],
  ["shipping", "onTimeShippingPct"],
  ["firstPass", "qcFirstPassPct"],
  ["updates", "onTimeUpdatesPct"],
  ["claims", "claimRatePct"],
] as const;

/**
 * The factory's own monthly scorecard (D-155, `partner.production.scorecards`): one card per measure — the last
 * full month's figure, its line over the months on record, and what it is measured from in a fold. Every card is
 * drawn the same way (no red/green verdict): the figures speak, the line shows the direction.
 */
export default async function PerformancePage() {
  const [t, format, context] = await Promise.all([
    getTranslations("partnerAccount.performance"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const cards = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/scorecards", {
          params: { path: { factoryId: context.factoryId }, query: { months: 6 } },
        })
      ).data ?? [],
  );
  if (!cards.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={cards.error} />
      </PartnerPage>
    );
  const [current, last] = cards.data;
  // `month` is the first day of the month (`ScorecardDto`); mid-month keeps every zone in the same month.
  const monthLabel = (month: string) => format.date(`${month.slice(0, 7)}-15`, { style: "month" });
  const shortMonth = (month: string) =>
    new Intl.DateTimeFormat(format.locale === "en" ? "en-GB" : "th-TH", { month: "short", timeZone: "UTC" }).format(
      new Date(`${month.slice(0, 7)}-15T00:00:00Z`),
    );
  const shown = last ?? current;
  const oldestFirst = [...cards.data].reverse();
  const trend = cards.data.length >= 2;

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {shown ? (
        <PartnerSection
          id="scorecard"
          title={t("monthTitle", { month: monthLabel(shown.month) })}
          description={t("jobs", { count: shown.jobsCount })}
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:max-lg:[&>li:last-child]:col-span-2">
            {METRICS.map(([key, field]) => {
              const value = shown[field];
              const values = oldestFirst.map((m) => (m[field] === null ? null : Number(m[field])));
              // Claims are a small rate: their own scale, so a 2% month is not drawn as a flat line on the floor.
              const max = key === "claims" ? Math.max(5, Math.ceil(Math.max(0, ...values.map((v) => v ?? 0)))) : 100;
              return (
                <li
                  key={key}
                  className="rounded-card border-border bg-surface flex min-w-0 flex-col gap-3 border p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="text-muted text-sm font-medium">{t(`metrics.${key}`)}</h3>
                    <p className="text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums">
                      {value === null ? "—" : format.percent(value)}
                    </p>
                  </div>
                  {trend ? (
                    <TrendChart
                      title={t(`metrics.${key}`)}
                      height={72}
                      max={max}
                      ticks={[0, max]}
                      formatTick={(tick) => format.percent(String(tick), 0)}
                      points={oldestFirst.map((m, at) => ({
                        key: m.month,
                        label: shortMonth(m.month),
                        value: values[at] ?? null,
                        display: m[field] === null ? "—" : format.percent(m[field]),
                      }))}
                    />
                  ) : null}
                  <details className="group border-border mt-auto border-t pt-2">
                    <summary className="text-muted hover:text-fg focus-visible:ring-focus-ring flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-2 md:min-h-8 [&::-webkit-details-marker]:hidden">
                      {t("table.meaning")}
                      <Icon
                        name="chevron-down"
                        size={16}
                        aria-hidden="true"
                        className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      />
                    </summary>
                    <p className="pt-1 pb-1 text-sm text-pretty">{t(`hints.${key}`)}</p>
                  </details>
                </li>
              );
            })}
          </ul>
        </PartnerSection>
      ) : null}
      <div className="text-muted flex flex-col gap-1 text-sm">
        {current && last ? (
          <p>
            {t("currentNote", { month: monthLabel(current.month) })}{" "}
            {t("computedAt", { date: format.dateTime(current.computedAt) })}
          </p>
        ) : null}
        {trend ? null : <p>{t("trendSoon")}</p>}
      </div>
    </PartnerPage>
  );
}
