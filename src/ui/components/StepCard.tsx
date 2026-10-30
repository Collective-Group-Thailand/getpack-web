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
      {/* The number in a small brand-tint square, the title beside it and the answer so far under the title —
          a sequence that reads as numbered steps (Project A), with the hint never squeezed to the edge. */}
      <header className="border-border mb-5 flex items-start gap-3 border-b pb-4">
        <span
          aria-hidden
          className="bg-primary-subtle text-primary-subtle-fg grid size-8 shrink-0 place-items-center rounded-lg text-[0.8125rem] font-semibold tabular-nums"
        >
          {String(number).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="m-0 text-lg leading-snug font-semibold md:text-xl">
            {title}
          </h2>
          {hint ? <p className="text-muted m-0 mt-0.5 min-w-0 text-sm break-words">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}
