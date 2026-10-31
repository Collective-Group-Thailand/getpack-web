"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Skeleton } from "@/ui/components/Skeleton";

import { QueryError, Section } from "../console";
import { JourneyExport } from "./AnalyticsExtras";
import { aboveBefore, FunnelSteps } from "./FunnelSteps";
import type { Period } from "./period";

type Journey = Schemas["ScorecardJourney"];
type WeekCheck = Schemas["JourneyWeekCheckDto"];

/**
 * The UX scorecard's journeys (`admin.analytics.journeys`, getpack-api U5.B6, D-303): sessions at
 * each step of one journey in the period, the share that went on from the step before, and the
 * Monday check of the last week against the week before. The journeys, their steps and whether a
 * drop is alarming are all the API's — the screen shows them and compares nothing itself.
 */
export function JourneyFunnels({ period }: { period: Period | null }) {
  const t = useTranslations("analytics.journeys");
  const format = useFormat();
  const [journey, setJourney] = useState<Journey>("discovery_price");

  const report = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "journeys", ...period }),
    queryFn: async () => (await browserApi().GET("/v1/admin/analytics/journeys", { params: { query: period! } })).data!,
    enabled: period !== null,
  });
  const data = report.data;
  const funnel = data?.journeys.find((entry) => entry.journey === journey);
  const checks = data?.weekChecks.filter((check) => check.journey === journey) ?? [];
  const alerted = [...new Set(data?.weekChecks.filter((check) => check.alert).map((check) => check.journey) ?? [])];
  const stepName = (step: string) => (t.has(`steps.${step}`) ? t(`steps.${step}`) : step);
  const journeyName = (key: Journey) => t(`journeys.${key}`);
  const percent = (value: string | null) => (value === null ? "—" : format.percent(value, 1));
  // Last ÷ first can pass 100 % because steps are counted apart (see `FunnelSteps`): then it is no completion rate,
  // so no percentage is shown — the words say the last step counted more sessions than the first.
  const ratio = (value: string | null) =>
    aboveBefore(value) ? <span className="text-muted text-xs">{t("aboveFirst")}</span> : percent(value);

  return (
    <Section
      title={t("title")}
      description={t("note")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <JourneyExport period={period} />
          <SearchableSelect
            aria-label={t("journey")}
            value={journey}
            onValueChange={(value) => setJourney(value as Journey)}
            options={(data?.journeys ?? []).map((entry) => ({
              value: entry.journey,
              label: `${entry.task} · ${journeyName(entry.journey)}`,
            }))}
          />
        </div>
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          {alerted.length > 0 ? (
            <Callout tone="warning" title={t("alertTitle", { count: alerted.length })}>
              {t("alertBody", { journeys: alerted.map(journeyName).join(", ") })}
            </Callout>
          ) : null}
          {funnel && funnel.steps.length > 0 ? (
            <>
              <FunnelSteps
                caption={t("chart", { journey: journeyName(journey) })}
                steps={funnel.steps.map((step) => ({
                  key: step.step,
                  label: stepName(step.step),
                  sessions: step.sessions,
                  fromPreviousPct: step.fromPreviousPct,
                }))}
              />
              {aboveBefore(funnel.conversionPct) ? null : (
                <p className="text-sm">{t("lastToFirst", { pct: percent(funnel.conversionPct) })}</p>
              )}
            </>
          ) : (
            <p className="text-muted text-sm">{t("empty")}</p>
          )}
          {checks.length > 0 ? (
            <DataTable<WeekCheck>
              caption={t("weekly")}
              columns={[
                { id: "week", header: t("week"), cell: (check) => format.date(check.weekStart) },
                {
                  id: "now",
                  header: t("weekRatio"),
                  numeric: true,
                  cell: (check) => ratio(check.conversionPct),
                },
                {
                  id: "before",
                  header: t("previousRatio"),
                  numeric: true,
                  cell: (check) => ratio(check.previousConversionPct),
                },
                { id: "drop", header: t("drop"), numeric: true, cell: (check) => percent(check.dropPct) },
                {
                  id: "status",
                  header: t("status"),
                  cell: (check) =>
                    check.alert ? (
                      <Badge tone="danger" icon="warning">
                        {t("alerted")}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{t("ok")}</Badge>
                    ),
                },
              ]}
              rows={checks}
              getRowId={(check) => check.weekStart}
              density="compact"
            />
          ) : null}
        </div>
      ) : period ? (
        <Skeleton className="h-64 w-full" />
      ) : null}
    </Section>
  );
}
