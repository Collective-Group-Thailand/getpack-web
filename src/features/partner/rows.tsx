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
  return <span className="font-semibold whitespace-nowrap tabular-nums">{children}</span>;
}

/**
 * The views of one list (jobs, shipments, claims): the product family's segmented tab row (the
 * account pages' `TabBar`) — bordered, the current view on the pale tint with its count. Scrolls
 * sideways inside itself on a phone rather than wrapping or cutting a label; 44 px tall there for
 * a thumb, 36 px on a desk.
 */
export function ViewTabs({
  label,
  items,
  current,
  className,
}: {
  label: string;
  items: { key: string; href: string; label: React.ReactNode; count?: number | null }[];
  current: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("max-w-full", className)}>
      <ul className="border-border bg-surface inline-flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border p-[3px] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const selected = item.key === current;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2 md:min-h-9 md:px-3",
                  selected
                    ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                    : "text-muted hover:bg-surface-subtle hover:text-fg font-medium",
                )}
              >
                {item.label}
                {item.count !== undefined && item.count !== null ? (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      selected ? "text-primary-subtle-fg" : "text-muted",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
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

/**
 * The one toolbar over a list: the views (`ViewTabs`) on the left, the search (`SearchBar`) on the right, wrapping
 * under each other on a phone. Either may be left out.
 */
export function ListToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

/**
 * A second, lighter filter under a list's toolbar (a check's kind, a document's type): a small label and plain
 * toggles, the current one on the pale tint. Wraps on a phone instead of scrolling; never a second segmented row.
 */
export function FilterLinks({
  label,
  items,
  current,
}: {
  label: string;
  items: { key: string; href: string; label: React.ReactNode }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="-mt-1 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm">
      <span className="text-muted me-1.5">{label}</span>
      {items.map((item) => {
        const selected = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "focus-visible:ring-focus-ring inline-flex min-h-11 items-center rounded-lg px-2.5 whitespace-nowrap outline-none focus-visible:ring-2 md:min-h-8",
              selected
                ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                : "text-muted hover:bg-surface hover:text-fg font-medium",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
