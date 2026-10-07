import { cn } from "../lib/cn";

export interface MeterProps {
  /** 0–100, as the API reports it (a campaign's budget used, revision rounds used). */
  value: number;
  /** Accessible name. */
  label: string;
  /** What a screen reader hears instead of "62 percent": "ใช้ไป ฿62,000 จาก ฿100,000". */
  valueText: string;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
  /**
   * A threshold drawn on the track (e.g. a budget alert). Its meaning belongs in `valueText`
   * too: the tick is decoration for sighted users, not the only carrier of the information.
   */
  marker?: number;
}

/**
 * A gauge (`role="meter"`), not a progress bar: it measures an amount, it is not a task
 * finishing. The value is clamped for drawing only; `valueText` carries the real figures.
 */
export function Meter({ value, label, valueText, tone = "primary", className, marker }: MeterProps) {
  const width = Math.min(100, Math.max(0, value));
  const meter = (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={valueText}
      className={cn("bg-surface-subtle h-2 w-full overflow-hidden rounded-control", className)}
    >
      <div
        className={cn(
          "h-full rounded-control",
          tone === "primary" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
  if (marker === undefined) return meter;
  return (
    <div className="relative">
      {meter}
      <span
        aria-hidden
        className="bg-fg absolute -top-0.5 h-3 w-0.5 rounded-control"
        style={{ left: `calc(${Math.min(100, Math.max(0, marker))}% - 1px)` }}
      />
    </div>
  );
}
