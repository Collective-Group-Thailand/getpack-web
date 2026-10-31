"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { DateField } from "@/ui/components/DateField";
import { StatsRow } from "@/ui/components/DeskPage";
import { BarValue } from "@/ui/components/charts";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, download, pollUntil, problemMessage, QueryError, Section, useCan } from "../console";
import { FunnelSteps } from "./FunnelSteps";
import { JourneyFunnels } from "./JourneyFunnels";
import { RollupRuns, StudioFunnel } from "./AnalyticsExtras";
import { periodOf, previousPeriod, type Period, type Range } from "./period";

type Dimension = Schemas["DemandDimension"];
type DemandRow = Schemas["DemandRowDto"];
type Ref = Schemas["AnalyticsRefDto"];
type Prospectus = Schemas["ProspectusExportDto"];

const DIMENSIONS: readonly Dimension[] = ["product_type", "spec_band", "quantity_band", "province", "channel"];

/** One rollup of the period; nothing is asked until the period is complete. */
function useRollup<T>(part: string, period: Period | null, read: (period: Period) => Promise<T>, enabled = true) {
  return useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part, ...period }),
    queryFn: () => read(period!),
    enabled: enabled && period !== null,
  });
}

const contract = () => adminBrowserApis().contract;
const readSales = async (query: Period) =>
  (await contract().GET("/v1/admin/analytics/sales", { params: { query: { ...query, interval: "day" } } })).data!;
const readDemand = (groupBy: Dimension) => async (query: Period) =>
  (await contract().GET("/v1/admin/analytics/demand", { params: { query: { ...query, groupBy: [groupBy] } } })).data!;

/**
 * The demand dashboard (F2 2.8, D-102): traffic and funnel, demand by type, spec, quantity band,
 * province and channel, unmet demand, factory utilisation and campaign performance — the argument
 * for recruiting factories. Each block is the API's rollup of one topic for the period
 * (`admin.analytics.*`); the overview is composed of sales, traffic and the funnel, as the
 * contract intends. Staff dashboards are not k-suppressed (D-044 applies to the prospectus, the
 * anonymised export of the same, which reports the threshold it used).
 */
