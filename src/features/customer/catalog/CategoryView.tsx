import { getLocale, getTranslations } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, publicOrigin, webPageSchema } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { getPriceHints, listProducts, listStockProducts, type CatalogueCategory } from "./api.server";
import { CatalogueNav } from "./CatalogueNav";
import { pick } from "./localize";
import {
  CARD_FILTERS,
  CARD_SORTS,
  categoryGroup,
  FAST_LEAD_DAYS,
  passes,
  SMALL_MOQ,
  sortCards,
  type CardFilter,
  type CardSort,
} from "./ordering";
import { categoryHref, rfqHref } from "./paths";
import { ProductSearchForm } from "./ProductSearchForm";
import { SortMenu } from "./SortMenu";
import { ProductGrid, type GridItem } from "./ProductGrid";

const PER_PAGE = 24;

/**
 * One category: its product types as filters, and every product in them.
 *
 * The catalogue lists filter by category, sub-categories included (D-228), so a category is one
 * read of each list — narrowed to a type when one is chosen — and the two are paged together here.
 */
export async function CategoryView({
  category,
  tree,
  typeCode,
  page,
  filters = [],
  sort = "recommended",
}: {
  category: CatalogueCategory;
  tree: readonly CatalogueCategory[];
  typeCode?: string;
  page: number;
  /** The chips chosen (`?f=instant,fast`), and the order (`?sort=price`). */
  filters?: CardFilter[];
  sort?: CardSort;
}) {
  const [t, locale, origin] = await Promise.all([getTranslations("catalog"), getLocale(), publicOrigin()]);
  const selected = category.types.find((type) => type.code === typeCode);
  const filter = { category: category.code, ...(selected ? { productType: selected.code } : {}), perPage: 100 };

  const [products, stock] = await Promise.all([listProducts(filter), listStockProducts(filter)]);
  // Chips and order over what the API returned for this category (its facts, D-307); a chip about
  // pricing or lead time says nothing of a stock item, so the shelf shows only without chips.
  const cards = sortCards(
    products.data.filter((product) => passes(product, filters)),
    sort,
  );
  const all = [
    ...cards.map((product): GridItem => ({ kind: "catalog", product })),
    ...(filters.length === 0 ? stock.data.map((product): GridItem => ({ kind: "stock", product })) : []),
  ];
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const current = Math.min(page, pages);
  const items = all.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const hints = await getPriceHints({
    slugs: items.flatMap((item) => (item.kind === "catalog" ? [item.product.slug] : [])),
    skus: items.flatMap((item) => (item.kind === "stock" ? [item.product.sku] : [])),
  });

  const name = pick(locale, category.nameTh, category.nameEn);
  const types = new Map(tree.flatMap((entry) => entry.types).map((type) => [type.code, type]));
  const hasRfq = category.types.some((type) => type.quoteMode === "rfq");
  const base = categoryHref(category.code);
  const href = (target: { type?: string; page?: number; filters?: CardFilter[]; sort?: CardSort }) => {
    const search = new URLSearchParams();
    const chosen = target.filters ?? filters;
    const order = target.sort ?? sort;
    if (target.type) search.set("type", target.type);
    if (chosen.length > 0) search.set("f", chosen.join(","));
    if (order !== "recommended") search.set("sort", order);
    if (target.page && target.page > 1) search.set("page", String(target.page));
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const toggle = (filter: CardFilter) =>
    href({
      type: selected?.code,
      filters: filters.includes(filter)
        ? filters.filter((item) => item !== filter)
        : // "ราคาทันที" and "ขอใบเสนอราคา" exclude each other.
          [
            ...filters.filter(
              (item) => !(filter === "instant" && item === "rfq") && !(filter === "rfq" && item === "instant"),
            ),
            filter,
          ],
    });
  const description = t("category.description", {
    types: category.types
      .slice(0, 4)
      .map((type) => pick(locale, type.nameTh, type.nameEn))
      .join(" · "),
    mode: categoryGroup(category),
  });
  const crumbs = [
    { label: t("breadcrumbs.home"), href: localised("/") },
    { label: t("breadcrumbs.products"), href: localised("/products") },
    { label: name },
  ];
  // Design language v2: an active chip is solid brand, as on the "ProductCategory" board.
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-control border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
      active ? "border-primary bg-primary text-primary-fg font-medium" : "border-border hover:bg-bg-subtle",
    );

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      <JsonLd
        data={breadcrumbSchema([
          { name: crumbs[0]!.label, url: `${origin}${crumbs[0]!.href}` },
          { name: crumbs[1]!.label, url: `${origin}${crumbs[1]!.href}` },
          { name },
        ])}
      />
      <JsonLd
        data={webPageSchema({
          type: "CollectionPage",
          name,
          description,
          url: `${origin}${localised(categoryHref(category.code))}`,
          locale,
          speakableSelector: ["#category-answer"],
        })}
      />
      <Breadcrumbs items={crumbs} label={t("breadcrumbs.label")} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-3xl">
          <h1 className="text-4xl leading-[1.15]">{name}</h1>
          <p id="category-answer" className="text-muted mt-2">
            {description}
          </p>
        </div>
        <p className="text-muted text-sm" aria-live="polite">
          {t("list.results", { count: all.length })}
        </p>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[15rem_1fr]">
        <aside className="flex min-w-0 flex-col gap-5">
          <ProductSearchForm action={localised("/products")} />
          <CatalogueNav tree={tree} current={category.code} />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {category.types.length > 1 ? (
            <nav aria-label={t("list.types")}>
              <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 whitespace-nowrap md:mx-0 md:flex-wrap md:px-0">
                <li>
                  <Link href={href({})} aria-current={!selected ? "page" : undefined} className={chip(!selected)}>
                    {t("list.allTypes")}
                  </Link>
                </li>
                {category.types.map((type) => (
                  <li key={type.code}>
                    <Link
                      href={href({ type: type.code })}
                      aria-current={selected?.code === type.code ? "page" : undefined}
                      className={chip(selected?.code === type.code)}
                    >
                      {pick(locale, type.nameTh, type.nameEn)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ul
              className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 whitespace-nowrap md:mx-0 md:flex-wrap md:px-0"
              aria-label={t("chips.label")}
            >
              {CARD_FILTERS.map((filter) => {
                const on = filters.includes(filter);
                return (
                  <li key={filter}>
                    <Link
                      href={toggle(filter)}
                      aria-current={on ? "true" : undefined}
                      className={chip(on)}
                      scroll={false}
                    >
                      {on ? <Icon name="check" size={14} aria-hidden="true" className="me-1" /> : null}
                      {t(`chips.${filter}`, { moq: SMALL_MOQ, days: FAST_LEAD_DAYS })}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <SortMenu
              label={t("sort.label")}
              value={sort}
              options={CARD_SORTS.map((value) => ({ value, label: t(`sort.${value}`) }))}
              hrefFor={
                Object.fromEntries(
                  CARD_SORTS.map((value) => [value, localised(href({ type: selected?.code, sort: value }))]),
                ) as Record<CardSort, string>
              }
            />
          </div>

          {items.length > 0 ? (
            <ProductGrid
              items={items}
              types={types}
              hints={hints}
              headingLevel="h2"
              columns={3}
              trailing={
                hasRfq || categoryGroup(category) !== "service" ? (
                  <li className="bg-fg text-fg-inverse rounded-card flex flex-col items-center justify-center gap-3 p-5 text-center sm:p-8">
                    <span className="grid size-12 place-items-center rounded-xl bg-current/10" aria-hidden="true">
                      <Icon name="chat" size={22} />
                    </span>
                    <p className="text-lg font-semibold">{t("category.rfqTitle")}</p>
                    <p className="text-sm opacity-75">{t("category.rfqBody")}</p>
                    <Link
                      href={rfqHref(category.code)}
                      className="bg-surface text-fg rounded-cta mt-1 inline-flex h-10 items-center px-4 text-sm font-semibold whitespace-nowrap sm:px-5"
                    >
                      {t("category.rfqCta")}
                    </Link>
                  </li>
                ) : null
              }
            />
          ) : (
            <EmptyState
              icon="box"
              title={t("list.emptyTitle")}
              description={t("list.emptyBody")}
              action={<NextStep to="products" />}
            />
          )}

          <LinkPagination
            page={current}
            pages={pages}
            hrefFor={(target) => href({ type: selected?.code, page: target })}
            linkAs={Link}
            labels={{
              nav: t("pagination.nav"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              page: (n) => t("pagination.page", { page: n }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
