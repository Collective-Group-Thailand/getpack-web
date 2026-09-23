import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface Crumb {
  label: string;
  /** Omitted on the last crumb, which is the current page and is not a link. */
  href?: string;
}

export interface BreadcrumbsProps {
  items: readonly Crumb[];
  /** Accessible name for the `<nav>`, from `src/i18n` — "เส้นทางหน้า" / "Breadcrumb". */
  label: string;
  className?: string;
}

/**
 * Where you are, as a trail (design-system.md §1: every screen answers "where am I?").
 *
 * The last item is rendered as text with `aria-current="page"` rather than a link, which is
 * the ARIA breadcrumb pattern — a link to the page you are on is a dead control, and screen
 * reader users hear the same label twice with nothing to distinguish them.
 *
 * Separators are `aria-hidden`: they are punctuation, and reading "chevron" between every
 * crumb turns a three-word trail into a sentence.
 */
export function Breadcrumbs({ items, label, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="text-muted flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.href ?? "current"}-${item.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <Icon name="chevron-right" size={14} className="text-subtle" /> : null}
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className={cn("truncate", isLast && "text-fg")}>
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="hover:text-fg truncate underline-offset-2 hover:underline">
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