export function AnalyticsDashboard() {
  const t = useTranslations("analytics");
  const tFilters = useTranslations("console.filters");
  const format = useFormat();
  const canProspectus = useCan("analytics.prospectus");
  const canFactories = useCan("analytics.read", "analytics.read_factories");
  const [range, setRange] = useState<Range>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [dimension, setDimension] = useState<Dimension>("product_type");
  const period = useMemo(() => periodOf(range, custom), [range, custom]);
  const before = period ? previousPeriod(period) : null;
  const nameOf = (ref: Ref | null) => (ref ? (format.locale === "en" ? ref.nameEn : ref.nameTh) : "—");
  const onDay = (day: string) => format.date(`${day}T00:00:00+07:00`);

  const sales = useRollup("sales", period, readSales);
  // The comparison is the same rollup for the period before: the contract has no `previous`.
  const previous = useRollup("sales", before, readSales);
  const traffic = useRollup(
    "traffic",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/traffic", { params: { query } })).data!,
  );
  const funnel = useRollup(
    "funnel",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/funnel", { params: { query } })).data!,
  );
  // The quotes and RFQs of the period are the product-type cells added up (the triage's mapping).
  const byType = useRollup("demand:product_type", period, readDemand("product_type"));
  const demand = useRollup(`demand:${dimension}`, period, readDemand(dimension));
  const unmet = useRollup(
    "unmet",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/unmet-demand", { params: { query } })).data!,
  );
  const factories = useRollup(
    "factories",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/factories", { params: { query } })).data!,
    canFactories,
  );
  // Price shown → not carted (`admin.analytics.sensitivity`, U-B0.3): drop-off by lead-time band and price quartile.
  const sensitivity = useRollup(
    "sensitivity",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/sensitivity", { params: { query } })).data!,
  );
  const campaigns = useRollup(
    "campaigns",
    period,
    async (query) => (await contract().GET("/v1/admin/analytics/campaigns", { params: { query } })).data!,
  );

  const [prospectusDone, setProspectusDone] = useState<Prospectus | null>(null);
  const prospectus = useMutation({
    mutationFn: async (fileFormat: Schemas["ProspectusFormat"]) => {
      const api = contract();
      const asked = period!;
      // One export renders both files: reuse the finished one for this period, else request it
      // and read it until the worker is done.
      let ready = prospectusDone?.from === asked.from && prospectusDone.to === asked.to ? prospectusDone : null;
      if (!ready) {
        const created = (
          await api.POST("/v1/admin/analytics/prospectus-exports", {
            params: { header: { "Idempotency-Key": newIdempotencyKey() } },
            body: asked,
          })
        ).data!;
        ready = await pollUntil(
          async () =>
            (
              await api.GET("/v1/admin/analytics/prospectus-exports/{exportId}", {
                params: { path: { exportId: created.id } },
              })
            ).data!,
          (item) => item.status !== "pending",
        );
      }
      if (ready.status === "failed") throw new Error(ready.error ?? "prospectus.failed");
      const file = (
        await api.GET("/v1/admin/analytics/prospectus-exports/{exportId}/file", {
          params: { path: { exportId: ready.id }, query: { format: fileFormat } },
        })
      ).data!;
      return { ready, file };
    },
    onSuccess: ({ ready, file }) => {
      setProspectusDone(ready);
      toast.success(t("prospectus.ready", { k: ready.kThreshold, suppressed: ready.suppressedCells ?? 0 }));
      download(file.url);
    },
    onError: (error) => toast.error(problemMessage(error, t("prospectus.failed"))),
  });

  const overviewError = sales.error ?? traffic.error ?? byType.error;
  const kpis =
    sales.data && traffic.data && byType.data
      ? ([
          ["gmv", format.thb(sales.data.totals.gmv), previous.data ? format.thb(previous.data.totals.gmv) : null],
          [
            "groupsPaid",
            format.number(sales.data.totals.groupsPaid),
            previous.data ? format.number(previous.data.totals.groupsPaid) : null,
          ],
          ["aov", format.thb(sales.data.totals.aov), null],
          [
            "conversion",
            format.percent(sales.data.sessionConversionPct),
            previous.data ? format.percent(previous.data.sessionConversionPct) : null,
          ],
          ["sessions", format.number(traffic.data.totals.sessions), null],
          ["quotes", format.number(byType.data.reduce((sum, cell) => sum + cell.savedQuotes, 0)), null],
          ["rfqs", format.number(byType.data.reduce((sum, cell) => sum + cell.rfqsSubmitted, 0)), null],
          ["repeatRate", format.percent(sales.data.totals.repeatRatePct), null],
        ] as const)
      : null;

  const trendMax = Math.max(0, ...(sales.data?.series ?? []).map((point) => point.groupsPlaced));
  const demandMax = Math.max(0, ...(demand.data ?? []).map((row) => row.calculations));
  const unmetMax = Math.max(0, ...(unmet.data?.byReason ?? []).map((reason) => reason.records));

  const cellKey = (row: DemandRow): string => {
    switch (dimension) {
      case "product_type":
        return row.productType?.code ?? "—";
      case "province":
        return row.province?.code ?? "—";
      case "spec_band":
        return row.specBand ?? "—";
      case "quantity_band":
        return row.quantityBand ?? "—";
      case "channel":
        return row.channel ?? "—";
    }
  };
  // The API sends codes; the words are ours, with the code itself when we have none.
  const keyed = (group: string, key: string) => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key);
  const cellLabel = (row: DemandRow) => {
    if (dimension === "product_type") return nameOf(row.productType);
    if (dimension === "province") return nameOf(row.province);
    if (dimension === "channel") return keyed("channels", cellKey(row));
    return cellKey(row);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            label={t("range")}
            value={range}
            onValueChange={(value) => setRange(value as Range)}
            options={(["7d", "30d", "90d", "custom"] as const).map((value) => ({ value, label: t(`ranges.${value}`) }))}
          />
          {range === "custom" ? (
            <>
              <Field label={t("from")}>
                <DateField
                  value={custom.from}
                  display={custom.from ? format.date(custom.from) : tFilters("pickDate")}
                  onChange={(event) => setCustom({ ...custom, from: event.target.value })}
                />
              </Field>
              <Field label={t("to")}>
                <DateField
                  value={custom.to}
                  display={custom.to ? format.date(custom.to) : tFilters("pickDate")}
                  onChange={(event) => setCustom({ ...custom, to: event.target.value })}
                />
              </Field>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {period ? (
            <p className="text-muted text-sm">{t("period", { from: onDay(period.from), to: onDay(period.to) })}</p>
          ) : null}
          {canProspectus ? (
            <>
              <Button
                variant="secondary"
                iconStart="document"
                loading={prospectus.isPending && prospectus.variables === "pdf"}
                disabled={!period || prospectus.isPending}
                onClick={() => prospectus.mutate("pdf")}
              >
                {t("prospectus.pdf")}
              </Button>
              <Button
                variant="secondary"
                iconStart="spreadsheet"
                loading={prospectus.isPending && prospectus.variables === "xlsx"}
                disabled={!period || prospectus.isPending}
                onClick={() => prospectus.mutate("xlsx")}
              >
                {t("prospectus.xlsx")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {overviewError ? (
        <QueryError
          error={overviewError}
          onRetry={() => {
            void sales.refetch();
            void traffic.refetch();
            void byType.refetch();
          }}
        />
      ) : kpis ? (
        <StatsRow
          label={t("kpis.label")}
          columns={4}
          items={kpis.map(([name, value, earlier]) => ({
            key: name,
            label: t(`kpis.${name}`),
            value,
            hint: earlier ? t("previous", { value: earlier }) : undefined,
          }))}
        />
      ) : period ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <p className="text-muted text-sm">{t("choosePeriod")}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t("funnel.title")} description={t("funnel.note")}>
          {funnel.isError ? <QueryError error={funnel.error} onRetry={() => void funnel.refetch()} /> : null}
          {funnel.data ? (
            <FunnelSteps
              caption={t("funnel.title")}
              steps={funnel.data.steps.map((step) => ({
                key: step.step,
                label: t(`funnel.steps.${step.step}`),
                sessions: step.sessions,
                fromPreviousPct: step.fromPreviousPct,
                fromVisitPct: step.fromVisitPct,
              }))}
            />
          ) : period ? (
            <Skeleton className="h-64 w-full" />
          ) : null}
        </Section>
        {/* CONTRACT-GAP admin.analytics — no quotes per day: the trend is order groups placed and paid. */}
        <Section title={t("trend.title")} description={t("trend.note")}>
          {sales.data ? (
            <DataTable<Schemas["SalesPointDto"]>
              caption={t("trend.title")}
              density="compact"
              rows={sales.data.series}
              getRowId={(point) => point.period}
              empty={
                <EmptyState
                  icon="chart"
                  title={t("trend.empty")}
                  action={
                    <Button variant="secondary" onClick={() => setRange("90d")}>
                      {t("ranges.90d")}
                    </Button>
                  }
                />
              }
              columns={[
                { id: "period", header: t("trend.date"), cell: (point) => onDay(point.period) },
                {
                  id: "placed",
                  header: t("trend.groupsPlaced"),
                  numeric: true,
                  cell: (point) => (
                    <BarValue value={point.groupsPlaced} max={trendMax} tone="muted">
                      {format.number(point.groupsPlaced)}
                    </BarValue>
                  ),
                },
                {
                  id: "paid",
                  header: t("trend.groupsPaid"),
                  numeric: true,
                  cell: (point) => (
                    <BarValue value={point.groupsPaid} max={trendMax}>
                      {format.number(point.groupsPaid)}
                    </BarValue>
                  ),
                },
                { id: "gmv", header: t("trend.gmv"), numeric: true, cell: (point) => format.thb(point.gmv) },
              ]}
            />
          ) : period ? (
            <Skeleton className="h-64 w-full" />
          ) : null}
        </Section>
      </div>

      <JourneyFunnels period={period} />

      <StudioFunnel period={period} />

      <Section
        title={t("demand.title")}
        description={t("demand.note")}
        actions={
          <SegmentedControl
            label={t("demand.dimension")}
            size="sm"
            value={dimension}
            onValueChange={(value) => setDimension(value as Dimension)}
            options={DIMENSIONS.map((value) => ({ value, label: t(`demand.dimensions.${value}`) }))}
          />
        }
      >
        {demand.isError ? <QueryError error={demand.error} onRetry={() => void demand.refetch()} /> : null}
        {demand.data ? (
          <>
            {/* CONTRACT-GAP admin.analytics — no GMV or conversion per cell; "priced but not taken" is the sensitivity block below. */}
            <DataTable<DemandRow>
              caption={t("demand.table")}
              columns={[
                { id: "label", header: t(`demand.dimensions.${dimension}`), cell: cellLabel },
                {
                  id: "calculations",
                  header: t("demand.calculations"),
                  numeric: true,
                  cell: (row) => (
                    <BarValue value={row.calculations} max={demandMax}>
                      {format.number(row.calculations)}
                    </BarValue>
                  ),
                },
                {
                  id: "savedQuotes",
                  header: t("demand.savedQuotes"),
                  numeric: true,
                  cell: (row) => format.number(row.savedQuotes),
                },
                {
                  id: "convertedQuotes",
                  header: t("demand.convertedQuotes"),
                  numeric: true,
                  cell: (row) => format.number(row.convertedQuotes),
                },
                {
                  id: "rfqsSubmitted",
                  header: t("demand.rfqsSubmitted"),
                  numeric: true,
                  cell: (row) => format.number(row.rfqsSubmitted),
                },
                {
                  id: "rfqsAccepted",
                  header: t("demand.rfqsAccepted"),
                  numeric: true,
                  cell: (row) => format.number(row.rfqsAccepted),
                },
                {
                  id: "rfqsDeclined",
                  header: t("demand.rfqsDeclined"),
                  numeric: true,
                  cell: (row) => format.number(row.rfqsDeclined),
                },
              ]}
              rows={demand.data}
              getRowId={cellKey}
              density="compact"
            />
          </>
        ) : period ? (
          <Skeleton className="h-64 w-full" />
        ) : null}
        {sales.data ? (
          <DataTable<Schemas["SalesProductTypeDto"]>
            className="mt-4"
            caption={t("demand.salesByType")}
            showCaption
            columns={[
              { id: "type", header: t("demand.dimensions.product_type"), cell: (row) => nameOf(row.productType) },
              {
                id: "ordersPaid",
                header: t("demand.ordersPaid"),
                numeric: true,
                cell: (row) => format.number(row.ordersPaid),
              },
              { id: "gmv", header: t("demand.gmv"), numeric: true, cell: (row) => format.thb(row.gmv) },
            ]}
            rows={sales.data.byProductType}
            getRowId={(row) => row.productType.code}
            density="compact"
          />
        ) : null}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t("sensitivity.title")} description={t("sensitivity.note")}>
          {sensitivity.isError ? (
            <QueryError error={sensitivity.error} onRetry={() => void sensitivity.refetch()} />
          ) : sensitivity.data ? (
            <div className="flex flex-col gap-4">
              {(["byLeadTime", "byPriceQuartile"] as const).map((part) => (
                <DataTable<Schemas["SensitivityRowDto"]>
                  key={part}
                  caption={t(`sensitivity.${part}`)}
                  showCaption
                  columns={[
                    {
                      id: "band",
                      header: t(`sensitivity.${part}Band`),
                      cell: (row) =>
                        part === "byLeadTime"
                          ? row.band === "unknown"
                            ? t("sensitivity.unknownBand")
                            : t("sensitivity.days", { band: row.band })
                          : t("sensitivity.quartile", { band: row.band }),
                    },
                    {
                      id: "shown",
                      header: t("sensitivity.shown"),
                      numeric: true,
                      cell: (row) => format.number(row.shown),
                    },
                    {
                      id: "carted",
                      header: t("sensitivity.carted"),
                      numeric: true,
                      cell: (row) => format.number(row.carted),
                    },
                    {
                      id: "dropOff",
                      header: t("sensitivity.dropOff"),
                      numeric: true,
                      cell: (row) => format.percent(row.dropOffPct),
                    },
                  ]}
                  rows={sensitivity.data[part]}
                  getRowId={(row) => row.band}
                  density="compact"
                  empty={
                    <EmptyState
                      icon="chart"
                      title={t("sensitivity.empty")}
                      action={
                        <Button variant="secondary" onClick={() => setRange("90d")}>
                          {t("ranges.90d")}
                        </Button>
                      }
                    />
                  }
                />
              ))}
            </div>
          ) : period ? (
            <Skeleton className="h-40 w-full" />
          ) : null}
        </Section>

        <Section title={t("unmet.title")} description={t("unmet.note")}>
          {unmet.isError ? <QueryError error={unmet.error} onRetry={() => void unmet.refetch()} /> : null}
          {unmet.data ? (
            <>
              <p className="text-muted mb-3 text-sm">
                {unmet.data.bySource
                  .map((source) => `${keyed("unmet.sources", source.key)} ${format.number(source.records)}`)
                  .join(" · ")}
              </p>
              <h3 className="mb-1 text-sm font-medium">{t("unmet.reasons")}</h3>
              <ul className="divide-border divide-y text-sm">
                {unmet.data.byReason.map((reason) => (
                  <li key={reason.key} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 py-2">
                    <span>{keyed("unmet.reasonCodes", reason.key)}</span>
                    <BarValue value={reason.records} max={unmetMax} tone="muted">
                      {format.number(reason.records)}
                    </BarValue>
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 mb-1 text-sm font-medium">{t("unmet.specs")}</h3>
              <ul className="divide-border divide-y text-sm">
                {unmet.data.rows.map((row, index) => (
                  <li key={index} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {nameOf(row.productType)} · {row.specBand} · {row.quantityBand}{" "}
                      <span className="text-muted text-xs">
                        · {keyed("unmet.reasonCodes", row.reasonCode)}
                        {row.province ? ` · ${nameOf(row.province)}` : ""}
                      </span>
                    </span>
                    <span className="tabular-nums">{format.number(row.records)}</span>
                  </li>
                ))}
              </ul>
              {unmet.data.capacityLimitedWeeks.length > 0 ? (
                <Callout tone="info" className="mt-3" title={t("unmet.capacity")}>
                  {unmet.data.capacityLimitedWeeks
                    .map((week) =>
                      t("unmet.capacityItem", {
                        week: onDay(week.weekStart),
                        type: nameOf(week.productType),
                        full: week.factoriesFull,
                        factories: week.factories,
                      }),
                    )
                    .join(" · ")}
                </Callout>
              ) : null}
              <p className="mt-3 text-sm">
                <Link href="/partners/coverage" className="text-primary hover:underline">
                  {t("unmet.coverage")}
                </Link>
              </p>
            </>
          ) : period ? (
            <Skeleton className="h-64 w-full" />
          ) : null}
        </Section>
      </div>

      {canFactories ? (
        <Section title={t("factories.title")} description={t("factories.note")}>
          {factories.isError ? <QueryError error={factories.error} onRetry={() => void factories.refetch()} /> : null}
          <DataTable<Schemas["FactoryPerformanceDto"]>
            caption={t("factories.title")}
            columns={[
              {
                id: "factory",
                header: t("factories.factory"),
                cell: (row) => (
                  <span>
                    {row.factory.code} <span className="text-muted text-xs">· {nameOf(row.productType)}</span>
                  </span>
                ),
              },
              {
                id: "released",
                header: t("factories.released"),
                numeric: true,
                cell: (row) => format.number(row.released),
              },
              {
                id: "utilisation",
                header: t("factories.utilisation"),
                numeric: true,
                cell: (row) => (row.utilisationPct === null ? "—" : format.percent(row.utilisationPct, 0)),
              },
              {
                id: "acceptedOnTime",
                header: t("factories.acceptedOnTime"),
                numeric: true,
                cell: (row) => (row.acceptedOnTimePct === null ? "—" : format.percent(row.acceptedOnTimePct, 0)),
              },
              {
                id: "shippedOnTime",
                header: t("factories.shippedOnTime"),
                numeric: true,
                cell: (row) => (row.shippedOnTimePct === null ? "—" : format.percent(row.shippedOnTimePct, 0)),
              },
              {
                id: "claims",
                header: t("factories.claims"),
                numeric: true,
                cell: (row) => format.number(row.claims),
              },
            ]}
            rows={factories.data ?? []}
            getRowId={(row) => `${row.factory.code}:${row.productType.code}`}
            loading={period !== null && factories.isPending}
            density="compact"
          />
        </Section>
      ) : null}

      <Section title={t("campaigns.title")}>
        <DataTable<Schemas["CampaignPerformanceDto"]>
          caption={t("campaigns.title")}
          columns={[
            {
              id: "campaign",
              header: t("campaigns.campaign"),
              cell: (row) => (
                <Link href={`/marketing/campaigns/${row.id}`} className="text-primary hover:underline">
                  {row.name}
                </Link>
              ),
            },
            {
              id: "redemptions",
              header: t("campaigns.redemptions"),
              numeric: true,
              cell: (row) => format.number(row.redemptions),
            },
            {
              id: "orders",
              header: t("campaigns.orders"),
              numeric: true,
              cell: (row) => format.number(row.orderGroups),
            },
            {
              id: "discount",
              header: t("campaigns.discount"),
              numeric: true,
              cell: (row) => format.thb(row.discountAmount),
            },
            {
              id: "revenue",
              header: t("campaigns.revenue"),
              numeric: true,
              cell: (row) => format.thb(row.grossAmount),
            },
            {
              id: "newCustomers",
              header: t("campaigns.newCustomers"),
              numeric: true,
              cell: (row) => format.number(row.newCustomers),
            },
          ]}
          rows={campaigns.data ?? []}
          getRowId={(row) => row.id}
          loading={period !== null && campaigns.isPending}
          density="compact"
        />
      </Section>
      <RollupRuns period={period} />
    </div>
  );
}
