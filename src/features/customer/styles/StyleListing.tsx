"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ChipRow } from "@/features/customer/products/HubToolbar";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export interface ListingItem {
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  instant: boolean;
  /** The card, rendered on the server. */
  node: React.ReactNode;
}

type Sort = "popular" | "name" | "instant_first";

/**
 * A landing page's styles under one toolbar (Project A: styles/for, styles/options, packaging): how many, the
 * category chips (wrapping to two lines then "+n", a scrolling row on a phone — `ChipRow`), "ราคาทันทีเท่านั้น"
 * and the order, sticky under the header from a tablet up. Everything filters the list the page already holds,
 * in the browser — no request, no invented facet; the default order is the one the API returned.
 */
export function StyleListing({
  items,
  label,
  defaultSort,
}: {
  items: ListingItem[];
  label: string;
  /** What the API's own order is ("popular" for a list, "name" for the whole library read by name). */
  defaultSort: "popular" | "name";
}) {
  const t = useTranslations("styles");
  const locale = useLocale();
  const [category, setCategory] = useState<string | null>(null);
  const [instantOnly, setInstantOnly] = useState(false);
  const [sort, setSort] = useState<Sort>(defaultSort);

  const categories = useMemo(() => {
    const seen = new Map<string, { label: string; count: number }>();
    for (const item of items) {
      const entry = seen.get(item.category);
      if (entry) entry.count += 1;
      else seen.set(item.category, { label: item.categoryLabel, count: 1 });
    }
    return [...seen.entries()];
  }, [items]);
  const hasInstant = items.some((item) => item.instant) && items.some((item) => !item.instant);

  const shown = useMemo(() => {
    const list = items.filter(
      (item) => (category === null || item.category === category) && (!instantOnly || item.instant),
    );
    if (sort === defaultSort) return list;
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, locale));
    // Stable: instant ones first, each group in the API's order.
    return [...list.filter((item) => item.instant), ...list.filter((item) => !item.instant)];
  }, [items, category, instantOnly, sort, defaultSort, locale]);

  const sorts: Sort[] = defaultSort === "popular" ? ["popular", "instant_first", "name"] : ["name", "instant_first"];
  const reset = () => {
    setCategory(null);
    setInstantOnly(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        className="md:bg-bg/95 md:border-border md:z-sticky flex flex-col gap-3 md:sticky md:-mx-8 md:border-b md:px-8 md:py-3 md:backdrop-blur xl:-mx-12 xl:px-12"
        style={{ top: "var(--site-sticky-top)" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <h2 className="me-auto text-xl font-semibold tabular-nums" aria-live="polite">
            {t("library.results", { count: shown.length })}
          </h2>
          {hasInstant ? (
            <button
              type="button"
              aria-pressed={instantOnly}
              onClick={() => setInstantOnly((value) => !value)}
              className={cn(
                "rounded-control focus-visible:ring-focus-ring inline-flex min-h-10 items-center gap-2 border px-3.5 text-sm font-medium outline-none focus-visible:ring-2",
                instantOnly
                  ? "border-primary bg-primary-subtle text-primary-subtle-fg"
                  : "border-border-strong bg-surface text-fg hover:border-fg",
              )}
            >
              <Icon name="zap" size={16} aria-hidden="true" className="text-instant-subtle-fg" />
              {t("library.instantOnly")}
            </button>
          ) : null}
          <SearchableSelect
            aria-label={t("list.sort")}
            className="min-w-44"
            value={sort}
            options={sorts.map((value) => ({ value, label: t(`sorts.${value}`) }))}
            onValueChange={(value) => setSort(value as Sort)}
          />
        </div>
        {categories.length > 1 ? (
          <ChipRow
            label={t("library.categories")}
            bleed={false}
            chips={[
              {
                key: "all",
                label: t("library.allCategories"),
                current: category === null,
                onSelect: () => setCategory(null),
              },
              ...categories.map(([code, entry]) => ({
                key: code,
                label: `${entry.label} ${entry.count}`,
                current: category === code,
                onSelect: () => setCategory(category === code ? null : code),
              })),
            ]}
          />
        ) : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("list.emptyTitle")}
          description={t("list.emptyBody")}
          action={
            <Button variant="secondary" onClick={reset}>
              {t("library.allCategories")}
            </Button>
          }
        />
      ) : (
        <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((item) => (
            <li key={item.code} className="flex min-w-0">
              {item.node}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
