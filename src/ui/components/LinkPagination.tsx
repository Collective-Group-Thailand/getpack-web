import { Icon } from "../icons";
import { cn } from "../lib/cn";

type LinkLike = React.ComponentType<{
  href: string;
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
  "aria-current"?: "page";
  rel?: string;
}>;

export interface LinkPaginationProps {
  page: number;
  pages: number;
  /** The URL of a page — the caller keeps the rest of the query string. */
  hrefFor: (page: number) => string;
  labels: {
    nav: string;
    previous: string;
    next: string;
    /** "หน้า 3". */
    page: (page: number) => string;
  };
  /** The locale-aware link of the zone (`@/i18n/navigation`'s `Link`); a plain `<a>` otherwise. */
  linkAs?: LinkLike | "a";
  className?: string;
}

/** 1 … 4 5 6 … 12 — the current page, its neighbours and both ends. */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1]! > 1 ? ["gap" as const, n] : [n]));
}

/**
 * Pagination made of links, for public lists a search engine has to walk (the catalogue,
 * articles). `Pagination` is buttons and state — right for a back-office queue, invisible to a
 * crawler. Here every page is a real URL, the current one is `aria-current="page"`, and
 * previous/next carry `rel` so the sequence is explicit.
 *
 * A server component: nothing here needs JavaScript.
 */
export function LinkPagination({ page, pages, hrefFor, labels, linkAs = "a", className }: LinkPaginationProps) {
  if (pages <= 1) return null;
  const Anchor = linkAs as LinkLike;
  const item =
    "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

  return (
    <nav aria-label={labels.nav} className={cn("flex justify-center", className)}>
      <ul className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <li>
            <Anchor href={hrefFor(page - 1)} rel="prev" className={cn(item, "hover:bg-bg-subtle")}>
              <Icon name="chevron-left" size={16} aria-hidden="true" />
              {labels.previous}
            </Anchor>
          </li>
        ) : null}
        {pageWindow(page, pages).map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="text-muted px-1 before:content-['…']" />
          ) : (
            <li key={entry}>
              <Anchor
                href={hrefFor(entry)}
                aria-label={labels.page(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={cn(item, entry === page ? "bg-primary text-primary-fg" : "hover:bg-bg-subtle")}
              >
                {entry}
              </Anchor>
            </li>
          ),
        )}
        {page < pages ? (
          <li>
            <Anchor href={hrefFor(page + 1)} rel="next" className={cn(item, "hover:bg-bg-subtle")}>
              {labels.next}
              <Icon name="chevron-right" size={16} aria-hidden="true" />
            </Anchor>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
