"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { ResponseOf } from "@/lib/api/requests/client";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Requests } from "@/lib/api/requests/registry";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";

import { QueryError, Section } from "../console";

const Chart = dynamic(() => import("@/ui/components/Chart").then((module) => module.Chart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

const JOURNEYS = ["configurator", "checkout", "studio", "claims", "reorder"] as const;
type Journey = (typeof JOURNEYS)[number];
type Step = ResponseOf<Requests, "GET /v1/admin/analytics/journeys">["steps"][number];
type PeriodQuery = { range: "7d" | "30d" | "90d" | "custom"; from?: string; to?: string };

/**
 * The UX scorecard's journey funnels (U5.0, `docs/ux/funnels.md`): sessions at each step of one
 * journey, conversion from the step before, and the change against last week. Whether a drop is
 * alarming is the API's call, against the threshold it returns (a setting) — the screen shows
 * the flag and the figures, and compares nothing itself.
 */
export function JourneyFunnels({ query, enabled }: { query: PeriodQuery; enabled: boolean }) {
  const t = useTranslations("analytics.journeys");
  const tAll = useTranslations("analytics");
  const format = useFormat();
  const [journey, setJourney] = useState<Journey>("configurator");

  const funnel = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "journeys", journey, ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/journeys", { query: { ...query, journey } }),
    enabled,
  });
  const data = funnel.data;
  const alerted = data?.steps.filter((step) => step.alert) ?? [];
  const signed = (value: string | null) =>
    value === null ? "—" : `${value.startsWith("-") ? "" : "+"}${format.percent(value, 1)}`;

  return (
    <Section
      title={t("title")}
      description={t("note", { threshold: data ? format.percent(data.alertThresholdPct, 0) : "…" })}
      actions={
        <SegmentedControl
          label={t("journey")}
          size="sm"
          value={journey}
          onValueChange={(value) => setJourney(value as Journey)}
          options={JOURNEYS.map((value) => ({ value, label: t(`journeys.${value}`) }))}
        />
      }
    >
      {funnel.isError ? <QueryError error={funnel.error} onRetry={() => void funnel.refetch()} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          {alerted.length > 0 ? (
            <Callout tone="warning" title={t("alertTitle", { count: alerted.length })}>
              {t("alertBody", { steps: alerted.map((step) => t(`steps.${step.event}`)).join(", ") })}
            </Callout>
          ) : null}
          <Chart
            kind="bar"
            title={t("chart", { journey: t(`journeys.${journey}`) })}
            data={data.steps.map((step) => ({ step: t(`steps.${step.event}`), sessions: step.sessions }))}
            index="step"
            indexLabel={t("step")}
            series={[{ key: "sessions", label: t("sessions") }]}
            formatValue={(value) => format.number(value)}
            labels={{ showTable: tAll("showTable"), hideTable: tAll("hideTable") }}
          />
          <DataTable<Step>
            caption={t("chart", { journey: t(`journeys.${journey}`) })}
            columns={[
              { id: "step", header: t("step"), cell: (step) => t(`steps.${step.event}`) },
              { id: "sessions", header: t("sessions"), numeric: true, cell: (step) => format.number(step.sessions) },
              {
                id: "conversion",
                header: t("conversion"),
                numeric: true,
                cell: (step) => (step.conversionPct === null ? t("first") : format.percent(step.conversionPct, 1)),
              },
              {
                id: "previous",
                header: t("previousConversion"),
                numeric: true,
                cell: (step) =>
                  step.previousConversionPct === null ? "—" : format.percent(step.previousConversionPct, 1),
              },
              { id: "change", header: t("weekOverWeek"), numeric: true, cell: (step) => signed(step.weekOverWeekPct) },
              {
                id: "status",
                header: t("status"),
                cell: (step) =>
                  step.alert ? (
                    <Badge tone="danger" icon="warning">
                      {t("drop")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{t("ok")}</Badge>
                  ),
              },
            ]}
            rows={data.steps}
            getRowId={(step) => step.event}
            density="compact"
          />
          <p className="text-muted text-xs">{t("computedAt", { time: format.dateTime(data.computedAt) })}</p>
        </div>
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </Section>
  );
}
