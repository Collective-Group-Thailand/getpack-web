import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { HubCatalogue } from "@/features/customer/products/HubCatalogue";
import { HubSection } from "@/features/customer/products/HubSections";
import type { HubParams } from "@/features/customer/products/query";
import { QuoteTrayProvider } from "@/features/customer/products/quote-tray";
import { RfqTray } from "@/features/customer/products/RfqTray";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LineFloat } from "@/features/customer/shell/LineFloat";
import { vatSwitchAvailable } from "@/features/shared/format/price";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env/server";
import { breadcrumbSchema, publicOrigin, webPageSchema } from "@/lib/seo";
import { faqPageSchema, productSchema } from "@/lib/seo/structured-data";
import { AnchorNav } from "@/ui/components/AnchorNav";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { CatalogueCategory } from "./api.server";
import { CategoryHead } from "./category/CategoryHead";
import { CategoryFaq, CategoryGuide, CrossLink, guideGroups } from "./category/CategorySections";
import { CompareTable } from "./category/CompareTable";
import { loadCategory, ROWS_MAX } from "./category/data.server";
import { ProductRows } from "./category/ProductRows";
import { SizeFinder } from "./category/size-finder/SizeFinder";
import { TrackedLink } from "./category/tracking";
import { filterByUseCase, caseChipsOf } from "./category/useCases";
import { absoluteImageUrl } from "./images";
import { pick } from "./localize";
import { categoryHref, productHref, stockProductHref } from "./paths";

export interface CategoryParams {
  /** A product type of the category (only categories with more than one). */
  type?: string;
  /** An approved use case id (`?use=`). */
  use?: string;
  /** The standard size the finder opens on (`?size=`). */
  size?: string;
}

/**
 * `/products/[category]` (category redesign Phase 1): the head with facts and the sibling chips, a sticky section
 * bar, the products (rows with spec chips for up to eight items, ⇄ a comparison table; more items: the /products
 * grid and price table), the standard-size finder (instant box products with standard sizes), the flute / material
 * guide, "ต้องการแบบอื่น" and the approved FAQ — each section only when its data exists. Rendered on the server
 * from the URL; every figure is the API's (GLOBAL-RULES §3, §5).
 */
