import { cn } from "../lib/cn";

export interface StepCardProps {
  /** The anchor the progress chips and "go to" links scroll to. */
  id: string;
  /** Its place in the sequence, 1-based: drawn as "01". */
  number: number;
  title: React.ReactNode;
  /** Right-aligned, small: the answer so far or a one-line aid ("11 เบอร์มาตรฐาน"). */
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * One step of a long-form configuration, always open (design-system.md §3 "StepCard"): the
 * number, the title and a right-aligned hint on a card, so the whole configuration reads top to
 * bottom in one scroll and every step is a scroll target for `StepChips`.
 *
 * It scrolls to just under the sticky bars (`--step-scroll-mt`, set by the page that owns them),
 * and takes focus without a ring when a chip lands on it, so a keyboard or screen-reader user
 * arrives where the page scrolled to.
 */
export function StepCard({ id, number, title, hint, children, className }: StepCardProps) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-step-card
      className={cn(
        "border-border bg-surface rounded-card scroll-mt-(--step-scroll-mt,8rem) border p-4 outline-none sm:px-6 sm:py-5",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="m-0 flex items-baseline gap-2.5 text-xl font-semibold">
          <span aria-hidden className="text-primary font-mono text-[0.8125rem] tabular-nums">
            {String(number).padStart(2, "0")}
          </span>
          {title}
        </h2>
        {hint ? <p className="text-muted m-0 min-w-0 text-sm break-words sm:text-end">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}
