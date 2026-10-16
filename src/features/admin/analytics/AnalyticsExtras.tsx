"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, download, problemMessage, QueryError, Section, useCan } from "../console";
import type { Period } from "./period";

type Metric = Schemas["StudioMetricDto"];
type Rollup = Schemas["RollupRunDto"];

/**
 * The studio funnel against its targets (D-286): consented sessions at each studio step, then four
 * measures — minutes to the first add-to-cart, artwork → cart, print files passing preflight and
 * studio orders charged exactly the studio price — each beside its spec §1 target.
 */
export function StudioFunnel({ period }: { period: Period | null }) {
  const t = useTranslations("analytics.studio");
  const format = useFormat();
  const funnel = useQuery({
    enabled: period !== null,
    queryKey: queryKeys.list("admin", "analytics", { part: "studio", ...period }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/analytics/studio-funnel", { params: { query: period! } }))
        .data!,
  });
  const metric = (
    key: "medianMinutesToCart" | "artworkToCartPct" | "preflightPassPct" | "priceParityPct",
    value: Metric,
  ) => (
    <div key={key} className="rounded-md border p-3">
      <dt className="text-muted text-xs">{t(`metrics.${key}`)}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {value.value === null
          ? "—"
          : key === "medianMinutesToCart"
            ? t("minutes", { minutes: format.number(Number(value.value)) })
            : format.percent(value.value, 1)}
      </dd>
      <dd className="text-muted flex flex-wrap items-center gap-1 text-xs">
        {t("target", {
          target:
            key === "medianMinutesToCart" ? t("minutes", { minutes: value.target }) : format.percent(value.target, 0),
        })}
        {value.met === null ? null : value.met ? (
          <Badge size="sm" tone="success" icon="check">
            {t("met")}
          </Badge>
        ) : (
          <Badge size="sm" tone="warning" icon="warning">
            {t("missed")}
          </Badge>
        )}
      </dd>
      <dd className="text-muted text-xs">{t("basis", { count: value.basis })}</dd>
    </div>
  );
  return (
    <Section title={t("title")} description={t("note")}>
      {funnel.isError ? <QueryError error={funnel.error} onRetry={() => void funnel.refetch()} /> : null}
      {!period ? <p className="text-muted text-sm">{t("choosePeriod")}</p> : null}
      {period && funnel.isPending ? <Skeleton className="h-32" /> : null}
      {funnel.data ? (
        <div className="flex flex-col gap-4">
          <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {funnel.data.steps.map((step) => (
              <li key={step.step} className="rounded-md border p-3">
                <p className="text-muted text-xs">{t(`steps.${step.step}`)}</p>
                <p className="text-lg font-semibold tabular-nums">{format.number(step.sessions)}</p>
                <p className="text-muted text-xs">
                  {step.fromPreviousPct === null
                    ? " "
                    : t("fromPrevious", { pct: format.percent(step.fromPreviousPct, 1) })}
                </p>
              </li>
            ))}
          </ol>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metric("medianMinutesToCart", funnel.data.medianMinutesToCart)}
            {metric("artworkToCartPct", funnel.data.artworkToCartPct)}
            {metric("preflightPassPct", funnel.data.preflightPassPct)}
            {metric("priceParityPct", funnel.data.priceParityPct)}
          </dl>
        </div>
      ) : null}
    </Section>
  );
}

/**
 * Journey steps for a usability scorecard round (D-303, D-217): day × journey × step session counts
 * as a file — aggregates only, a cell under the minimum group size suppressed (D-160) — through a
 * five-minute signed URL. Needs `reports.export` as well as `analytics.read`.
 */