export async function CategoryView({
  category,
  tree,
  params,
  query,
}: {
  category: CatalogueCategory;
  tree: readonly CatalogueCategory[];
  params: CategoryParams;
  /** The hub's list state from the URL (grid categories: mode, sort, view, page; rows: view). */
  query: HubParams;
}) {
  const [t, tCatalog, tContent, locale, origin, jar, support] = await Promise.all([
    getTranslations("catalog.categoryPage"),
    getTranslations("catalog"),
    getTranslations("catalog.categoryContent"),
    getLocale(),
    publicOrigin(),
    cookies(),
    getSupportChannels(),
  ]);
  const selectedType = category.types.find((type) => type.code === params.type);
  const data = await loadCategory(category, selectedType?.code);
  const { items, facts, content } = data;
  const name = pick(locale, category.nameTh, category.nameEn);
  const base = categoryHref(category.code);
  const localised = (path: string) => getPathname({ href: path, locale: locale as Locale });
  const c = content.categoryCode;
  const intro = content.intro && tContent.has(`${c}.intro`) ? tContent(`${c}.intro`) : null;

  // The list: rows for up to eight items (prompt item 4), the hub's grid beyond.
  const rowsView = items.length <= ROWS_MAX && items.length > 0;
  const useCases = content.useCases?.items ?? [];
  const chips = rowsView
    ? caseChipsOf(
        useCases,
        items.map((item) => item.key),
      )
    : [];
  const use = chips.some((chip) => chip.id === params.use) ? params.use! : null;
  const listed = filterByUseCase(items, useCases, use);
  const table = query.view === "table";
  const fixed: Record<string, string> = selectedType ? { type: selectedType.code } : {};
  const listHref = (changes: { use?: string | null; view?: "table" | null }) => {
    const search = new URLSearchParams(fixed);
    const nextUse = "use" in changes ? changes.use : use;
    const nextView = "view" in changes ? changes.view : table ? "table" : null;
    if (nextUse) search.set("use", nextUse);
    if (nextView) search.set("view", nextView);
    const text = search.toString();
    return `${base}${text ? `?${text}` : ""}#list`;
  };

  const names = new Map(items.map((item) => [item.key, pick(locale, item.nameTh, item.nameEn)]));
  const fluteGroups = guideGroups(
    data.configurators.filter((configurator) => configurator.calculator === "corrugate"),
    names,
    locale,
    null,
  );
  const materialGuide =
    !fluteGroups.length && content.guide && tContent.has(`${c}.guide.title`)
      ? guideGroups(data.configurators, names, locale, content.guide.materialCodes)
      : [];
  const guideKind = fluteGroups.length ? "flute" : materialGuide.length ? "material" : null;
  const faq = (content.faq?.keys ?? [])
    .filter((key) => tContent.has(`${c}.faq.${key}.q`) && tContent.has(`${c}.faq.${key}.a`))
    .map((key) => ({ question: tContent(`${c}.faq.${key}.q`), answer: tContent(`${c}.faq.${key}.a`) }));
  const quote = facts.mode !== "service";
  const finder = data.finder.map((configurator) => ({
    slug: configurator.slug,
    name: names.get(configurator.slug) ?? configurator.slug,
    configurator,
  }));

  const sections = [
    { id: "list", label: t("sections.list") },
    ...(finder.length ? [{ id: "sizes", label: t("sections.sizes") }] : []),
    ...(guideKind ? [{ id: "guide", label: t(`sections.${guideKind}`) }] : []),
    ...(data.styles || quote ? [{ id: "custom", label: t("sections.custom") }] : []),
    ...(faq.length ? [{ id: "faq", label: t("sections.faq") }] : []),
  ];
  const vatSwitch = vatSwitchAvailable(
    items.flatMap((item) =>
      item.startingPrice !== null ? [{ incl: item.startingPrice, excl: item.startingPriceExVat }] : [],
    ),
  );
  const container = "max-w-nav mx-auto px-5 md:px-8 xl:px-12";
  const tProducts = await getTranslations("products");
  const home = tProducts("head.home");
  const hub = tProducts("head.breadcrumb");

  return (
    <QuoteTrayProvider signedIn={Boolean(readAccessToken(jar))} account={featureFlags.rfqProductRef}>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: home, url: `${origin}${localised("/")}` },
            { name: hub, url: `${origin}${localised("/products")}` },
            { name },
          ]),
          webPageSchema({
            type: "CollectionPage",
            name,
            description: intro ?? (facts.mode ? t(`lede.${facts.mode}`) : name),
            url: `${origin}${localised(base)}`,
            locale,
            speakableSelector: ["#category-answer"],
          }),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name,
            numberOfItems: items.length,
            itemListElement: items.slice(0, 30).map((item, index) => {
              const itemName = names.get(item.key)!;
              const url = `${origin}${localised(item.kind === "stock" ? stockProductHref(item.key) : productHref(item.key))}`;
              const image = absoluteImageUrl(origin, item.imageUrl);
              // A Product with an offer only where there is a real instant price (VAT included, D-220).
              return {
                "@type": "ListItem",
                position: index + 1,
                ...(item.mode === "instant" && item.startingPrice
                  ? {
                      item: productSchema({
                        name: itemName,
                        url,
                        images: image ? [image] : [],
                        sku: item.key,
                        lowPrice: item.startingPrice,
                        currency: "THB",
                      }),
                    }
                  : { url, name: itemName }),
              };
            }),
          },
          ...(faq.length ? [faqPageSchema(faq)] : []),
        ]}
      />

      <div className={`${container} pt-6 md:pt-8`}>
        <CategoryHead category={category} tree={tree} facts={facts} intro={intro} vatSwitch={vatSwitch} />
      </div>

      <AnchorNav aria-label={t("sections.label")} items={sections} className="mt-8" innerClassName={container} />

      <div className={`${container} pb-28`}>
        <HubSection
          id="list"
          title={t("list.title")}
          lede={rowsView && items.length > 1 ? (chips.length ? t("list.ledeUses") : t("list.lede")) : undefined}
          aside={
            rowsView && items.length > 1 ? (
              <div
                role="group"
                aria-label={t("list.view")}
                className="border-border-strong rounded-control inline-flex overflow-hidden border"
              >
                {(["rows", "table"] as const).map((view) => {
                  const on = (view === "table") === table;
                  return (
                    <TrackedLink
                      key={view}
                      href={listHref({ view: view === "table" ? "table" : null })}
                      scroll={false}
                      aria-current={on ? "true" : undefined}
                      aria-label={t(`list.${view}`)}
                      title={t(`list.${view}`)}
                      track={{ event: "category_view_toggle", properties: { category: category.code, view } }}
                      className={cn(
                        "focus-visible:ring-focus-ring grid h-9 w-10 place-items-center outline-none focus-visible:ring-2 focus-visible:ring-inset",
                        on ? "bg-bg-subtle text-fg" : "bg-surface text-muted hover:text-fg",
                      )}
                    >
                      <Icon name={view === "rows" ? "dashboard" : "spreadsheet"} size={18} aria-hidden="true" />
                    </TrackedLink>
                  );
                })}
              </div>
            ) : undefined
          }
        >
          {category.types.length > 1 ? (
            <nav aria-label={tCatalog("list.types")} className="mb-4">
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {[null, ...category.types].map((type) => {
                  const on = (type?.code ?? null) === (selectedType?.code ?? null);
                  return (
                    <li key={type?.code ?? "all"}>
                      <Link
                        href={type ? `${base}?type=${encodeURIComponent(type.code)}` : base}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "rounded-control focus-visible:ring-focus-ring inline-flex h-9 items-center border px-4 text-sm outline-none focus-visible:ring-2",
                          on
                            ? "border-primary bg-primary text-primary-fg font-medium"
                            : "border-border hover:bg-bg-subtle",
                        )}
                      >
                        {type ? pick(locale, type.nameTh, type.nameEn) : tCatalog("list.allTypes")}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
          {chips.length ? (
            <div role="group" aria-label={t("list.uses")} className="mb-4 flex flex-wrap gap-2">
              {[{ id: null as string | null, count: items.length }, ...chips].map((chip) => {
                const on = chip.id === use;
                return (
                  <TrackedLink
                    key={chip.id ?? "all"}
                    href={listHref({ use: chip.id })}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    track={{
                      event: "category_use_filter",
                      properties: { category: category.code, use: chip.id ?? "all", count: chip.count },
                    }}
                    className={cn(
                      "rounded-control focus-visible:ring-focus-ring inline-flex items-center gap-2 border px-3.5 py-2 text-sm font-medium outline-none focus-visible:ring-2",
                      on
                        ? "border-primary bg-primary-subtle text-primary ring-primary ring-1 ring-inset"
                        : "border-border-strong bg-surface",
                    )}
                  >
                    {chip.id ? tContent(`${c}.useCases.${chip.id}`) : t("list.allUses")}
                    <small className="text-muted tabular-nums">{chip.count}</small>
                  </TrackedLink>
                );
              })}
            </div>
          ) : null}
          {rowsView ? (
            table ? (
              <CompareTable items={listed} details={data.details} content={content} />
            ) : (
              <ProductRows items={listed} details={data.details} content={content} />
            )
          ) : (
            <HubCatalogue
              items={items}
              params={query}
              base={base}
              tree={tree}
              showCategories={false}
              fixed={fixed}
              columns={4}
              eager={4}
            />
          )}
        </HubSection>

        {finder.length ? (
          <HubSection
            id="sizes"
            title={finder.length === 1 ? t("finder.title", { product: finder[0]!.name }) : t("sections.sizes")}
            lede={
              finder.length === 1
                ? t("finder.lede", {
                    product: finder[0]!.name,
                    count: finder[0]!.configurator.standardSizes.filter((size) => size.heightMm > 0).length,
                  })
                : undefined
            }
          >
            <SizeFinder category={category.code} products={finder} initialSize={params.size ?? null} />
          </HubSection>
        ) : null}

        {guideKind ? (
          <CategoryGuide
            category={category.code}
            kind={guideKind}
            groups={guideKind === "flute" ? fluteGroups : materialGuide}
            title={guideKind === "flute" ? t("guide.fluteTitle") : tContent(`${c}.guide.title`)}
            compareLink={data.materialsPage}
          />
        ) : null}

        <CrossLink category={category.code} categoryName={name} styles={data.styles} quote={quote} />
        <CategoryFaq title={t("faq.title", { category: name })} items={faq} />
      </div>

      <RfqTray />
      <LineFloat apiLineOaId={support?.lineOaId} />
    </QuoteTrayProvider>
  );
}
