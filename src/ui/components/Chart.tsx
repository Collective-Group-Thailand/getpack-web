"use client";

import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "../lib/cn";
import { Button } from "./Button";

/**
 * The semantic tones, plus a validated pair for a plan against its actual (D-472): `plan` blue-400 #81afff and
 * `actual` brand-600 #24907a — the dataviz validator passes lightness band, chroma floor, CVD (ΔE 20.2 deutan) and
 * the normal-vision floor; `plan` sits under 3:1 on the surface, so a chart using it always has its legend and the
 * table view (this component's own).
 */
export type ChartTone = "primary" | "info" | "success" | "warning" | "danger" | "neutral" | "plan" | "actual";

export interface ChartSeries {
  key: string;
  label: string;
  tone?: ChartTone;
}

export interface ChartProps<TRow extends Record<string, unknown>> {
  kind: "bar" | "line";
  /** The accessible name of the chart and the caption of its data table. */
  title: string;
  data: readonly TRow[];
  /** The category (x) field. */
  index: keyof TRow & string;
  indexLabel: string;
  series: readonly ChartSeries[];
  stacked?: boolean;
  /** `vertical` draws horizontal bars — for long category names such as provinces. */
  layout?: "horizontal" | "vertical";
  height?: number;
  formatValue?: (value: number, seriesKey: string) => string;
  /** The value axis' ticks, when they should be shorter than the tooltip's figures (฿2.4M rather than ฿2,400,000.00). */
  formatTick?: (value: number) => string;
  formatIndex?: (value: string) => string;
  labels: { showTable: string; hideTable: string };
  className?: string;
}

const TONES: readonly ChartTone[] = ["primary", "info", "success", "warning", "danger", "neutral"];
const PAIR: Partial<Record<ChartTone, string>> = { plan: "var(--color-blue-400)", actual: "var(--color-brand-600)" };
const colour = (tone: ChartTone) => PAIR[tone] ?? `var(--color-${tone})`;

/**
 * A bar or line chart (design-system.md §3 "Charts"): Recharts, coloured only from the semantic
 * tones, with the same figures as a data table. The drawing is hidden from assistive technology;
 * the table is what a screen reader reads, and anyone can show it instead of the drawing.
 * Recharts' own keyboard layer is off: it would put focusable points inside the hidden drawing.
 *
 * Values are numbers for drawing only; `formatValue` turns them back into the words (฿, %) the
 * page already formats elsewhere. Imported by path — not in the `src/ui` barrel — so Recharts
 * reaches only the pages that draw charts.
 */
export function Chart<TRow extends Record<string, unknown>>({
  kind,
  title,
  data,
  index,
  indexLabel,
  series,
  stacked = false,
  layout = "horizontal",
  height = 260,
  formatValue = (value) => String(value),
  formatTick,
  formatIndex = (value) => value,
  labels,
  className,
}: ChartProps<TRow>) {
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();
  const toneOf = (at: number) => series[at]?.tone ?? TONES[at % TONES.length]!;
  const vertical = layout === "vertical";
  // Recharts types a data key against its own row generic; the axes here are not generic.
  const indexKey: string = index;

  const axes = (
    <>
      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={vertical} horizontal={!vertical} />
      {vertical ? (
        <>
          <XAxis
            type="number"
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickFormatter={(value: number) => formatValue(value, series[0]?.key ?? "")}
          />
          <YAxis
            type="category"
            dataKey={indexKey}
            width={140}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickFormatter={(value: string) => formatIndex(String(value))}
          />
        </>
      ) : (
        <>
          <XAxis
            dataKey={indexKey}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickFormatter={(value: string) => formatIndex(String(value))}
          />
          <YAxis
            width={72}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickFormatter={(value: number) =>
              formatTick ? formatTick(value) : formatValue(value, series[0]?.key ?? "")
            }
          />
        </>
      )}
      <Tooltip
        formatter={(value, name) => [
          formatValue(Number(value), String(name)),
          series.find((item) => item.key === name)?.label ?? String(name),
        ]}
        labelFormatter={(value) => formatIndex(String(value))}
        contentStyle={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-control)",
          color: "var(--color-fg)",
        }}
      />
      {series.length > 1 ? (
        <Legend
          formatter={(key) => (
            // Legend text in body colour: a series tone is not a checked text-contrast pair.
            <span style={{ color: "var(--color-fg)" }}>{series.find((item) => item.key === key)?.label ?? key}</span>
          )}
        />
      ) : null}
    </>
  );

  return (
    <figure aria-label={title} className={cn("flex flex-col gap-2", className)}>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          aria-controls={tableId}
          aria-expanded={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? labels.hideTable : labels.showTable}
        </Button>
      </div>
      {asTable ? null : (
        <div aria-hidden style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart
                accessibilityLayer={false}
                data={data as TRow[]}
                layout={vertical ? "vertical" : "horizontal"}
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                {axes}
                {series.map((item, at) => (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    fill={colour(toneOf(at))}
                    stackId={stacked ? "stack" : undefined}
                    radius={stacked ? 0 : 4}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart
                accessibilityLayer={false}
                data={data as TRow[]}
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                {axes}
                {series.map((item, at) => (
                  <Line
                    key={item.key}
                    dataKey={item.key}
                    stroke={colour(toneOf(at))}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <div id={tableId} className={asTable ? "overflow-x-auto" : "sr-only"}>
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-muted border-border border-b text-left text-xs">
              <th scope="col" className="py-1.5 pe-3 font-medium">
                {indexLabel}
              </th>
              {series.map((item) => (
                <th key={item.key} scope="col" className="py-1.5 pe-3 text-right font-medium">
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {data.map((row, at) => (
              <tr key={at}>
                <th scope="row" className="py-1.5 pe-3 text-left font-normal">
                  {formatIndex(String(row[index]))}
                </th>
                {series.map((item) => (
                  <td key={item.key} className="py-1.5 pe-3 text-right tabular-nums">
                    {row[item.key] === null || row[item.key] === undefined
                      ? "—"
                      : formatValue(Number(row[item.key]), item.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
