import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface FlowStep {
  key: string;
  icon: IconName;
  title: string;
  /** One short thing the product really does at this step (existing copy), shown as a tag under the title. */
  caption?: string;
}

/**
 * A process as a path of cards (owner request 2026-10-30, replacing the hero "screen" drawings): an ordered list
 * of real text — each step's icon, title and what the system does there — joined by dashed connectors. A small
 * document chip (decoration, hidden from assistive tech) travels the path one step at a time; the loop pauses on
 * hover, and under reduced motion every step shows its chip and nothing moves. No figures, no sample data.
 *
 * A column with the connector on the left on a phone; one row from `md`. Supports 3–6 steps
 * (`flow-step-3` … `flow-step-6` in base.css set the loop's slices).
 */
export function FlowPath({
  steps,
  label,
  chipIcon = "document",
  className,
}: {
  steps: readonly FlowStep[];
  /** What the path is, for the list's accessible name. */
  label: string;
  chipIcon?: IconName;
  className?: string;
}) {
  const n = Math.min(6, Math.max(3, steps.length));
  return (
    <ol
      aria-label={label}
      data-flow={n}
      className={cn("flow-path flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6", className)}
    >
      {steps.map((step, index) => (
        <li
          key={step.key}
          style={{ "--i": index } as React.CSSProperties}
          className="flow-card bg-surface border-border rounded-card relative flex min-w-0 flex-1 items-start gap-3 border p-3.5 md:flex-col md:gap-2.5"
        >
          {/* The connector: down the left into the next card on a phone, across the gap to it from md. */}
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="border-border-strong absolute start-[2.375rem] top-full h-5 border-s-2 border-dashed md:start-full md:top-[2.375rem] md:h-auto md:w-6 md:border-s-0 md:border-t-2"
            />
          ) : null}
          <span className="flow-icon bg-surface-subtle text-muted relative grid size-12 shrink-0 place-items-center rounded-lg">
            <Icon name={step.icon} size={20} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="flow-chip bg-primary text-primary-fg absolute -top-2 -right-2 grid size-6 place-items-center rounded-full"
            >
              <Icon name={chipIcon} size={13} />
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="text-[0.9375rem] leading-snug font-semibold text-balance break-keep">{step.title}</span>
            {step.caption ? (
              <span className="flow-tag border-border bg-surface text-muted rounded-control border px-2 py-0.5 text-xs leading-snug text-pretty">
                {step.caption}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
