import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  getConfigurator,
  getProduct,
  getSupportChannels,
  type Configurator,
} from "@/features/customer/catalog/api.server";
import { absoluteImageUrl } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { categoryHref, productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LineFloat } from "@/features/customer/shell/LineFloat";
import { loadHubItems } from "@/features/customer/products/catalogue.server";
import { FAQ_KEYS } from "@/features/customer/products/content";
import { instantLeadBand, modeSummary, type HubItem, type HubMode } from "@/features/customer/products/hub";
import { HubCatalogue } from "@/features/customer/products/HubCatalogue";
import { HubSearch } from "@/features/customer/products/HubSearch";
import {
  CtaBand,
  HowPricing,
  HubFaq,
  HubSection,
  MaterialsTable,
  materialRows,
  ProcessSteps,
  ServiceLinks,
} from "@/features/customer/products/HubSections";
import { HubTracker } from "@/features/customer/products/HubTracker";
import { ModeCards } from "@/features/customer/products/ModeCards";
import { DEFAULT_PARAMS, hubHref, isFilteredHub, readHubParams } from "@/features/customer/products/query";
import { QuickCalcLazy } from "@/features/customer/products/QuickCalcLazy";
import { RfqTray } from "@/features/customer/products/RfqTray";
import { getFormat } from "@/features/shared/format/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { clientEnv } from "@/lib/env";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { breadcrumbSchema, faqPageSchema, productSchema } from "@/lib/seo/structured-data";
import { AnchorNav } from "@/ui/components/AnchorNav";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BASE = "/products";
/** How many instant products the calculator and the materials table read configurators for. */
const MAX_CALC_PRODUCTS = 12;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [t, locale, origin, raw] = await Promise.all([
    getTranslations("products.meta"),
    getLocale(),
    publicOrigin(),
    searchParams,
  ]);
  const { canonical, languages } = alternateUrls(origin, BASE, locale as Locale);
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical, languages },
    // A filtered, sorted or searched view is a view of this page, not a page of its own.
    ...(isFilteredHub(readHubParams(raw)) ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * "สินค้าและราคา" — the hub of everything a customer can buy (products redesign Phase 1,
 * `docs/design/products-redesign/`): the head with live search and totals, the four buying modes, a
 * sticky section bar, the quick calculator, every product (filtered, sorted and paged on the server
 * from the URL), how pricing works, the corrugated materials, the process, add-on services, FAQ and a
 * closing band — plus the RFQ tray and the LINE button. Rendered on the server from the URL; every
 * figure is the API's, and a part without data is left out.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = readHubParams(await searchParams);
  const [t, tCatalog, origin, format, data, support] = await Promise.all([
    getTranslations("products"),
    getTranslations("catalog"),
    publicOrigin(),
    getFormat(),
    loadHubItems({ q: query.q }),
    getSupportChannels(),
  ]);
  // The calculator, the mode cards and the sections speak of the whole catalogue, whatever is searched.
  const everything = query.q ? await loadHubItems() : data;
  const all = everything.items;
  const { items, tree } = data;

  const instant = all.filter((item) => item.kind === "catalog" && item.mode === "instant").slice(0, MAX_CALC_PRODUCTS);
  const configurators = (await Promise.all(instant.map((item) => getConfigurator(item.key).catch(() => null)))).filter(
    (configurator): configurator is Configurator => configurator !== null && configurator.instant,
  );
  const calcProducts = instant
    .filter((item) => configurators.some((configurator) => configurator.slug === item.key))
    .map((item) => ({ slug: item.key, nameTh: item.nameTh, nameEn: item.nameEn, imageUrl: item.imageUrl }));
  const hasMaterials = materialRows(configurators, locale).length > 0;

  const serviceItems = all.filter((item) => item.mode === "service" && item.kind === "catalog");
  const serviceDetails = await Promise.all(serviceItems.map((item) => getProduct(item.key).catch(() => null)));
  const services = serviceItems.map((item, index) => {
    const detail = serviceDetails[index];
    return {
      key: item.key,
      name: pick(locale, item.nameTh, item.nameEn),
      description: detail ? pick(locale, detail.descriptionTh ?? "", detail.descriptionEn ?? "") || null : null,
      href: productHref(item.key),
    };
  });

  const categories = new Set(items.flatMap((item) => (item.categoryCode ? [item.categoryCode] : [])));
  const summary = modeSummary(all);
  const unitOf = (unit: HubItem["unit"]) => tCatalog(`stock.units.${unit ?? "piece"}`);
  const bold = (chunks: React.ReactNode) => <b>{chunks}</b>;
  const lines: Record<HubMode, React.ReactNode | undefined> = {
    instant: summary.instant
      ? summary.instant.moq !== null
        ? t.rich("modes.instant.lineMoq", {
            price: format.thb(summary.instant.price),
            unit: unitOf(summary.instant.unit),
            moq: summary.instant.moq,
            b: bold,
          })
        : t.rich("modes.instant.line", {
            price: format.thb(summary.instant.price),
            unit: unitOf(summary.instant.unit),
            b: bold,
          })
      : undefined,
    quote: summary.quote
      ? summary.quote.min === summary.quote.max
        ? t.rich("modes.quote.lineOne", { min: summary.quote.min, b: bold })
        : t.rich("modes.quote.lineRange", { min: summary.quote.min, max: summary.quote.max, b: bold })
      : undefined,
    stock: summary.stock ? t.rich("modes.stock.line", { min: summary.stock.min, b: bold }) : undefined,
    service: all.some((item) => item.mode === "service") ? t("modes.service.line") : undefined,
  };
  const presentModes = (["instant", "quote", "stock", "service"] as const).filter((mode) =>
    all.some((item) => item.mode === mode),
  );

  const sections = [
    ...(calcProducts.length ? [{ id: "calc", label: t("sections.calc") }] : []),
    { id: "catalog", label: t("sections.catalog") },
    { id: "how", label: t("sections.how") },
    ...(hasMaterials ? [{ id: "materials", label: t("sections.materials") }] : []),
    { id: "process", label: t("sections.process") },
    ...(services.length ? [{ id: "services", label: t("sections.services") }] : []),
    { id: "faq", label: t("sections.faq") },
  ];

  // The same order as the floating button (`LineFloat.resolveLineOaId`, a client module): the build's id, else staff's.
  const lineOaId = clientEnv.NEXT_PUBLIC_LINE_OA_ID?.trim() || support?.lineOaId?.trim() || null;
  // "ขอใบเสนอราคา": the made-to-spec items, where each goes into the one quotation request (the tray).
  const quoteHref = `${hubHref(BASE, DEFAULT_PARAMS, { mode: "quote" })}#catalog`;
  const localised = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;
  const container = "max-w-nav mx-auto px-5 md:px-8 xl:px-12";

  return (
    <>
      {!isFilteredHub(query) ? (
        <JsonLd
          data={[
            breadcrumbSchema([{ name: t("head.home"), url: localised("/") }, { name: t("head.breadcrumb") }]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: t("head.title"),
              numberOfItems: all.length,
              itemListElement: all.slice(0, 30).map((item, index) => {
                const name = pick(locale, item.nameTh, item.nameEn);
                const url = localised(item.kind === "stock" ? stockProductHref(item.key) : productHref(item.key));
                const image = absoluteImageUrl(origin, item.imageUrl);
                // A Product with an offer only where there is a real instant price (VAT included, D-220).
                return {
                  "@type": "ListItem",
                  position: index + 1,
                  ...(item.mode === "instant" && item.startingPrice
                    ? {
                        item: productSchema({
                          name,
                          url,
                          images: image ? [image] : [],
                          sku: item.key,
                          lowPrice: item.startingPrice,
                          currency: "THB",
                        }),
                      }
                    : { url, name }),
                };
              }),
            },
            faqPageSchema(
              FAQ_KEYS.map((key) => ({ question: t(`faq.items.${key}.q`), answer: t(`faq.items.${key}.a`) })),
            ),
          ]}
        />
      ) : null}
      <HubTracker query={query.q} resultCount={items.length} />

      <div className={`${container} pt-6 md:pt-8`}>
        <Breadcrumbs
          label={t("head.breadcrumbLabel")}
          items={[{ label: t("head.home"), href: "/" }, { label: t("head.breadcrumb") }]}
          className="mb-3"
        />
        <header className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32.5rem)] lg:items-end">
          <div>
            <h1 className="text-[1.875rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.625rem]">
              {t("head.title")}
            </h1>
            <p className="text-muted mt-2.5 max-w-[60ch] text-pretty">{t("head.lede")}</p>
          </div>
          <div>
            <HubSearch params={query} base={BASE} action={getPathname({ href: BASE, locale: locale as Locale })} />
            <div className="text-muted mt-2.5 flex flex-wrap items-center justify-between gap-3 text-[0.8125rem]">
              <span aria-live="polite">{t("head.totals", { items: items.length, categories: categories.size })}</span>
              {/* The VAT switch is drawn only when the API sends both figures (`vatSwitchAvailable`); it sends
                  the VAT-inclusive one only (R3), so every price says so instead. */}
              <span className="text-muted">{t("head.vatIncludedNote")}</span>
            </div>
          </div>
        </header>
        <ModeCards
          label={t("modes.label")}
          cards={presentModes.map((mode) => ({
            mode,
            name: t(`modes.${mode}.name`),
            description: t(`modes.${mode}.description`),
            line: lines[mode],
            href: hubHref(BASE, query, { mode: query.mode === mode ? null : mode }),
            pressed: query.mode === mode,
          }))}
        />
      </div>

      <AnchorNav aria-label={t("sections.label")} items={sections} className="mt-8" innerClassName={container} />

      <div className={`${container} pb-28`}>
        {calcProducts.length ? (
          <HubSection id="calc" title={t("calc.title")} lede={t("calc.lede")}>
            <QuickCalcLazy products={calcProducts} guaranteeHref="/guarantee" />
          </HubSection>
        ) : null}

        <HubSection id="catalog" title={t("catalogue.title")} lede={t("catalogue.lede")}>
          <HubCatalogue items={items} params={query} base={BASE} tree={tree} categoryPage={categoryHref} />
        </HubSection>

        <HowPricing />
        <MaterialsTable configurators={configurators} />
        <ProcessSteps leadBand={instantLeadBand(all)} />
        <ServiceLinks services={services} />
        <HubFaq />
        <CtaBand quoteHref={quoteHref} lineOaId={lineOaId} hours={support?.hours ?? null} />
      </div>

      <RfqTray />
      <LineFloat apiLineOaId={support?.lineOaId} />
    </>
  );
}
