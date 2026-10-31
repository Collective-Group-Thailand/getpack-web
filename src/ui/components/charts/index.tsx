import { cn } from "@/ui/lib/cn";

/**
 * Report charts for the partner desk (groups 7–8): drawn on the server from the API's own figures — no chart
 * library, no animation. Calm by rule: hairline grid, one brand-green series (the one the chart is about),
 * muted greys for anything it is read against, axis labels in the body font with tabular numerals, and the
 * same figures as a table for a screen reader. Widths and heights are drawing only; every number a reader
 * sees is a figure the API sent, formatted by the page.
 */

const clamp = (value: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);

/**
 * A figure with a thin bar under it, for a table cell (a month's revenue next to its cost): the bar's length is
 * the value against the column's largest, so the column reads as a chart without leaving the table.
 */
export function BarValue({
  value,
  max,
  tone = "primary",
  children,
}: {
  value: number;
  max: number;
  tone?: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex w-full min-w-24 flex-col items-start gap-1.5 lg:items-end">
      <span className="tabular-nums">{children}</span>
      <span aria-hidden className="bg-surface-subtle rounded-thumb block h-1 w-full max-w-36 overflow-hidden">
        <span
          className={cn(
            "rounded-thumb block h-full lg:ms-auto",
            tone === "primary" ? "bg-primary" : "bg-border-strong",
          )}
          style={{ width: `${clamp(value, max) * 100}%` }}
        />
      </span>
    </span>
  );
}

const PART_FILL = ["bg-primary", "bg-muted", "bg-border-strong", "bg-border"] as const;

/**
 * What a total is made of (a month's cost: materials, machine, labour, overhead) as one ruled bar and a legend of
 * the parts with their amounts. The first part is the green one; the rest step down in grey. Nothing is drawn
 * when the total is nothing — a bar of zeros says less than the figures beside it.
 */
export function Composition({
  label,
  parts,
}: {
  label: string;
  parts: { key: string; label: React.ReactNode; value: number; display: React.ReactNode }[];
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  if (total <= 0) return null;
  return (
    <figure aria-label={label} className="flex flex-col gap-3">
      <div aria-hidden className="rounded-thumb bg-surface-subtle flex h-2.5 w-full gap-0.5 overflow-hidden">
        {parts.map((part, at) =>
          part.value > 0 ? (
            <span
              key={part.key}
              className={cn("h-full", PART_FILL[Math.min(at, PART_FILL.length - 1)])}
              style={{ width: `${(part.value / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:flex sm:flex-wrap">
        {parts.map((part, at) => (
          <div key={part.key} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn("rounded-thumb size-2.5 shrink-0", PART_FILL[Math.min(at, PART_FILL.length - 1)])}
            />
            <dt className="text-muted">{part.label}</dt>
            <dd className="font-medium tabular-nums">{part.display}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

export interface TrendPoint {
  key: string;
  /** The x label (a month, a day), already formatted. */
  label: string;
  /** `null`: not measured that period — the line breaks instead of dropping to zero. */
  value: number | null;
  /** The value as the reader sees it ("87.5%"), for the table and the last point's label. */
  display: string;
}

/**
 * One measure over time (a scorecard metric by month, a machine's OEE by day): a thin green line on a hairline
 * grid with labelled ticks, a dot on each measured period and the last one filled. The SVG stretches with the
 * column (its stroke does not); the labels are HTML so they never stretch with it.
 */
export function TrendChart({
  title,
  points,
  max = 100,
  ticks = [0, 50, 100],
  formatTick = (value: number) => String(value),
  height = 140,
  className,
}: {
  title: string;
  points: readonly TrendPoint[];
  max?: number;
  ticks?: readonly number[];
  formatTick?: (value: number) => string;
  height?: number;
  className?: string;
}) {
  const n = points.length;
  const x = (at: number) => ((at + 0.5) / n) * 100;
  const y = (value: number) => (1 - clamp(value, max)) * 100;
  // A gap (null) ends a segment: the line never invents the months it did not measure.
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((point, at) => {
    if (point.value === null) {
      if (run.length) segments.push(run.join(" "));
      run = [];
    } else run.push(`${x(at)},${y(point.value)}`);
  });
  if (run.length) segments.push(run.join(" "));
  const last = [...points].reverse().find((point) => point.value !== null);

  return (
    <figure aria-label={title} className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div aria-hidden className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="relative w-9" style={{ height }}>
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
              className={cn("absolute inset-x-0 border-t", tick === 0 ? "border-border-strong" : "border-border")}
              style={{ top: `${y(tick)}%` }}
            />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {segments.map((segment) => (
              <polyline
                key={segment}
                points={segment}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {points.map((point, at) =>
            point.value === null ? null : (
              <span
                key={point.key}
                className={cn(
                  "border-primary absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]",
                  point === last ? "bg-primary" : "bg-surface",
                )}
                style={{ left: `${x(at)}%`, top: `${y(point.value)}%` }}
              />
            ),
          )}
        </div>
        <span />
        <div className="mt-1.5 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {points.map((point) => (
            <span key={point.key} className="text-muted truncate px-0.5 text-center text-xs">
              {point.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              <td>{point.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
