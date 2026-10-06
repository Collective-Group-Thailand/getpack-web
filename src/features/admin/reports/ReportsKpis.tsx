"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";

import { adminBrowserApis, useCan } from "../console";
import { addDays, bangkokToday } from "../analytics/period";

/** This month so far, to yesterday (the rollups are nightly); last month on the 1st. */
function monthToDate(now: Date = new Date()): { from: string; to: string } {
  const to = addDays(bangkokToday(now), -1);
  return { from: `${to.slice(0, 8)}01`, to };
}

/** A line of counts, scaled to its own height — the shape of the month, not a chart to read. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${28 - (value / max) * 26}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="text-primary h-8 w-full"
      role="img"
      aria-label={label}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The reports page's figures first (UX audit, /reports: "แถวบน KPI 4 ตัว + sparkline"): this month's
 * sales, paid orders, average order and repeat rate, from the sales rollup (`admin.analytics.sales`)
 * — every figure the API's. Shown to whoever may read analytics; the reports follow either way.
 */
export function ReportsKpis() {
  const t = useTranslations("reports.kpis");
  const format = useFormat();
  const canRead = useCan("analytics.read");
  const period = monthToDate();
  const sales = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "reports-kpis", ...period }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/analytics/sales", {
          params: { query: { ...period, interval: "day" } },
        })
      ).data!,
    enabled: canRead,
  });
  if (!canRead || !sales.data) return null;
  const paid = sales.data.series.map((point) => point.groupsPaid);
  const tiles = [
    { key: "gmv", value: format.thb(sales.data.totals.gmv) },
    { key: "paid", value: format.number(sales.data.totals.groupsPaid) },
    { key: "aov", value: format.thb(sales.data.totals.aov) },
    { key: "repeat", value: format.percent(sales.data.totals.repeatRatePct) },
  ];
  return (
    <section aria-labelledby="reports-kpis" className="flex flex-col gap-3">
      <h2 id="reports-kpis" className="text-muted text-sm font-medium">
        {t("title", { from: format.date(period.from), to: format.date(period.to) })}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key} className="border-border bg-surface rounded-card flex flex-col gap-1 border p-5">
            <span className="text-muted text-sm">{t(tile.key)}</span>
            <span className="text-2xl font-bold tabular-nums">{tile.value}</span>
            {tile.key === "paid" ? <Sparkline values={paid} label={t("sparkline")} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
