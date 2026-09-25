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
}

/**
 * A gauge (`role="meter"`), not a progress bar: it measures an amount, it is not a task
 * finishing. The value is clamped for drawing only; `valueText` carries the real figures.
 */
export function Meter({ value, label, valueText, tone = "primary", className }: MeterProps) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={valueText}
      className={cn("bg-surface-subtle h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full",
          tone === "primary" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
