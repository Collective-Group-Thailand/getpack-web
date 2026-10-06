import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getPriceHints,
  listProducts,
  listStockProducts,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { ProductGrid, type GridItem } from "@/features/customer/catalog/ProductGrid";
import { CategoryTiles } from "@/features/customer/catalog/CategoryTiles";
import { ProductSearchForm } from "@/features/customer/catalog/ProductSearchForm";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { Icon } from "@/ui/icons";

const PER_PAGE = 24;

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  productType?: string | string[];
  view?: string | string[];
}>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = await getTranslations("catalog");
  const q = one((await searchParams).q);
  return {
    title: t("meta.productsTitle"),
    description: t("meta.productsDescription"),
    // A search result is a view of this page, not a page of its own.
    ...(q ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The whole catalogue: categories to browse by, a search, and every product. */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const q = one(query.q);
  const page = Math.max(1, Number(one(query.page)) || 1);
  const productType = one(query.productType);
  const view = one(query.view) === "list" ? "list" : "grid";

  const [t, currentLocale, tree, products, stock] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getCatalogueTree(),
    listProducts({ q, page, perPage: PER_PAGE, productType }),
    // Stock products are shown with the first page only: they are a shelf, not the catalogue.
    page === 1
      ? listStockProducts({ q, perPage: 8, productType })
      : Promise.resolve({ data: [], meta: { page: 1, perPage: 8, total: 0 } }),
  ]);
  const hints = await getPriceHints({
    slugs: products.data.map((product) => product.slug),
    skus: stock.data.map((product) => product.sku),
  });
  const types = new Map(tree.flatMap((category) => category.types).map((type) => [type.code, type]));
  const pages = Math.max(1, Math.ceil(products.meta.total / products.meta.perPage));
  const action = getPathname({ href: "/products", locale: currentLocale as Locale });
  // Filters live in the URL (shareable, crawlable, back-button safe); a change goes back to page 1.
  const hrefWith = (changes: Record<string, string | null>, target = 1) => {
    const search = new URLSearchParams();
    const current: Record<string, string | undefined> = { q, productType, view: view === "list" ? "list" : undefined };
    for (const [key, value] of Object.entries({ ...current, ...changes })) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const text = search.toString();
    return text ? `/products?${text}` : "/products";
  };
  const hrefFor = (target: number) => hrefWith({}, target);
  const activeType = productType ? types.get(productType) : undefined;
  const chips = [
    ...(q ? [{ key: "q", label: t("filters.search", { q }), href: hrefWith({ q: null }) }] : []),
    ...(activeType
      ? [
          {
            key: "type",
            label: pick(currentLocale, activeType.nameTh, activeType.nameEn),
            href: hrefWith({ productType: null }),
          },
        ]
      : []),
  ];

  const catalogue: GridItem[] = products.data.map((product) => ({ kind: "catalog", product }));
  const shelf: GridItem[] = stock.data.map((product) => ({ kind: "stock", product }));
  const empty = catalogue.length === 0 && shelf.length === 0;

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">{q ? t("list.resultsFor", { q }) : t("list.heading")}</h1>
        {!q ? <p className="text-muted mt-2">{t("list.intro")}</p> : null}
      </header>

      {/* One toolbar: search as you type, the result count, and the view toggle (UX audit). */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <ProductSearchForm action={action} q={q} />
        </div>
        <p className="text-muted ms-auto text-sm" aria-live="polite">
          {t("list.results", { count: products.meta.total + stock.meta.total })}
        </p>
        <nav aria-label={t("filters.view")} className="border-border bg-surface rounded-control flex border p-1">
          {(["grid", "list"] as const).map((option) => (
            <Link
              key={option}
              href={hrefWith({ view: option === "list" ? "list" : null }, page)}
              aria-current={view === option ? "true" : undefined}
              aria-label={t(`filters.views.${option}`)}
              title={t(`filters.views.${option}`)}
              className={
                view === option
                  ? "bg-primary-subtle text-primary-subtle-fg grid size-9 place-items-center rounded-lg"
                  : "text-muted hover:bg-bg-subtle grid size-9 place-items-center rounded-lg"
              }
            >
              <Icon name={option === "grid" ? "dashboard" : "list-bullet"} size={18} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>

      {!q && !productType && page === 1 ? <CategoryTiles tree={tree} /> : null}

      <div className="mt-10 flex flex-col gap-10">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-3">
            {chips.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label={t("filters.applied")}>
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <Link
                      href={chip.href}
                      className="bg-bg-subtle hover:bg-primary-subtle inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                    >
                      {chip.label}
                      <Icon name="close" size={12} aria-hidden="true" />
                      <span className="sr-only">{t("filters.remove")}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/products" className="text-primary text-sm underline underline-offset-4">
                    {t("filters.clearAll")}
                  </Link>
                </li>
              </ul>
            ) : null}
          </div>

          {empty ? (
            <EmptyState
              icon="search"
              title={t("list.emptyTitle")}
              description={t("list.emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <Link href="/products">{t("list.allCategories")}</Link>
                </Button>
              }
            />
          ) : null}

          {catalogue.length > 0 ? (
            <section aria-labelledby="catalogue-made-to-order">
              <h2 id="catalogue-made-to-order" className="mb-4 text-xl font-semibold">
                {t("list.productsHeading")}
              </h2>
              <ProductGrid items={catalogue} types={types} hints={hints} layout={view} />
              <LinkPagination
                className="mt-8"
                page={page}
                pages={pages}
                hrefFor={hrefFor}
                linkAs={Link}
                labels={{
                  nav: t("pagination.nav"),
                  previous: t("pagination.previous"),
                  next: t("pagination.next"),
                  page: (n) => t("pagination.page", { page: n }),
                }}
              />
            </section>
          ) : null}

          {shelf.length > 0 ? (
            <section aria-labelledby="catalogue-stock">
              <h2 id="catalogue-stock" className="mb-4 text-xl font-semibold">
                {t("list.stockHeading")}
              </h2>
              <ProductGrid items={shelf} types={types} hints={hints} eager={0} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
