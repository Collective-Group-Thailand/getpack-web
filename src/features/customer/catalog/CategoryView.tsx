import { getLocale, getTranslations } from "next-intl/server";

import { loadHubItems } from "@/features/customer/products/catalogue.server";
import { HubCatalogue } from "@/features/customer/products/HubCatalogue";
import type { HubParams } from "@/features/customer/products/query";
import { RfqTray } from "@/features/customer/products/RfqTray";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, publicOrigin, webPageSchema } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { CatalogueCategory } from "./api.server";
import { CatalogueNav } from "./CatalogueNav";
import { pick } from "./localize";
import { categoryGroup } from "./ordering";
import { categoryHref, rfqHref } from "./paths";
import { ProductSearchForm } from "./ProductSearchForm";

/**
 * One category: its product types as filters, and every product in them — listed by the /products hub's
 * own catalogue (products Phase 2 item 3): the buying-mode tabs, the sort, the card ↔ price-table toggle,
 * "โหลดเพิ่ม" and the RFQ tray, over every product of the category (sub-categories included, D-228).
 */
export async function CategoryView({
  category,
  tree,
  typeCode,
  query,
}: {
  category: CatalogueCategory;
  tree: readonly CatalogueCategory[];
  typeCode?: string;
  /** The hub's list state from the URL (mode, sort, view, page — Phase 2 item 3). */
  query: HubParams;
}) {
  const [t, locale, origin] = await Promise.all([getTranslations("catalog"), getLocale(), publicOrigin()]);
  const selected = category.types.find((type) => type.code === typeCode);
  // Every product of the category (sub-categories included, D-228) as hub items, narrowed to the chosen type.
  const data = await loadHubItems({ q: query.q, category: category.code });
  const items = selected ? data.items.filter((item) => item.productTypeCode === selected.code) : data.items;

  const name = pick(locale, category.nameTh, category.nameEn);
  const hasRfq = category.types.some((type) => type.quoteMode === "rfq");
  const base = categoryHref(category.code);
  const href = (target: { type?: string }) => (target.type ? `${base}?type=${encodeURIComponent(target.type)}` : base);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
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
          {t("list.results", { count: items.length })}
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

          {/* Products Phase 2 item 3: the hub's mode tabs, sort, card ↔ price table, and RFQ toggles. */}
          <HubCatalogue
            items={items}
            params={query}
            base={base}
            tree={tree}
            showCategories={false}
            fixed={selected ? { type: selected.code } : {}}
            columns={3}
            eager={2}
          />

          {hasRfq || categoryGroup(category) !== "service" ? (
            <div className="bg-fg text-fg-inverse rounded-card flex flex-wrap items-center gap-4 p-5 sm:p-6">
              <span className="grid size-12 place-items-center rounded-xl bg-current/10" aria-hidden="true">
                <Icon name="chat" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{t("category.rfqTitle")}</p>
                <p className="text-sm opacity-75">{t("category.rfqBody")}</p>
              </div>
              <Link
                href={rfqHref(category.code)}
                className="bg-surface text-fg rounded-cta inline-flex h-10 items-center px-4 text-sm font-semibold whitespace-nowrap sm:px-5"
              >
                {t("category.rfqCta")}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
      <RfqTray />
    </div>
  );
}
