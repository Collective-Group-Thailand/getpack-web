"use client";

import { cn } from "../lib/cn";
import { Tooltip } from "./Tooltip";

export interface BarDatum {
  key: string;
  label: string;
  /** For drawing only (bar length). The reader sees `display`. */
  value: number;
  display: string;
  /** A second, quieter figure after the value ("−24% จากขั้นก่อน"). */
  aside?: string;
  /** What the hover/focus readout says beyond the label and value. */
  tip?: React.ReactNode;
  href?: string;
}

/**
 * One measure across categories as ranked horizontal bars (dataviz: bars on one baseline compare more exactly than
 * segments; one hue for one series; ≤ 24 px; 4 px rounded data end, square at the baseline). The label sits on the
 * left in body ink, the value at the bar's end in body ink — never in the series colour. Each row is one hover and
 * focus target (bigger than the mark) with its readout, and is named with the same figures for a screen reader.
 */
export function BarList({
  title,
  data,
  max,
  className,
  tone = "primary",
}: {
  title: string;
  data: readonly BarDatum[];
  /** The scale's end; defaults to the largest value. */
  max?: number;
  className?: string;
  tone?: "primary" | "muted";
}) {
  const top = max ?? Math.max(1, ...data.map((datum) => datum.value));
  return (
    <figure aria-label={title} className={cn("flex min-w-0 flex-col", className)}>
      <ul className="flex flex-col" aria-label={title}>
        {data.map((datum) => (
          <Tooltip
            key={datum.key}
            side="top"
            align="start"
            content={
              <span className="flex flex-col gap-0.5">
                <strong className="text-sm tabular-nums">{datum.display}</strong>
                <span className="opacity-80">{datum.label}</span>
                {datum.aside ? <span className="opacity-80">{datum.aside}</span> : null}
                {datum.tip}
              </span>
            }
          >
            <li
              tabIndex={0}
              aria-label={[datum.label, datum.display, datum.aside].filter(Boolean).join(" · ")}
              className="group focus-visible:ring-focus-ring hover:bg-surface-subtle/70 grid grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)] items-center gap-x-3 rounded-md px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
            >
              <span className="truncate text-sm">{datum.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="relative h-4 min-w-0 flex-1">
                  <span
                    className={cn(
                      "rounded-e-thumb absolute inset-y-0 start-0 transition-[filter] duration-150 group-hover:brightness-95 motion-reduce:transition-none",
                      tone === "primary" ? "bg-primary" : "bg-border-strong",
                    )}
                    style={{
                      width: `${Math.max(0, Math.min(1, datum.value / top)) * 100}%`,
                      minWidth: datum.value > 0 ? 2 : 0,
                    }}
                  />
                </span>
                <span className="w-16 shrink-0 text-end text-sm font-medium tabular-nums">{datum.display}</span>
              </span>
            </li>
          </Tooltip>
        ))}
      </ul>
    </figure>
  );
}

/**
 * One measure over time as columns (a count per week or month): hairline grid with labelled ticks, columns ≤ 24 px
 * with a 4 px rounded top, the last period in the brand colour and the earlier ones in its light tint (emphasis: the
 * story is "now"). Every column is a hover and focus target, named with its period and value for a screen reader.
 */
export function ColumnChart({
  title,
  data,
  height = 160,
  formatTick = (value: number) => String(value),
  className,
}: {
  title: string;
  data: readonly BarDatum[];
  height?: number;
  formatTick?: (value: number) => string;
  className?: string;
}) {
  const peak = Math.max(1, ...data.map((datum) => datum.value));
  // Clean ticks: a step of 1, 2 or 5 × 10ⁿ, three or four lines.
  const rough = peak / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= rough) ?? power * 10;
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (value: number) => (1 - value / top) * 100;
  return (
    <figure aria-label={title} className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div aria-hidden className="relative w-8" style={{ height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="text-muted absolute end-0 -translate-y-1/2 text-xs tabular-nums"
              style={{ top: `${y(tick)}%` }}
            >
              {formatTick(tick)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className={cn("absolute inset-x-0 border-t", tick === 0 ? "border-border-strong" : "border-border")}
              style={{ top: `${y(tick)}%` }}
            />
          ))}
          <ul aria-label={title} className="absolute inset-0 flex items-end">
            {data.map((datum, at) => (
              <Tooltip
                key={datum.key}
                content={
                  <span className="flex flex-col gap-0.5">
                    <strong className="text-sm tabular-nums">{datum.display}</strong>
                    <span className="opacity-80">{datum.label}</span>
                    {datum.tip}
                  </span>
                }
              >
                <li
                  tabIndex={0}
                  aria-label={`${datum.label}: ${datum.display}`}
                  className="group focus-visible:ring-focus-ring hover:bg-surface-subtle/60 relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2"
                >
                  <span
                    className={cn(
                      "rounded-t-thumb w-full max-w-6 transition-[filter] duration-150 group-hover:brightness-95 motion-reduce:transition-none",
                      at === data.length - 1 ? "bg-primary" : "bg-primary/40",
                    )}
                    style={{ height: `${(datum.value / top) * 100}%`, minHeight: datum.value > 0 ? 2 : 0 }}
                  />
                </li>
              </Tooltip>
            ))}
          </ul>
        </div>
        <span />
        <div
          aria-hidden
          className="mt-1.5 grid"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        >
          {data.map((datum, at) => (
            <span
              key={datum.key}
              className={cn(
                "text-muted truncate px-0.5 text-center text-xs",
                // Dense weekly axes label every other period.
                data.length > 8 && at % 2 === 1 && "invisible",
              )}
            >
              {datum.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
