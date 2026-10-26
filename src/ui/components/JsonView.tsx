import { cn } from "../lib/cn";

export interface JsonViewProps {
  value: unknown;
  /** Accessible name of the region, e.g. "ข้อมูลที่บันทึก". */
  label: string;
  className?: string;
}

/**
 * Structured data as the API stored it — an audit entry's redacted `data`, an approval's frozen
 * `payload`. Monospace and scrollable; it is evidence, so it is shown exactly, not prettified away.
 */
export function JsonView({ value, label, className }: JsonViewProps) {
  return (
    <pre
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "bg-surface-subtle border-border max-h-80 overflow-auto rounded-md border p-3 text-xs leading-relaxed tabular-nums",
        className,
      )}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
