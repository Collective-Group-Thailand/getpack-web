import Link from "next/link";

import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Tone = "neutral" | "warning" | "danger" | "success";

const TILE: Record<Tone, string> = {
  neutral: "bg-sage-subtle text-fg",
  warning: "bg-warning-subtle text-warning-subtle-fg",
  danger: "bg-danger-subtle text-danger-subtle-fg",
  success: "bg-success-subtle text-success-subtle-fg",
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
 * One row: an icon tile (tinted by tone — a warning or a danger the reader should see first), the
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
        className="hover:bg-surface-subtle focus-visible:bg-surface-subtle grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors"
      >
        <span
          className={cn(
            "rounded-control row-span-2 grid size-10 shrink-0 place-items-center sm:row-span-1",
            icon ? TILE[tone] : "hidden",
          )}
          aria-hidden
        >
          {icon ? <Icon name={icon} size={20} /> : null}
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
          size={20}
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
                "rounded-control inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-medium transition-colors",
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
