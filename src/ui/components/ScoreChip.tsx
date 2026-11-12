import { cn } from "../lib/cn";
import { Icon } from "../icons";

type Tone = "neutral" | "info" | "success" | "primary" | "warning" | "danger";

export interface ScoreChipProps extends React.HTMLAttributes<HTMLElement> {
  /** 0–100 as the API sends it; `null` = not scored yet (an en dash, never a zero). */
  value: number | null;
  /** The tone the caller takes from `src/domain/status` — the chip never decides what a number means. */
  tone?: Tone;
  /**
   * What a screen reader hears, e.g. "คะแนน 72 จาก 100". Required: the number alone says nothing about
   * its scale.
   */
  label: string;
  /** A button (the trigger of a popover with the reasons) rather than a plain label. */
  interactive?: boolean;
  size?: "sm" | "md";
  ref?: React.Ref<HTMLElement>;
}

const RING: Record<Tone, string> = {
  neutral: "text-neutral-subtle-fg",
  info: "text-info",
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * A lead score, 0–100 (D-471): the number in tabular figures beside a small ring that fills with it, so a column of
 * scores scans by shape before it is read. The ring is decoration (`aria-hidden`); the label carries the scale.
 * Interactive, it is a real `<button>` with a visible focus ring and a 32 px hit area around the 24 px chip — the
 * trigger of the reasons popover on the staff surfaces; on the agent's own leads it is a plain label.
 */
export function ScoreChip({
  value,
  tone = "neutral",
  label,
  interactive = false,
  size = "md",
  className,
  ref,
  ...props
}: ScoreChipProps) {
  const scored = value !== null && Number.isFinite(value);
  const pct = scored ? Math.min(100, Math.max(0, value)) : 0;
  const r = 6;
  const circumference = 2 * Math.PI * r;
  const body = (
    <>
      <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" className="shrink-0 -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
        {scored ? (
          <circle
            cx="8"
            cy="8"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            className={RING[tone]}
          />
        ) : null}
      </svg>
      <span aria-hidden="true" className="min-w-[2ch] text-end font-semibold tabular-nums">
        {scored ? Math.round(pct) : "–"}
      </span>
      {interactive ? <Icon name="chevron-down" size={12} aria-hidden="true" className="text-muted -me-0.5" /> : null}
      <span className="sr-only">{label}</span>
    </>
  );
  const classes = cn(
    "rounded-control border-border bg-surface text-fg inline-flex items-center gap-1.5 border whitespace-nowrap",
    size === "sm" ? "h-6 px-1.5 text-xs" : "h-7 px-2 text-sm",
    className,
  );
  return interactive ? (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={cn(
        classes,
        // A 32 px target around the chip without changing its look (touch, WCAG 2.5.8).
        "relative cursor-pointer transition-colors duration-150 before:absolute before:-inset-1 before:content-['']",
        "hover:bg-surface-subtle focus-visible:ring-focus-ring outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "data-[state=open]:bg-surface-subtle data-[state=open]:border-border-strong",
      )}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {body}
    </button>
  ) : (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={classes} {...props}>
      {body}
    </span>
  );
}
