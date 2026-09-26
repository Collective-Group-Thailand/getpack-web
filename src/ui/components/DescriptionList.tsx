import { cn } from "../lib/cn";

export interface DescriptionItem {
  term: React.ReactNode;
  description: React.ReactNode;
  /** Span the full width — addresses, notes, anything long. */
  wide?: boolean;
}

export interface DescriptionListProps {
  items: readonly DescriptionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}

/**
 * Label / value pairs on a detail page (design-system.md §3). A real `<dl>`, so a screen reader
 * announces each value with its label; the grid collapses to one column on narrow screens.
 */
export function DescriptionList({ items, columns = 2, className }: DescriptionListProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className={cn("min-w-0", item.wide && "sm:col-span-full")}>
          <dt className="text-muted text-xs font-medium">{item.term}</dt>
          <dd className="mt-0.5 text-sm break-words">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
