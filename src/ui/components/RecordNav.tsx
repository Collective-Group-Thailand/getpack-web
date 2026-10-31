"use client";

import { cn } from "../lib/cn";

export interface RecordNavGroup {
  key: string;
  label: React.ReactNode;
  items: readonly { key: string; label: React.ReactNode }[];
}

/**
 * The parts of a large record (a partner factory: onboarding, documents, capacity, terms, prices…), grouped, beside
 * the part that is open — one column of plain items under a few headings, never two or three stacked tab rows. On a
 * desk it stays in view at the left of the record; below `lg` the same items are one row that scrolls sideways
 * inside itself, as the list views do. The open part is the caller's state (`current` / `onSelect`), so a caller
 * may mirror it in the address without a navigation.
 */
export function RecordNav({
  label,
  groups,
  current,
  onSelect,
  children,
}: {
  label: string;
  groups: readonly RecordNavGroup[];
  current: string;
  onSelect: (key: string) => void;
  /** The open part. */
  children: React.ReactNode;
}) {
  const items = groups.flatMap((group) => group.items);
  const item = (entry: { key: string; label: React.ReactNode }, phone: boolean) => {
    const selected = entry.key === current;
    return (
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(entry.key)}
        className={cn(
          "focus-visible:ring-focus-ring inline-flex items-center rounded-lg text-start text-sm outline-none focus-visible:ring-2",
          phone ? "min-h-11 px-3.5 whitespace-nowrap" : "min-h-9 w-full px-3 py-1.5",
          selected
            ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
            : "text-muted hover:bg-surface-subtle hover:text-fg font-medium",
        )}
      >
        {entry.label}
      </button>
    );
  };
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label={label} className="min-w-0 lg:sticky lg:top-20">
        <ul className="border-border bg-surface flex [scrollbar-width:none] gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border p-[3px] lg:hidden [&::-webkit-scrollbar]:hidden">
          {items.map((entry) => (
            <li key={entry.key} className="shrink-0">
              {item(entry, true)}
            </li>
          ))}
        </ul>
        <div className="hidden flex-col gap-4 lg:flex">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              <p className="text-muted px-3 pb-1 text-xs font-semibold">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((entry) => (
                  <li key={entry.key}>{item(entry, false)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
