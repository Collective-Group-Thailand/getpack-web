"use client";

import { useTranslations } from "next-intl";

import { FigureTip } from "@/ui/components/FigureTip";
import { Chart } from "@/ui/components/Chart";
import { cn } from "@/ui/lib/cn";

import { usePnlFormat } from "./format";
import { CHART_LINES, type PnlGrid, type PnlLineKey, type PnlVariance } from "./resources";

/**
 * The year at a glance (D-472 item 5): net revenue, gross margin %, contribution after commission, EBITDA, net profit,
 * the cash conversion cycle and the break-even revenue — the API's `PnlSummaryDto`, never added up here. One strip,
 * hairline dividers, tabular figures; each figure explains itself on hover and focus. "กำไรสุทธิ" is the net profit
 * line's own label; the contribution figure is "กำไรหลังหักค่าคอม", never "กำไรสุทธิ".
 */
export function SummaryStrip({ grid }: { grid: PnlGrid }) {
  const t = useTranslations("finance.pnl.summary");
  const format = usePnlFormat();
  const s = grid.summary;
  const netProfitLine = grid.lines.find((row) => row.line.key === "net_profit")?.line;
  const tip = (name: string, children: React.ReactNode) => (
    <FigureTip
      definition={t(`figures.${name}.definition`)}
      formula={t(`figures.${name}.formula`)}
      source={{ label: t("source") }}
      asOf={format.dateTime(grid.plan.computedAt)}
      labels={{ formula: t("formulaLabel"), source: t("sourceLabel"), asOf: t("asOf") }}
    >
      {children}
    </FigureTip>
  );
  const items: { key: string; label: string; value: React.ReactNode; hint?: string; tone?: "danger" }[] = [
    { key: "netRevenue", label: t("netRevenue"), value: tip("netRevenue", format.thb(s.netRevenue)) },
    {
      key: "grossMarginPct",
      label: t("grossMarginPct"),
      value: tip("grossMarginPct", format.percent(s.grossMarginPct)),
      hint: t("grossMarginHint", { amount: format.thb(s.grossMargin) }),
    },
    {
      key: "contribution",
      label: t("contribution"),
      value: tip("contribution", format.thb(s.contributionAfterCommission)),
      hint: t("contributionHint", { pct: format.percent(s.contributionAfterCommissionPct) }),
    },
    {
      key: "netProfit",
      label: netProfitLine ? format.label(netProfitLine) : t("netProfit"),
      value: tip("netProfit", format.thb(s.netProfit)),
      hint: s.citSmeApplied ? t("citSme") : t("citStandard"),
      tone: s.netProfit?.startsWith("-") ? "danger" : undefined,
    },
    { key: "ebitda", label: t("ebitda"), value: tip("ebitda", format.thb(s.ebitda)) },
    {
      key: "ccc",
      label: t("ccc"),
      value: tip("ccc", s.cashConversionDays === null ? "—" : t("days", { days: format.plain(s.cashConversionDays) })),
    },
    {
      key: "breakEven",
      label: t("breakEven"),
      value: tip("breakEven", format.thb(s.breakEvenRevenue)),
      hint: t("breakEvenHint"),
    },
  ];
  return (
    <section aria-labelledby="pnl-summary" className="border-border bg-surface rounded-card border">
      <h2 id="pnl-summary" className="sr-only">
        {t("label")}
      </h2>
      <dl className="divide-border [&>div]:bg-surface bg-border rounded-card grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col gap-1 px-4 py-3" data-summary={item.key}>
            <dt className="text-muted text-xs leading-snug">{item.label}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", item.tone === "danger" && "text-danger")}>
              {item.value}
            </dd>
            {item.hint ? <dd className="text-muted text-xs leading-snug">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A decimal string as a number for drawing a bar only; the reader is shown the API's figures in the table view. */
const draw = (value: string | null | undefined) => (value === null || value === undefined ? null : Number(value));

/**
 * Revenue and net profit by month (D-472 item 5): two charts, one measure each, on one axis each. With the variance
 * switch on they pair the plan with the actual for the months that have one (the API's variance view); otherwise
 * they draw the plan. Legends name the pair; the figures are in each chart's table for a screen reader and on demand.
 */
export function PnlCharts({ grid, variance }: { grid: PnlGrid; variance: PnlVariance | undefined }) {
  const t = useTranslations("finance.pnl.chart");
  const format = usePnlFormat();
  const months = grid.months.map((month) => month.month);
  const series = (key: PnlLineKey) => {
    if (variance) {
      const line = variance.lines.find((row) => row.line.key === key);
      return months.map((month, at) => ({
        month,
        plan: draw(line?.cells[at]?.plan),
        actual: draw(line?.cells[at]?.actual),
      }));
    }
    const line = grid.lines.find((row) => row.line.key === key);
    return months.map((month, at) => ({ month, plan: draw(line?.cells[at]?.value) }));
  };
  const lines = variance
    ? ([
        { key: "plan", label: t("plan"), tone: "plan" },
        { key: "actual", label: t("actual"), tone: "actual" },
      ] as const)
    : ([{ key: "plan", label: t("value"), tone: "actual" }] as const);
  const money = (value: number) =>
    format.thb(
      value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
    );
  const charts = [
    { key: "revenue", title: t("revenueTitle"), line: CHART_LINES.revenue },
    { key: "profit", title: t("profitTitle"), line: CHART_LINES.profit },
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((chart) => (
        <section
          key={chart.key}
          className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-1 border p-4"
          data-chart={chart.key}
        >
          <h2 className="text-sm font-semibold">{chart.title}</h2>
          {variance ? <p className="text-muted text-xs">{t("caption")}</p> : null}
          <Chart
            kind="bar"
            title={chart.title}
            data={series(chart.line)}
            index="month"
            indexLabel={t("month")}
            series={lines}
            height={220}
            formatValue={money}
            formatTick={format.compact}
            formatIndex={(month) => format.month(month).split(" ")[0] ?? month}
            labels={{ showTable: t("showTable"), hideTable: t("hideTable") }}
          />
        </section>
      ))}
    </div>
  );
}
