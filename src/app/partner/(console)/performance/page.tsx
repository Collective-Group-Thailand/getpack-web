import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ScoreChart } from "@/features/partner/account/actions";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.performance"))("title") };
}

const METRICS = [
  ["acceptance", "onTimeAcceptancePct"],
  ["shipping", "onTimeShippingPct"],
  ["firstPass", "qcFirstPassPct"],
  ["claims", "claimRatePct"],
  ["updates", "onTimeUpdatesPct"],
] as const;

/**
 * The factory's own monthly scorecard (D-155, `partner.production.scorecards`) — the same numbers
 * Packio's allocation weighs (D-075): this month so far, the last full month, and the trend.
 */
export default async function PerformancePage() {
  const t = await getTranslations("partnerAccount.performance");
  const format = await getFormat();
  const context = await factoryContext();
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
  const shown = last ?? current;

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {shown ? (
        <PartnerSection
          title={t("monthTitle", { month: monthLabel(shown.month) })}
          description={t("jobs", { count: shown.jobsCount })}
        >
          <PartnerTable
            caption={t("monthTitle", { month: monthLabel(shown.month) })}
            rows={[...METRICS]}
            rowKey={([key]) => key}
            columns={[
              {
                key: "metric",
                header: t("table.metric"),
                primary: true,
                cell: ([key]) => <span className="font-medium">{t(`metrics.${key}`)}</span>,
              },
              {
                key: "value",
                header: t("table.value"),
                align: "end",
                cell: ([key, field]) => {
                  const value = shown[field];
                  // The same lines the old tiles were coloured by: under 85% (over 3% for claims) needs a look.
                  const weak = key === "claims" ? Number(value ?? 0) > 3 : Number(value ?? 100) < 85;
                  return (
                    <span className={cn("font-semibold", weak ? "text-warning-subtle-fg" : "text-success-subtle-fg")}>
                      {value === null ? "—" : format.percent(value)}
                    </span>
                  );
                },
              },
              {
                key: "meaning",
                header: t("table.meaning"),
                cell: ([key]) => <span className="text-muted">{t(`hints.${key}`)}</span>,
              },
            ]}
          />
        </PartnerSection>
      ) : null}
      {current && last ? (
        <p className="text-muted text-sm">
          {t("currentNote", { month: monthLabel(current.month) })}{" "}
          {t("computedAt", { date: format.dateTime(current.computedAt) })}
        </p>
      ) : null}
      <PartnerSection title={t("trend")}>
        {cards.data.length >= 2 ? (
          <ScoreChart
            months={cards.data}
            monthLabels={Object.fromEntries(cards.data.map((item) => [item.month, monthLabel(item.month)]))}
          />
        ) : (
          // One month is a point, not a trend: say when the line will appear instead of an empty frame.
          <p className="border-border text-muted rounded-xl border border-dashed p-4 text-sm">{t("trendSoon")}</p>
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
