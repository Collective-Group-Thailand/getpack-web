import Link from "next/link";

import { cn } from "@/ui/lib/cn";

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
  items: { key: string; href: string; label: React.ReactNode; count?: number | string | null }[];
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
