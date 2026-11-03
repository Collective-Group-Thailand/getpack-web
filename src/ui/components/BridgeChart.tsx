"use client";

import { Fragment, useId, useState } from "react";

import { cn } from "../lib/cn";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

export interface BridgeStep {
  key: string;
  label: string;
  /** `total` bars stand on zero (list revenue, net revenue, gross margin, the bottom line); `delta` bars hang from the running total. */
  kind: "total" | "delta";
  /**
   * For drawing only, parsed from the API's decimal string: a total's amount, or a delta's signed change (a deduction
   * is negative). Every figure a reader sees is `display` — the API's own string, formatted by the page.
   */
  value: number;
  display: string;
  /** A second figure beside the value ("18.20%"). */
  share?: string;
  /** One short line under the label ("ยังไม่ได้ตั้งค่า"). */
  note?: string;
  /** What the step means, how it is worked out, where it comes from — shown on hover and focus. */
  tip?: React.ReactNode;
  /** The bottom line: drawn in the brand colour and set in bold. */
  emphasis?: boolean;
}

export interface BridgeChartProps {
  /** The accessible name of the chart and the caption of its table. */
  title: string;
  steps: readonly BridgeStep[];
  /** A threshold drawn across every row (the walk-away margin floor), at an amount on the same scale. */
  threshold?: { value: number; label: string };
  /** A name repeated faintly across the drawing (who is looking at these figures — D-470). */
  watermark?: string;
  labels: { showTable: string; hideTable: string; step: string; amount: string; share: string };
  className?: string;
}

/**
 * A vertical bridge (waterfall) read top to bottom, the way a P&L is: each row a step, the bar on a shared horizontal
 * scale, totals standing on zero and changes hanging from the running total; a threshold line runs through every
 * row. Calm by rule (dataviz): ≤ 24 px bars with a 4 px rounded data end, hairline zero line, totals in the brand
 * colour only where `emphasis` says so, deductions in neutral grey and increases in a light brand tint — the sign is
 * always printed, so nothing rests on colour. Each row is one hover/focus target with its explanation, and the same
 * figures are a table (always read by a screen reader; shown on request).
 *
 * Geometry is the only arithmetic here (pixels from the parsed numbers); every number on screen is `display`.
 */
export function BridgeChart({ title, steps, threshold, watermark, labels, className }: BridgeChartProps) {
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();

  // Where each bar starts and ends on the value scale.
  const spans = steps.reduce<{ from: number; to: number }[]>((all, step) => {
    const running = all.at(-1)?.to ?? 0;
    all.push(step.kind === "total" ? { from: 0, to: step.value } : { from: running, to: running + step.value });
    return all;
  }, []);
  const ends = spans.flatMap((span) => [span.from, span.to]);
  const min = Math.min(0, ...ends, threshold?.value ?? 0);
  const max = Math.max(1, ...ends, threshold?.value ?? 0);
  const x = (value: number) => ((value - min) / (max - min)) * 100;

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
        <div className="relative isolate overflow-hidden">
          <ul aria-label={title} className="flex flex-col">
            {steps.map((step, at) => {
              const span = spans[at]!;
              const left = x(Math.min(span.from, span.to));
              const width = Math.max(Math.abs(x(span.to) - x(span.from)), 0.4);
              const deduction = step.kind === "delta" && step.value < 0;
              const row = (
                <li
                  tabIndex={0}
                  aria-label={`${step.label}: ${step.display}${step.share ? ` (${step.share})` : ""}`}
                  className={cn(
                    "group focus-visible:ring-focus-ring grid grid-cols-[minmax(7.5rem,13rem)_minmax(0,1fr)_minmax(6.5rem,auto)] items-center gap-x-3 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-inset",
                    "hover:bg-surface-subtle/70",
                    step.kind === "total" && at > 0 && "border-border border-t",
                  )}
                >
                  <span className="flex min-w-0 flex-col py-2">
                    <span
                      className={cn("text-sm leading-snug", step.kind === "total" ? "font-semibold" : "text-muted")}
                    >
                      {step.label}
                    </span>
                    {step.note ? <span className="text-warning-subtle-fg text-xs">{step.note}</span> : null}
                  </span>
                  <span aria-hidden className="relative h-9 self-stretch">
                    {min < 0 ? (
                      <span className="bg-border-strong absolute inset-y-0 w-px" style={{ left: `${x(0)}%` }} />
                    ) : null}
                    {threshold ? (
                      <span
                        className="border-danger absolute inset-y-0 border-l border-dashed"
                        style={{ left: `${x(threshold.value)}%` }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "absolute top-1/2 h-4 -translate-y-1/2 transition-[filter] duration-150 group-hover:brightness-95 motion-reduce:transition-none sm:h-5",
                        step.kind === "total"
                          ? step.emphasis
                            ? "bg-primary"
                            : "bg-muted"
                          : deduction
                            ? "bg-border-strong"
                            : "bg-primary/35",
                        // A 4 px rounded data end; square where the bar starts (zero for a total, the running total for a change).
                        step.kind === "total" || !deduction ? "rounded-e-thumb" : "rounded-s-thumb",
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </span>
                  <span className="flex flex-col items-end py-2 text-end">
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        step.kind === "total" ? "font-semibold" : "",
                        step.emphasis && "text-base font-bold",
                      )}
                    >
                      {step.display}
                    </span>
                    {step.share ? <span className="text-muted text-xs tabular-nums">{step.share}</span> : null}
                  </span>
                </li>
              );
              return step.tip ? (
                <Tooltip key={step.key} content={step.tip} side="top" align="end">
                  {row}
                </Tooltip>
              ) : (
                <Fragment key={step.key}>{row}</Fragment>
              );
            })}
          </ul>
          {threshold ? (
            <p className="text-muted mt-2 flex items-center gap-2 text-xs">
              <span aria-hidden className="border-danger h-3 border-l border-dashed" />
              {threshold.label}
            </p>
          ) : null}
          {watermark ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 flex flex-wrap content-center items-center justify-center gap-x-16 gap-y-10 overflow-hidden select-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="text-fg/[0.06] -rotate-[18deg] text-sm font-semibold whitespace-nowrap">
                  {watermark}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <div id={tableId} className={asTable ? "overflow-x-auto" : "sr-only"}>
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-muted border-border border-b text-left text-xs">
              <th scope="col" className="py-1.5 pe-3 font-medium">
                {labels.step}
              </th>
              <th scope="col" className="py-1.5 pe-3 text-end font-medium">
                {labels.amount}
              </th>
              <th scope="col" className="py-1.5 text-end font-medium">
                {labels.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.key} className="border-border border-b last:border-0">
                <th
                  scope="row"
                  className={cn("py-1.5 pe-3 text-start", step.kind === "total" ? "font-semibold" : "font-normal")}
                >
                  {step.label}
                  {step.note ? <span className="text-muted block text-xs font-normal">{step.note}</span> : null}
                </th>
                <td className="py-1.5 pe-3 text-end tabular-nums">{step.display}</td>
                <td className="py-1.5 text-end tabular-nums">{step.share ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {asTable && watermark ? <p className="text-muted mt-2 text-xs">{watermark}</p> : null}
      </div>
    </figure>
  );
}
