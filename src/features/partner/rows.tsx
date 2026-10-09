import Link from "next/link";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Tone = "neutral" | "warning" | "danger" | "success";

const ICON: Record<Tone, string> = {
  neutral: "text-muted",
  warning: "text-warning-subtle-fg",
  danger: "text-danger",
  success: "text-success",
};

/**
 * A list of things to open, drawn as one panel with hairline rows (design language v3) instead of a
 * stack of separate cards: the eye runs down one edge, the amounts line up on the other.
 */
export function RowList({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn("border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border", className)}
    >
      {children}
    </ul>
  );
}

/**
 * One row: a small glyph (coloured by tone — a warning or a danger the reader should see first), the
 * title line (a code in monospace, a status beside it), a muted meta line, and an aside on the far
 * edge (an amount, a date) before the chevron. The whole row is the link: one tab stop, 64 px tall.
 */
export function Row({
  href,
  icon,
  tone = "neutral",
  title,
  meta,
  aside,
}: {
  href: string;
  icon?: IconName;
  tone?: Tone;
  title: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        // A grid, so on a phone the aside (an amount) drops under the title instead of squeezing it.
        className="hover:bg-surface-subtle focus-visible:bg-surface-subtle grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 transition-colors md:min-h-10"
      >
        {/* A plain glyph, coloured only when the row needs attention — no tinted tile on every row. */}
        <span className={cn("row-span-2 shrink-0 sm:row-span-1", icon ? ICON[tone] : "hidden")} aria-hidden>
          {icon ? <Icon name={icon} size={18} /> : null}
        </span>
        <span className="col-start-2 flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium">{title}</span>
          {meta ? <span className="text-muted text-sm">{meta}</span> : null}
        </span>
        {aside ? (
          <span className="col-start-2 row-start-2 tabular-nums sm:col-start-3 sm:row-start-1 sm:text-end">
            {aside}
          </span>
        ) : null}
        <Icon
          name="chevron-right"
          size={18}
          className="text-muted col-start-4 row-span-2 row-start-1 shrink-0 sm:row-span-1"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** A reference code as the floor reads it off a label: monospace, never wrapped mid-code. */
export function Code({ children }: { children: React.ReactNode }) {
  return <span className="font-mono font-semibold whitespace-nowrap">{children}</span>;
}

/**
 * The views of one list (jobs, shipments, payouts): a row of links, the current one filled in the
 * action colour, each with its count when the page knows it. Scrolls sideways on a phone rather
 * than wrapping into a second row of buttons.
 */
export function ViewTabs({
  label,
  items,
  current,
}: {
  label: string;
  items: { key: string; href: string; label: React.ReactNode; count?: number }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1.5">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.key === current ? "page" : undefined}
              className={cn(
                "rounded-control inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-medium transition-colors md:min-h-9 md:px-3",
                item.key === current
                  ? "bg-primary text-primary-fg border-primary"
                  : "border-border bg-surface text-fg hover:border-border-strong",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={cn(
                    "rounded-control min-w-6 px-1.5 text-center text-xs tabular-nums",
                    item.key === current ? "bg-primary-fg/20" : "bg-surface-subtle text-muted",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Counts or amounts side by side in one ruled strip — how a back office shows a summary — rather than
 * a row of separate cards with an icon each. A cell with `href` opens the list it counts.
 */
export function StatStrip({
  label,
  items,
}: {
  label: string;
  items: {
    key: string;
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
    href?: string;
    tone?: Tone;
  }[];
}) {
  return (
    <ul
      aria-label={label}
      className="border-border bg-surface divide-border grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border sm:flex sm:divide-y-0"
    >
      {items.map((item) => {
        const body = (
          <>
            <span className="text-muted text-sm">{item.label}</span>
            <span className="text-lg font-semibold tabular-nums">{item.value}</span>
            {item.hint ? <span className={cn("text-xs", ICON[item.tone ?? "neutral"])}>{item.hint}</span> : null}
          </>
        );
        return (
          <li key={item.key} className="min-w-0 sm:flex-1">
            {item.href ? (
              <Link
                href={item.href}
                className="hover:bg-surface-subtle flex h-full flex-col gap-0.5 px-4 py-3 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-0.5 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
