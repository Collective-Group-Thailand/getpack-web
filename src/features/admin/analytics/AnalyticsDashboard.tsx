"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { download, problemMessage, QueryError, Section, useCan } from "../console";

// Recharts is heavy: it loads with this page only, after the figures it draws.
const Chart = dynamic(() => import("@/ui/components/Chart").then((module) => module.Chart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

type Range = "7d" | "30d" | "90d" | "custom";
type Dimension = "product_type" | "spec_band" | "quantity_band" | "province";

/**
 * The demand dashboard (F2 2.8, D-102): traffic and funnel, demand by type, spec, quantity band
 * and province, unmet demand, factory utilisation and campaign performance — the argument for
 * recruiting factories. Every figure is the API's rollup for the period it resolved; a group
 * smaller than the minimum is withheld and counted (D-044). The prospectus is the anonymised
 * export of the same.
 */
export function AnalyticsDashboard() {
  const t = useTranslations("analytics");
  const format = useFormat();
  const canProspectus = useCan("analytics.prospectus");
  const [range, setRange] = useState<Range>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [dimension, setDimension] = useState<Dimension>("product_type");
  const ready = range !== "custom" || (custom.from !== "" && custom.to !== "");
  const query = range === "custom" ? { range, ...custom } : { range };
  const labels = { showTable: t("showTable"), hideTable: t("hideTable") };

  const overview = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "overview", ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/overview", { query }),
    enabled: ready,
  });
  const demand = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "demand", dimension, ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/demand", { query: { ...query, dimension } }),
    enabled: ready,
  });
  const unmet = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "unmet", ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/unmet-demand", { query }),
    enabled: ready,
  });
  const factories = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "factories", ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/factories", { query }),
    enabled: ready,
  });
  const campaigns = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "campaigns", ...query }),
    queryFn: () => browserRequests().call("GET /v1/admin/analytics/campaigns", { query }),
    enabled: ready,
  });
  const prospectus = useMutation({
    mutationFn: (fileFormat: "pdf" | "xlsx") =>
      browserRequests().call("POST /v1/admin/analytics/prospectus", { body: { ...query, format: fileFormat } }),
    onSuccess: (file) => {
      toast.success(t("prospectus.ready", { k: file.minGroupSize, suppressed: file.suppressedGroups }));
      download(file.url);
    },
    onError: (error) => toast.error(problemMessage(error, t("prospectus.failed"))),
  });

  if (overview.isError) return <QueryError error={overview.error} onRetry={() => void overview.refetch()} />;
  const data = overview.data;

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
                <Input
                  type="date"
                  value={custom.from}
                  onChange={(event) => setCustom({ ...custom, from: event.target.value })}
                />
              </Field>
              <Field label={t("to")}>
                <Input
                  type="date"
                  value={custom.to}
                  onChange={(event) => setCustom({ ...custom, to: event.target.value })}
                />
              </Field>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data ? (
            <p className="text-muted text-sm">
              {t("period", { from: format.date(data.period.from), to: format.date(data.period.to) })}
            </p>
          ) : null}
          {canProspectus ? (
            <>
              <Button
                variant="secondary"
                iconStart="document"
                loading={prospectus.isPending && prospectus.variables === "pdf"}
                disabled={!ready}
                onClick={() => prospectus.mutate("pdf")}
              >
                {t("prospectus.pdf")}
              </Button>
              <Button
                variant="secondary"
                iconStart="spreadsheet"
                loading={prospectus.isPending && prospectus.variables === "xlsx"}
                disabled={!ready}
                onClick={() => prospectus.mutate("xlsx")}
              >
                {t("prospectus.xlsx")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {data ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["gmv", format.thb(data.kpis.gmv), t("previous", { value: format.thb(data.previous.gmv) })],
              [
                "paidOrders",
                format.number(data.kpis.paidOrders),
                t("previous", { value: format.number(data.previous.paidOrders) }),
              ],
              ["aov", format.thb(data.kpis.aov), null],
              [
                "conversion",
                format.percent(data.kpis.conversionPct),
                t("previous", { value: format.percent(data.previous.conversionPct) }),
              ],
              ["sessions", format.number(data.kpis.sessions), null],
              ["quotes", format.number(data.kpis.quotes), null],
              ["rfqs", format.number(data.kpis.rfqs), null],
              ["repeatRate", format.percent(data.kpis.repeatRatePct), null],
            ] as const
          ).map(([name, value, before]) => (
            <div key={name} className="bg-surface rounded-md border p-4">
              <dt className="text-muted text-xs">{t(`kpis.${name}`)}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              {before ? <dd className="text-muted text-xs">{before}</dd> : null}
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-28 w-full" />
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t("funnel.title")} description={t("funnel.note")}>
          {data ? (
            <Chart
              kind="bar"
              title={t("funnel.title")}
              data={data.funnel.map((step) => ({ step: t(`funnel.steps.${step.step}`), count: step.count }))}
              index="step"
              indexLabel={t("funnel.step")}
              series={[{ key: "count", label: t("funnel.count") }]}
              formatValue={(value) => format.number(value)}
              labels={labels}
            />
          ) : null}
        </Section>
        <Section title={t("trend.title")}>
          {data ? (
            <Chart
              kind="line"
              title={t("trend.title")}
              data={data.trend.map((day) => ({ date: day.date, paidOrders: day.paidOrders, quotes: day.quotes }))}
              index="date"
              indexLabel={t("trend.date")}
              series={[
                { key: "quotes", label: t("trend.quotes"), tone: "info" },
                { key: "paidOrders", label: t("trend.paidOrders"), tone: "primary" },
              ]}
              formatValue={(value) => format.number(value)}
              formatIndex={(value) => format.date(`${value}T00:00:00+07:00`)}
              labels={labels}
            />
          ) : null}
        </Section>
      </div>

      <Section
        title={t("demand.title")}
        description={t("demand.note")}
        actions={
          <SegmentedControl
            label={t("demand.dimension")}
            size="sm"
            value={dimension}
            onValueChange={(value) => setDimension(value as Dimension)}
            options={(["product_type", "spec_band", "quantity_band", "province"] as const).map((value) => ({
              value,
              label: t(`demand.dimensions.${value}`),
            }))}
          />
        }
      >
        {demand.isError ? <QueryError error={demand.error} onRetry={() => void demand.refetch()} /> : null}
        {demand.data ? (
          <>
            <Chart
              kind="bar"
              layout="vertical"
              title={t("demand.chart", { dimension: t(`demand.dimensions.${dimension}`) })}
              data={demand.data.rows.map((row) => ({
                label: row.label,
                quotes: row.quotes,
                rfqs: row.rfqs,
                paidOrders: row.paidOrders,
              }))}
              index="label"
              indexLabel={t(`demand.dimensions.${dimension}`)}
              series={[
                { key: "quotes", label: t("demand.quotes"), tone: "info" },
                { key: "rfqs", label: t("demand.rfqs"), tone: "warning" },
                { key: "paidOrders", label: t("demand.paidOrders"), tone: "primary" },
              ]}
              height={Math.max(220, demand.data.rows.length * 44)}
              formatValue={(value) => format.number(value)}
              labels={labels}
            />
            <DataTable
              className="mt-4"
              caption={t("demand.table")}
              columns={[
                { id: "label", header: t(`demand.dimensions.${dimension}`), cell: (row) => row.label },
                { id: "gmv", header: t("demand.gmv"), numeric: true, cell: (row) => format.thb(row.gmv) },
                {
                  id: "conversion",
                  header: t("demand.conversion"),
                  numeric: true,
                  cell: (row) => format.percent(row.conversionPct),
                },
                {
                  id: "abandoned",
                  header: t("demand.abandoned"),
                  numeric: true,
                  cell: (row) => format.percent(row.abandonedAfterPricePct),
                },
              ]}
              rows={demand.data.rows}
              getRowId={(row) => row.key}
              density="compact"
            />
            {demand.data.suppressedGroups > 0 ? (
              <p className="text-muted mt-2 text-xs">
                {t("demand.suppressed", { count: demand.data.suppressedGroups, k: demand.data.minGroupSize })}
              </p>
            ) : null}
          </>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t("unmet.title")} description={t("unmet.note")}>
          {unmet.data ? (
            <>
              <p className="mb-2 text-sm">
                {t("unmet.rfqs", {
                  declined: format.number(unmet.data.rfqsDeclined),
                  expired: format.number(unmet.data.rfqsExpired),
                })}
              </p>
              <Chart
                kind="bar"
                layout="vertical"
                title={t("unmet.reasons")}
                data={unmet.data.reasons}
                index="label"
                indexLabel={t("unmet.reason")}
                series={[{ key: "count", label: t("unmet.count"), tone: "warning" }]}
                height={220}
                formatValue={(value) => format.number(value)}
                labels={labels}
              />
              <h3 className="mt-4 mb-1 text-sm font-medium">{t("unmet.specs")}</h3>
              <ul className="divide-border divide-y text-sm">
                {unmet.data.specs.map((spec) => (
                  <li key={spec.spec} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {spec.spec} <span className="text-muted text-xs">· {spec.productTypeName}</span>
                    </span>
                    <span className="tabular-nums">{format.number(spec.requests)}</span>
                  </li>
                ))}
              </ul>
              {unmet.data.capacityLimited.length > 0 ? (
                <Callout tone="info" className="mt-3" title={t("unmet.capacity")}>
                  {unmet.data.capacityLimited
                    .map((item) =>
                      t("unmet.capacityItem", {
                        week: item.week,
                        type: item.productTypeName,
                        count: item.requests,
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
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </Section>
        <Section title={t("factories.title")} description={t("factories.note")}>
          {factories.data ? (
            <Chart
              kind="bar"
              layout="vertical"
              title={t("factories.title")}
              data={factories.data.rows.map((row) => ({
                factory: row.factory.code,
                utilisation: Number(row.utilisationPct),
                onTime: row.onTimePct === null ? 0 : Number(row.onTimePct),
              }))}
              index="factory"
              indexLabel={t("factories.factory")}
              series={[
                { key: "utilisation", label: t("factories.utilisation"), tone: "primary" },
                { key: "onTime", label: t("factories.onTime"), tone: "success" },
              ]}
              height={Math.max(220, factories.data.rows.length * 52)}
              formatValue={(value) => format.percent(String(value), 0)}
              labels={labels}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </Section>
      </div>

      <Section title={t("campaigns.title")}>
        <DataTable
          caption={t("campaigns.title")}
          columns={[
            {
              id: "campaign",
              header: t("campaigns.campaign"),
              cell: (row) => (
                <Link href={`/marketing/campaigns/${row.campaign.id}`} className="text-primary hover:underline">
                  {row.campaign.name}
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
              cell: (row) => format.number(row.paidOrders),
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
              cell: (row) => format.thb(row.revenueAmount),
            },
            {
              id: "newCustomers",
              header: t("campaigns.newCustomers"),
              numeric: true,
              cell: (row) => format.number(row.newCustomers),
            },
          ]}
          rows={campaigns.data?.rows ?? []}
          getRowId={(row) => row.campaign.id}
          loading={campaigns.isPending}
          density="compact"
        />
      </Section>
    </div>
  );
}
