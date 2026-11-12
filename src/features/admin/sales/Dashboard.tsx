"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { BarList, ColumnChart } from "@/ui/components/DataBars";
import { Meter } from "@/ui/components/Meter";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, download, problemMessage, QueryError } from "../console";
import { Figure, useFigureText } from "./figure";

type Period = Schemas["SalesDashboardPeriod"];
const RANGES = ["30", "90", "180"] as const;

/** A Bangkok calendar day `days` ago, `YYYY-MM-DD` — the dashboard's `from` (a range choice, not a business value). */
function bangkokDay(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** A parsed count or percentage for drawing only (bar length); the reader always sees the API's own string. */
const n = (value: string | number | null | undefined) => (value === null || value === undefined ? 0 : Number(value));

/**
 * The manager dashboard (D-469 item 5): one measure per chart — the funnel by stage with the drop-off between steps,
 * new leads and deals won per period (two charts, one scale each), first-response SLA, leads by source, reps, and
 * company reps against freelance agents. The filters sit in one row above everything they scope (range, period,
 * who); a refetch keeps the frame at reduced opacity. Every number explains itself on hover and focus, and every
 * chart has its figures for a screen reader. CSV through the export endpoint.
 */
export function SalesDashboard() {
  const t = useTranslations("sales.dashboard");
  const format = useFormat();
  const explain = useFigureText();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = (RANGES as readonly string[]).includes(params.get("range") ?? "") ? params.get("range")! : "90";
  const period: Period = params.get("period") === "week" ? "week" : "month";
  const kind = params.get("kind") === "employee" || params.get("kind") === "freelance" ? params.get("kind")! : "all";
  const [exporting, setExporting] = useState(false);
  const query = {
    from: bangkokDay(Number(range)),
    to: bangkokDay(0),
    period,
    ...(kind === "all" ? {} : { agentKind: kind as Schemas["SalesAgentKindFilter"] }),
  };
  const dashboard = useQuery({
    queryKey: queryKeys.list("admin", "sales_dashboard", query),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/dashboard", { params: { query } })).data!,
    placeholderData: keepPreviousData,
  });
  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const file = (await adminBrowserApis().contract.GET("/v1/admin/sales/dashboard/export", { params: { query } }))
        .data!;
      download(file.url);
    } catch (error) {
      toast.error(problemMessage(error, t("exportFailed")));
    } finally {
      setExporting(false);
    }
  };

  const filters = (
    <div role="group" aria-label={t("filters")} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SegmentedControl
        label={t("range")}
        value={range}
        onValueChange={(value) => set("range", value, "90")}
        options={RANGES.map((value) => ({ value, label: t("lastDays", { days: value }) }))}
      />
      <SegmentedControl
        label={t("period")}
        value={period}
        onValueChange={(value) => set("period", value, "month")}
        options={(["month", "week"] as const).map((value) => ({ value, label: t(`periods.${value}`) }))}
      />
      <SegmentedControl
        label={t("kind")}
        value={kind}
        onValueChange={(value) => set("kind", value, "all")}
        options={(["all", "employee", "freelance"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }))}
      />
      <Button
        variant="secondary"
        iconStart="download"
        className="ms-auto"
        loading={exporting}
        onClick={() => void exportCsv()}
      >
        {t("export")}
      </Button>
    </div>
  );

  if (dashboard.isError) return <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const d = dashboard.data;
  if (!d) {
    return (
      <div className="flex flex-col gap-6">
        {filters}
        <div className="bg-surface-subtle rounded-card h-96 animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }
  const asOf = d.asOf;
  const src = (label: string) => ({ label, href: null });
  const periodLabel = (key: string) =>
    period === "month" ? format.date(`${key}-01`, { style: "month" }) : format.date(key, { style: "dayMonth" });

  return (
    <div className={cn("flex flex-col gap-6 transition-opacity", dashboard.isFetching && "opacity-60")}>
      {filters}
      <p className="text-muted -mt-3 text-xs">
        {t("scope", { from: format.date(d.from), to: format.date(d.to), at: format.dateTime(asOf) })}
      </p>

      <section aria-label={t("totals")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(
          [
            ["leads", format.number(d.totals.leads)],
            ["won", format.number(d.totals.won)],
            ["winRate", d.totals.winRatePct === null ? "—" : format.percent(d.totals.winRatePct, 1)],
            ["openValue", format.thb(d.totals.openValue)],
            [
              "firstResponseSla",
              d.inbound.firstResponseSlaPct === null ? "—" : format.percent(d.inbound.firstResponseSlaPct, 1),
            ],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="border-border bg-surface rounded-card flex flex-col gap-1 border p-4">
            <span className="text-muted text-sm">{t(`kpi.${key}`)}</span>
            <Figure
              name={key}
              source={src(t("sourceDashboard"))}
              asOf={asOf}
              className="self-start text-2xl font-semibold"
            >
              {value}
            </Figure>
            {key === "firstResponseSla" ? (
              <>
                <span className="text-muted text-xs">
                  {t("inboundTotal", { count: format.number(d.inbound.total) })}
                </span>
                {d.inbound.firstResponseSlaPct !== null ? (
                  <Meter
                    className="mt-1"
                    label={t("kpi.firstResponseSla")}
                    value={n(d.inbound.firstResponseSlaPct)}
                    valueText={format.percent(d.inbound.firstResponseSlaPct, 1)}
                    tone={n(d.inbound.firstResponseSlaPct) >= 90 ? "success" : "warning"}
                  />
                ) : null}
              </>
            ) : key === "winRate" ? (
              <span className="text-muted text-xs">{t("winRateOf", { won: d.totals.won, lost: d.totals.lost })}</span>
            ) : null}
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("funnel.title")} hint={t("funnel.hint")}>
          <BarList
            title={t("funnel.title")}
            data={d.funnel.map((step) => ({
              key: step.stage,
              label: t(`stages.${step.stage}`),
              value: step.count,
              display: format.number(step.count),
              aside:
                step.dropOffPct === null ? undefined : t("funnel.dropOff", { pct: format.percent(step.dropOffPct, 1) }),
              tip: explain("funnelStep", { source: t("sourceLeads"), asOf }),
            }))}
          />
          <ul className="text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {d.funnel
              .filter((step) => step.dropOffPct !== null)
              .map((step) => (
                <li key={step.stage}>
                  {t(`stages.${step.stage}`)}{" "}
                  <Figure name="dropOff" source={src(t("sourceLeads"))} asOf={asOf} className="tabular-nums">
                    {t("funnel.dropOff", { pct: format.percent(step.dropOffPct!, 1) })}
                  </Figure>
                </li>
              ))}
          </ul>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Card title={t("trend.won", { period: t(`periods.${period}`) })} hint={t("trend.wonHint")}>
            <ColumnChart
              title={t("trend.won", { period: t(`periods.${period}`) })}
              data={d.byPeriod.map((row) => ({
                key: row.period,
                label: periodLabel(row.period),
                value: row.won,
                display: format.number(row.won),
                tip: explain("wonPerPeriod", { source: t("sourceLeads"), asOf }),
              }))}
            />
          </Card>
          <Card title={t("trend.leads", { period: t(`periods.${period}`) })} hint={t("trend.leadsHint")}>
            <ColumnChart
              title={t("trend.leads", { period: t(`periods.${period}`) })}
              data={d.byPeriod.map((row) => ({
                key: row.period,
                label: periodLabel(row.period),
                value: row.leads,
                display: format.number(row.leads),
                tip: explain("leadsPerPeriod", { source: t("sourceLeads"), asOf }),
              }))}
            />
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("bySource.title")} hint={t("bySource.hint")}>
          <BarList
            title={t("bySource.title")}
            data={[...d.bySource]
              .sort((a, b) => b.leads - a.leads)
              .map((row) => ({
                key: row.source,
                label: t.has(`sources.${row.source}`) ? t(`sources.${row.source}`) : row.source,
                value: row.leads,
                display: format.number(row.leads),
                aside: t("bySource.aside", {
                  won: format.number(row.won),
                  rate: row.winRatePct === null ? "—" : format.percent(row.winRatePct, 1),
                }),
                tip: explain("sourceLeads", { source: t("sourceLeads"), asOf }),
              }))}
          />
        </Card>
        <Card title={t("medianDays.title")} hint={t("medianDays.hint")}>
          <BarList
            title={t("medianDays.title")}
            tone="muted"
            data={d.medianDays.map((row) => ({
              key: row.stage,
              label: t(`stages.${row.stage}`),
              value: n(row.medianDays),
              display:
                row.medianDays === null
                  ? "—"
                  : t("medianDays.days", { days: format.number(n(row.medianDays), { maximumFractionDigits: 1 }) }),
              aside: t("medianDays.samples", { count: row.samples }),
              tip: explain("medianDays", { source: t("sourceLeads"), asOf }),
            }))}
          />
        </Card>
      </div>

      <Card title={t("byRep.title")} hint={t("byRep.hint")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{t("byRep.title")}</caption>
            <thead className="text-muted text-xs">
              <tr className="border-border border-b">
                <th scope="col" className="py-2 pe-3 text-start font-medium">
                  {t("byRep.rep")}
                </th>
                {(["leads", "won", "lost", "winRate", "openValue"] as const).map((key) => (
                  <th key={key} scope="col" className="py-2 ps-3 text-end font-medium">
                    {t(`byRep.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.byRep.map((row) => (
                <tr key={row.agentId} className="border-border border-b last:border-0">
                  <th scope="row" className="py-2.5 pe-3 text-start font-medium">
                    <a href={`/sales/pipeline?rep=${row.agentId}`} className="text-link hover:underline">
                      {row.name}
                    </a>
                  </th>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    <Figure
                      name="repLeads"
                      source={{ label: row.name, href: `/sales/pipeline?rep=${row.agentId}` }}
                      asOf={asOf}
                    >
                      {format.number(row.leads)}
                    </Figure>
                  </td>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    <Figure
                      name="won"
                      source={{ label: row.name, href: `/sales/pipeline?rep=${row.agentId}&view=closed` }}
                      asOf={asOf}
                    >
                      {format.number(row.won)}
                    </Figure>
                  </td>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    <Figure
                      name="lost"
                      source={{ label: row.name, href: `/sales/pipeline?rep=${row.agentId}&view=closed` }}
                      asOf={asOf}
                    >
                      {format.number(row.lost)}
                    </Figure>
                  </td>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    <Figure name="winRate" source={{ label: row.name, href: null }} asOf={asOf}>
                      {row.winRatePct === null ? "—" : format.percent(row.winRatePct, 1)}
                    </Figure>
                  </td>
                  <td className="py-2.5 ps-3 text-end tabular-nums">
                    <Figure
                      name="openValue"
                      source={{ label: row.name, href: `/sales/pipeline?rep=${row.agentId}` }}
                      asOf={asOf}
                    >
                      {format.thb(row.openValue)}
                    </Figure>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("split.title")} hint={t("split.hint")}>
        <dl className="grid gap-4 sm:grid-cols-2">
          {d.split.map((row) => (
            <div key={row.agentKind} className="bg-surface-subtle rounded-card flex flex-col gap-3 p-4">
              <dt className="font-semibold">{t(`kinds.${row.agentKind}`)}</dt>
              <dd className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                {(
                  [
                    ["leads", format.number(row.leads)],
                    ["won", format.number(row.won)],
                    ["winRate", row.winRatePct === null ? "—" : format.percent(row.winRatePct, 1)],
                    ["openValue", format.thb(row.openValue)],
                  ] as const
                ).map(([key, value]) => (
                  <span key={key} className="flex flex-col">
                    <span className="text-muted text-xs">{t(`kpi.${key}`)}</span>
                    <Figure
                      name={key}
                      source={src(t(`kinds.${row.agentKind}`))}
                      asOf={asOf}
                      className="self-start font-semibold tabular-nums"
                    >
                      {value}
                    </Figure>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-3 border p-4 sm:p-5">
      <header>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}
