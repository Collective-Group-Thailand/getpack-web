import { getLocale, getTranslations } from "next-intl/server";

import type { CatalogueCategory } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

import {
  categoriesIn,
  filterItems,
  HUB_MODES,
  HUB_SORTS,
  modeCounts,
  sortItems,
  visibleBatch,
  type HubItem,
} from "./hub";
import { HubCard } from "./HubCard";
import { HubToolbar } from "./HubToolbar";
import { PriceTable } from "./PriceTable";
import { DEFAULT_PARAMS, hubHref, type HubParams } from "./query";

/**
 * "สินค้าทั้งหมด" (prompt items 5–7): the toolbar, then the grid (15 per "โหลดเพิ่ม") or the price table,
 * over every item the search left — filtered by mode and category and sorted on the server from the
 * URL. Shared by the hub and the category landing pages (Phase 2 item 3), which pass their own path and
 * leave the category chips out.
 */
export async function HubCatalogue({
  items,
  params,
  base,
  tree,
  showCategories = true,
  fixed = {},
  categoryPage,
  columns = 4,
  eager = 4,
}: {
  /** Every item (after the search), before the mode and category filters. */
  items: readonly HubItem[];
  params: HubParams;
  /** The page's own path ("/products", "/products/corrugated"). */
  base: string;
  tree: readonly CatalogueCategory[];
  showCategories?: boolean;
  /** The page's own parameters kept on every link (a category page's `type`). */
  fixed?: Record<string, string>;
  /** Where a chosen category's own landing page is (the hub links there; a category page has none). */
  categoryPage?: (code: string) => string;
  /** Columns on a wide screen: 3 beside a sidebar (a category page), 4 across the page. */
  columns?: 3 | 4;
  eager?: number;
}) {
  const [t, tCatalog, locale] = await Promise.all([
    getTranslations("products"),
    getTranslations("catalog"),
    getLocale(),
  ]);
  const counts = modeCounts(items);
  const inMode = filterItems(items, { mode: params.mode });
  const categoryCodes = categoriesIn(
    inMode,
    tree.map((category) => category.code),
  );
  const categoryNames = new Map(
    tree.map((category) => [category.code, pick(locale, category.nameTh, category.nameEn)]),
  );
  // A category the current mode does not have is not a filter at all (its chip is not drawn).
  const cat = params.cat && categoryCodes.includes(params.cat) ? params.cat : null;
  const listed = sortItems(filterItems(inMode, { cat }), params.sort);
  const shown = params.view === "table" ? listed : visibleBatch(listed, params.page);
  const modeName = (mode: HubItem["mode"]) => t(`modes.${mode}.name`);

  const toolbar = (
    <HubToolbar
      tabsLabel={t("catalogue.tabs")}
      tabs={[null, ...HUB_MODES.filter((mode) => counts[mode] > 0 || params.mode === mode)].map((mode) => ({
        mode: mode ?? "all",
        label: mode ? modeName(mode) : t("modes.all"),
        count: mode ? counts[mode] : counts.all,
        href: hubHref(base, params, { mode }, fixed),
        current: params.mode === mode,
      }))}
      chipsLabel={t("catalogue.categories")}
      chips={
        showCategories
          ? [null, ...categoryCodes].map((code) => ({
              key: code ?? "all",
              label: code ? (categoryNames.get(code) ?? t("catalogue.uncategorised")) : t("catalogue.allCategories"),
              href: hubHref(base, params, { cat: code }, fixed),
              current: cat === code,
            }))
          : []
      }
      sort={{
        label: t("catalogue.sort"),
        value: params.sort,
        options: HUB_SORTS.map((sort) => ({
          value: sort,
          label: t(`catalogue.sorts.${sort}`),
          href: hubHref(base, params, { sort }, fixed),
        })),
      }}
      views={{
        label: t("catalogue.view"),
        options: (["grid", "table"] as const).map((view) => ({
          view,
          label: t(`catalogue.views.${view}`),
          href: hubHref(base, params, { view }, fixed),
          current: params.view === view,
        })),
      }}
    />
  );

  const empty =
    listed.length === 0 ? (
      <EmptyState
        icon="search"
        title={
          params.q && items.length === 0 ? t("catalogue.searchEmptyTitle", { q: params.q }) : t("catalogue.emptyTitle")
        }
        description={t("catalogue.emptyBody")}
        action={
          <Button asChild variant="secondary">
            <Link href={hubHref(base, DEFAULT_PARAMS, {}, fixed)} scroll={false}>
              {t("catalogue.emptyReset")}
            </Link>
          </Button>
        }
      />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      {toolbar}
      {cat && categoryPage ? (
        <p className="-mt-2 text-sm">
          <Link
            href={categoryPage(cat)}
            className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            {t("catalogue.categoryPage", { name: categoryNames.get(cat) ?? cat })}
          </Link>
        </p>
      ) : null}
      {params.q ? (
        <p className="text-muted -mt-1 text-sm" aria-live="polite">
          {t("catalogue.resultsFor", { q: params.q })}
        </p>
      ) : null}
      {empty ??
        (params.view === "table" ? (
          <PriceTable
            items={shown}
            categoryNames={categoryNames}
            vatLabel={tCatalog("price.vatIncluded")}
            labels={{
              instant: modeName("instant"),
              quote: modeName("quote"),
              stock: modeName("stock"),
              service: modeName("service"),
            }}
          />
        ) : (
          <ul
            className={
              columns === 3
                ? "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
                : "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
            }
          >
            {shown.map((item, index) => (
              <HubCard
                key={`${item.kind}:${item.key}`}
                item={item}
                categoryName={item.categoryCode ? (categoryNames.get(item.categoryCode) ?? null) : null}
                priority={index < eager}
              />
            ))}
          </ul>
        ))}
      {!empty && params.view === "grid" ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-[0.84375rem]">
          <p className="text-muted" aria-live="polite">
            {t("catalogue.showing", { shown: shown.length, total: listed.length })}
          </p>
          <div
            className="bg-border h-1 w-50 overflow-hidden rounded-sm"
            role="progressbar"
            aria-label={t("catalogue.showing", { shown: shown.length, total: listed.length })}
            aria-valuemin={0}
            aria-valuemax={listed.length}
            aria-valuenow={shown.length}
          >
            <i
              className="bg-primary block h-full"
              style={{ width: `${Math.round((shown.length / listed.length) * 100)}%` }}
            />
          </div>
          {shown.length < listed.length ? (
            <Button asChild variant="secondary">
              <Link href={hubHref(base, params, { page: params.page + 1 }, fixed)} scroll={false}>
                {t("catalogue.loadMore")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
