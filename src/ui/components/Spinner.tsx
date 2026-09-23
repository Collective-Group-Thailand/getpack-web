import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface SpinnerProps {
  /**
   * Announced to screen readers. Required rather than defaulted, because a default would be
   * hard-coded copy in one language — strings come from `src/i18n` (design-system.md §8).
   * Pass `null` when something nearby already says the page is loading, so a screen reader
   * does not hear the same news twice.
   */
  label: string | null;
  size?: number;
  className?: string;
}

/** A busy indicator that names itself. Honours `prefers-reduced-motion` via base.css. */
export function Spinner({ label, size = 20, className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <Icon name="spinner" size={size} className="animate-spin" />
      {label === null ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
