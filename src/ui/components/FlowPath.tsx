import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface FlowStep {
  key: string;
  icon: IconName;
  title: string;
  /** One sentence of what happens at this step (existing copy). */
  description?: string;
}

/**
 * How a process runs, as a section of its own under a hero (owner direction 2026-10-30): an ordered list of steps,
 * each its number, its icon on a tinted plate, a title and one sentence — joined by a hairline that a small dot
 * travels along, one step after the other (decoration, hidden from assistive tech; still under reduced motion).
 * Four or five columns from `md`; a vertical timeline with the line on the left on a phone. Supports 3–6 steps.
 */
export function FlowPath({
  steps,
  label,
  className,
}: {
  steps: readonly FlowStep[];
  /** The list's accessible name (the section's heading, when it has one). */
  label: string;
  className?: string;
}) {
  const n = Math.min(6, Math.max(3, steps.length));
  return (
    <ol
      aria-label={label}
      data-flow={n}
      className={cn(
        "flow-path grid gap-8 md:gap-6",
        n === 3 && "md:grid-cols-3",
        n === 4 && "md:grid-cols-4",
        n === 5 && "md:grid-cols-5",
        n === 6 && "md:grid-cols-3 xl:grid-cols-6",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.key}
          style={{ "--i": index } as React.CSSProperties}
          className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 md:flex md:flex-col md:gap-0"
        >
          {index < steps.length - 1 ? (
            // The hairline to the next step: down the left on a phone, across to the next plate from md.
            <span
              aria-hidden="true"
              className="bg-border-strong absolute start-6 top-14 -bottom-6 w-px md:start-16 md:-end-6 md:top-6 md:bottom-auto md:h-px md:w-auto"
            >
              <span className="flow-dot bg-primary absolute -start-[3px] -top-[3px] size-[7px] rounded-full" />
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="bg-primary-subtle text-primary-subtle-fg relative z-[1] row-span-3 grid size-12 place-items-center rounded-lg"
          >
            <Icon name={step.icon} size={22} />
          </span>
          <span className="text-primary text-[0.78125rem] font-semibold tabular-nums md:mt-5">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="mt-1 text-lg leading-snug font-semibold text-balance">{step.title}</span>
          {step.description ? (
            <span className="text-muted col-start-2 mt-1.5 text-[0.9375rem] leading-relaxed text-pretty md:max-w-[28ch]">
              {step.description}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
