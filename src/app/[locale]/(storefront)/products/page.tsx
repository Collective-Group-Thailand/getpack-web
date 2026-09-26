import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getPriceHints,
  listProducts,
  listStockProducts,
} from "@/features/customer/catalog/api.server";
import { CatalogueNav } from "@/features/customer/catalog/CatalogueNav";
import { ProductGrid, type GridItem } from "@/features/customer/catalog/ProductGrid";
import { ProductSearchForm } from "@/features/customer/catalog/ProductSearchForm";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";

const PER_PAGE = 24;

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

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

  const [t, currentLocale, tree, products, stock] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getCatalogueTree(),
    listProducts({ q, page, perPage: PER_PAGE }),
    // Stock products are shown with the first page only: they are a shelf, not the catalogue.
    page === 1
      ? listStockProducts({ q, perPage: 8 })
      : Promise.resolve({ data: [], meta: { page: 1, perPage: 8, total: 0 } }),
  ]);
  const hints = await getPriceHints({
    slugs: products.data.map((product) => product.slug),
    skus: stock.data.map((product) => product.sku),
  });
  const types = new Map(tree.flatMap((category) => category.types).map((type) => [type.code, type]));
  const pages = Math.max(1, Math.ceil(products.meta.total / products.meta.perPage));
  const action = getPathname({ href: "/products", locale: currentLocale as Locale });
  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (target > 1) search.set("page", String(target));
    const text = search.toString();
    return text ? `/products?${text}` : "/products";
  };

  const catalogue: GridItem[] = products.data.map((product) => ({ kind: "catalog", product }));
  const shelf: GridItem[] = stock.data.map((product) => ({ kind: "stock", product }));
  const empty = catalogue.length === 0 && shelf.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">{q ? t("list.resultsFor", { q }) : t("list.heading")}</h1>
        {!q ? <p className="text-muted mt-2">{t("list.intro")}</p> : null}
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[14rem_1fr]">
        <aside className="flex min-w-0 flex-col gap-4">
          <ProductSearchForm action={action} q={q} />
          <CatalogueNav tree={tree} />
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          {q ? (
            <p className="text-muted text-sm" aria-live="polite">
              {t("list.results", { count: products.meta.total + stock.meta.total })}{" "}
              <Link href="/products" className="text-primary underline underline-offset-2">
                {t("list.clear")}
              </Link>
            </p>
          ) : null}

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
              <ProductGrid items={catalogue} types={types} hints={hints} />
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
