import Link from "next/link";

import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * Building blocks of the getpack Factory ERP screens (E1), server-safe: the big task tiles an owner
 * starts from, a plain GET search box that keeps the current view, and page links.
 */

/** The screen's tasks as large tiles — icon, what it is, when to use it (design-system.md §5). */
export function ActionTiles({
  label,
  items,
}: {
  label: string;
  items: { key: string; href: string; icon: IconName; title: string; hint: string; primary?: boolean }[];
}) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          <Link
            href={item.href}
            className={cn(
              "flex h-full min-h-20 items-start gap-3 rounded-xl border p-3 transition-colors md:p-4",
              "focus-visible:ring-focus-ring outline-none focus-visible:ring-2",
              item.primary
                ? "border-primary bg-primary-subtle text-primary-subtle-fg hover:bg-primary-subtle/70"
                : "border-border bg-surface hover:bg-surface-subtle",
            )}
          >
            <Icon name={item.icon} size={22} className="mt-0.5 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-semibold">{item.title}</span>
              <span className="text-muted hidden text-sm sm:block">{item.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A GET search form for a list screen; hidden fields keep the view it searches in. */
export function SearchBar({
  id,
  action,
  hidden = {},
  q,
  label,
  placeholder,
  button,
}: {
  id: string;
  action: string;
  hidden?: Record<string, string | undefined>;
  q: string | undefined;
  label: string;
  placeholder: string;
  button: string;
}) {
  return (
    <form role="search" className="flex max-w-xl gap-2" action={action}>
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input id={id} name="q" inputSize="lg" className="md:h-10" defaultValue={q ?? ""} placeholder={placeholder} />
      <Button type="submit" size="lg" variant="secondary" iconStart="search" className="h-11 shrink-0 md:h-10">
        {button}
      </Button>
    </form>
  );
}

/** Page links under a list (`?page=`), kept with the screen's other query values. */
export function Pager({
  page,
  perPage,
  total,
  hrefFor,
  labels,
}: {
  page: number;
  perPage: number;
  total: number;
  hrefFor: (page: number) => string;
  labels: { nav: string; previous: string; next: string; page: (n: number) => string };
}) {
  return (
    <LinkPagination
      page={page}
      pages={Math.max(1, Math.ceil(total / perPage))}
      hrefFor={hrefFor}
      labels={labels}
      linkAs={Link}
    />
  );
}

/** `?page=` as a whole page number ≥ 1. */
export const pageOf = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

/** A query string from the values that are set. */
export const queryOf = (values: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries.length
    ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join("&")}`
    : "";
};
