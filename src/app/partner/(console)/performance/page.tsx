import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ScoreChart } from "@/features/partner/account/actions";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.performance"))("title") };
}

const METRICS = [
  ["acceptance", "onTimeAcceptancePct", "check"],
  ["shipping", "onTimeShippingPct", "truck"],
  ["firstPass", "qcFirstPassPct", "clipboard-check"],
  ["claims", "claimRatePct", "shield-alert"],
  ["updates", "onTimeUpdatesPct", "refresh"],
] as const;

/**
 * The factory's own monthly scorecard (D-155) — the same numbers Packio's allocation weighs
 * (D-075): this month so far, the last full month, and the trend.
 */
export default async function PerformancePage() {
  const t = await getTranslations("partnerAccount.performance");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const cards = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/scorecards", {
      path: { factoryId: context.factoryId },
      query: { months: 6 },
    }),
  );
  if (!cards.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={cards.error} />
      </PartnerPage>
    );
  const [current, last] = cards.data;
  const monthLabel = (month: string) => format.date(`${month}-15`, { style: "month" });
  const shown = last ?? current;

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {shown ? (
        <PartnerSection
          title={t("monthTitle", { month: monthLabel(shown.month) })}
          description={t("jobs", { count: shown.jobsCount })}
        >
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {METRICS.map(([key, field, icon]) => (
              <li key={key}>
                <Stat
                  label={t(`metrics.${key}`)}
                  value={shown[field] === null ? "—" : format.percent(shown[field])}
                  icon={icon}
                  hint={t(`hints.${key}`)}
                  tone={
                    key === "claims"
                      ? Number(shown[field] ?? 0) > 3
                        ? "danger"
                        : "neutral"
                      : Number(shown[field] ?? 100) < 85
                        ? "warning"
                        : "success"
                  }
                />
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      {current && last ? (
        <p className="text-muted text-sm">{t("currentNote", { month: monthLabel(current.month) })}</p>
      ) : null}
      <PartnerSection title={t("trend")}>
        <ScoreChart
          months={cards.data}
          monthLabels={Object.fromEntries(cards.data.map((item) => [item.month, monthLabel(item.month)]))}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
