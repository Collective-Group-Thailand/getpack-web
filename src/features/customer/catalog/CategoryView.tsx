import { getLocale, getTranslations } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { cn } from "@/ui/lib/cn";

import { getPriceHints, listProducts, listStockProducts, type CatalogueCategory } from "./api.server";
import { CatalogueNav } from "./CatalogueNav";
import { pick } from "./localize";
import { categoryHref, rfqHref } from "./paths";
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
}: {
  category: CatalogueCategory;
  tree: readonly CatalogueCategory[];
  typeCode?: string;
  page: number;
}) {
  const [t, locale, origin] = await Promise.all([getTranslations("catalog"), getLocale(), publicOrigin()]);
  const selected = category.types.find((type) => type.code === typeCode);
  const filter = { category: category.code, ...(selected ? { productType: selected.code } : {}), perPage: 100 };

  const [products, stock] = await Promise.all([listProducts(filter), listStockProducts(filter)]);
  const all = [
    ...products.data.map((product): GridItem => ({ kind: "catalog", product })),
    ...stock.data.map((product): GridItem => ({ kind: "stock", product })),
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
  const href = (target: { type?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (target.type) search.set("type", target.type);
    if (target.page && target.page > 1) search.set("page", String(target.page));
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const crumbs = [
    { label: t("breadcrumbs.home"), href: localised("/") },
    { label: t("breadcrumbs.products"), href: localised("/products") },
    { label: name },
  ];
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
      active
        ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
        : "border-border hover:bg-bg-subtle",
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
      <Breadcrumbs items={crumbs} label={t("breadcrumbs.label")} />
      <h1 className="mt-4 text-3xl font-bold md:text-4xl">{name}</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-[14rem_1fr]">
        <aside className="min-w-0">
          <CatalogueNav tree={tree} current={category.code} />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {category.types.length > 1 ? (
            <nav aria-label={t("list.types")}>
              <ul className="flex flex-wrap gap-2">
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

          {items.length > 0 ? (
            <ProductGrid items={items} types={types} hints={hints} headingLevel="h2" />
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

          {hasRfq ? (
            <Callout tone="info" title={t("category.rfqTitle")}>
              <p>{t("category.rfqBody")}</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href={rfqHref(category.code)}>{t("category.rfqCta")}</Link>
              </Button>
            </Callout>
          ) : null}
        </div>
      </div>
    </div>
  );
}