export function JourneyExport({ period }: { period: Period | null }) {
  const t = useTranslations("analytics.journeyExport");
  const canExport = useCan("reports.export");
  const run = useMutation({
    mutationFn: async (format: Schemas["ReportFormat"]) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/analytics/journeys/actions/export", {
          body: { format, from: period!.from, to: period!.to },
        })
      ).data!,
    onSuccess: (file) => {
      download(file.url);
      toast.success(file.truncated ? t("truncated", { rows: file.rows }) : t("done", { rows: file.rows }));
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  if (!canExport) return null;
  return (
    <DropdownMenu
      label={t("label")}
      align="end"
      items={(["xlsx", "csv"] as const).map((format) => ({
        id: format,
        label: t(format),
        icon: format === "xlsx" ? ("spreadsheet" as const) : ("document" as const),
        onSelect: () => run.mutate(format),
      }))}
      trigger={
        <Button size="sm" variant="secondary" iconStart="download" loading={run.isPending} disabled={!period}>
          {t("label")}
        </Button>
      }
    />
  );
}

/**
 * The nightly rollups behind these figures (D-102): each fact job per day, its status and rows, and
 * a backfill that rebuilds every fact of every day in a range (at most 366) — the worker picks it up
 * within a minute. For those who run analytics (`analytics.manage`).
 */
export function RollupRuns({ period }: { period: Period | null }) {
  const t = useTranslations("analytics.rollups");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("analytics.manage");
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const runs = useQuery({
    enabled: canManage && period !== null,
    queryKey: queryKeys.list("admin", "analytics_rollup", { ...period }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/analytics/rollups", { params: { query: period! } })).data!,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((run) => run.status === "queued" || run.status === "running") ? 15_000 : false,
  });
  if (!canManage) return null;
  const all = runs.data ?? [];
  const count = (status: Rollup["status"]) => all.filter((run) => run.status === status).length;
  const failed = count("failed");
  // Hundreds of rows a month: by default only what needs attention — failed, queued or running.
  const attention = all.filter((run) => run.status !== "succeeded");
  const shown = showAll ? all : attention;
  const columns: DataTableColumn<Rollup>[] = [
    { id: "date", header: t("columns.date"), cell: (row) => format.date(row.date) },
    { id: "job", header: t("columns.job"), cell: (row) => <span className="font-mono text-xs">{row.job}</span> },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <Badge
          size="sm"
          tone={row.status === "succeeded" ? "success" : row.status === "failed" ? "danger" : "info"}
          icon={row.status === "succeeded" ? "check" : row.status === "failed" ? "warning" : "hourglass"}
        >
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: "rows",
      header: t("columns.rows"),
      numeric: true,
      cell: (row) => (row.rowCount === null ? "–" : format.number(row.rowCount)),
    },
    { id: "attempts", header: t("columns.attempts"), numeric: true, cell: (row) => row.attempts },
    { id: "finished", header: t("columns.finished"), cell: (row) => <When at={row.finishedAt} /> },
    {
      id: "error",
      header: t("columns.error"),
      cell: (row) => (row.error ? <span className="text-danger text-xs">{row.error}</span> : null),
    },
  ];
  return (
    <Section
      title={t("title")}
      description={t("summary", {
        succeeded: count("succeeded"),
        failed,
        waiting: count("queued") + count("running"),
      })}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? t("showAttention") : t("showAll", { count: all.length })}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            iconStart="refresh"
            disabled={!period}
            onClick={() => setConfirming(true)}
          >
            {t("backfill")}
          </Button>
        </div>
      }
    >
      {runs.isError ? <QueryError error={runs.error} onRetry={() => void runs.refetch()} /> : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={[...shown].sort((a, b) => (a.status === "failed" ? -1 : b.status === "failed" ? 1 : 0))}
        getRowId={(row) => `${row.date}:${row.job}`}
        loading={runs.isPending && period !== null}
        density="compact"
        empty={<EmptyState icon="activity" title={showAll ? t("empty") : t("allGood")} />}
      />
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("backfillTitle")}
        description={t("backfillBody", {
          from: period ? format.date(period.from) : "",
          to: period ? format.date(period.to) : "",
        })}
        confirmLabel={t("backfill")}
        onConfirm={async () => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/analytics/rollups", { body: period! });
            toast.success(t("queued", { count: data!.queued }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "analytics_rollup") });
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </Section>
  );
}
