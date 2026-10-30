import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  getConfigurator,
  getFeaturedServices,
  getProduct,
  getPublicConfig,
  getSupportChannels,
  type Configurator,
} from "@/features/customer/catalog/api.server";
import { absoluteImageUrl } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { categoryHref, productHref, stockProductHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LineFloat } from "@/features/customer/shell/LineFloat";
import { loadHubItems } from "@/features/customer/products/catalogue.server";
import { FAQ_KEYS, faqAnswer } from "@/features/customer/products/content";
import {
  featuredServices,
  instantLeadBand,
  modeSummary,
  type HubItem,
  type HubMode,
} from "@/features/customer/products/hub";
import { HubCatalogue } from "@/features/customer/products/HubCatalogue";
import { HubSearch } from "@/features/customer/products/HubSearch";
import {
  CtaBand,
  HowPricing,
  HubFaq,
  HubSection,
  HubSectionStack,
  MaterialsTable,
  ProcessSteps,
  ServiceLinks,
} from "@/features/customer/products/HubSections";
import { HubTracker } from "@/features/customer/products/HubTracker";
import { HubVatSwitch } from "@/features/customer/products/HubVatSwitch";
import { DEFAULT_PARAMS, hubHref, isFilteredHub, readHubParams } from "@/features/customer/products/query";
import { QuickCalcLazy } from "@/features/customer/products/QuickCalcLazy";
import { QuoteTrayProvider } from "@/features/customer/products/quote-tray";
import { RfqTray } from "@/features/customer/products/RfqTray";
import { vatSwitchAvailable } from "@/features/shared/format/price";
import { getFormat } from "@/features/shared/format/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { featureFlags } from "@/lib/env/server";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { breadcrumbSchema, faqPageSchema, productSchema } from "@/lib/seo/structured-data";
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
 * `docs/design/products-redesign/`; reordered by Project A): a short head with the totals, then the
 * catalogue first under one sticky toolbar — search, the buying modes as tabs with their key figures,
 * category chips, sort and the grid/table toggle — then the quick calculator, the reference sections
 * (how pricing works, the corrugated materials, the process, add-on services) folded to their headings,
 * the FAQ and a light closing band — plus the RFQ tray and the LINE button. Rendered on the server from
 * the URL; every figure is the API's, and a part without data is left out.
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
  const [t, tCatalog, origin, format, data, support, featured, config, jar] = await Promise.all([
    getTranslations("products"),
    getTranslations("catalog"),
    publicOrigin(),
    getFormat(),
    loadHubItems({ q: query.q }),
    getSupportChannels(),
    getFeaturedServices(),
    getPublicConfig(),
    cookies(),
  ]);
  // D-447 §10.8: the tax-invoice answer names the issuing company from its settings.
  const company = config
    ? pick(locale, config.issuer.legalNameTh ?? "", config.issuer.legalNameEn ?? config.issuer.legalNameTh ?? "") ||
      null
    : null;
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

  // D-447 §10.3: staff's chosen services (≤ 3, their order), else the first three of the list; details for those only.
  const serviceList = featuredServices(
    all.filter((item) => item.mode === "service" && item.kind === "catalog"),
    featured,
  );
  const serviceItems = serviceList.shown;
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
  const vatSwitch = vatSwitchAvailable(
    items.flatMap((item) =>
      item.startingPrice !== null ? [{ incl: item.startingPrice, excl: item.startingPriceExVat }] : [],
    ),
  );
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
  // The same order as the floating button (`LineFloat.resolveLineOaId`, a client module): the build's id, else staff's.
  const lineOaId = clientEnv.NEXT_PUBLIC_LINE_OA_ID?.trim() || support?.lineOaId?.trim() || null;
  // "ขอใบเสนอราคา": the made-to-spec items, where each goes into the one quotation request (the tray).
  const quoteHref = `${hubHref(BASE, DEFAULT_PARAMS, { mode: "quote" })}#catalog`;
  const localised = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;
  const container = "max-w-nav mx-auto px-5 md:px-8 xl:px-12";

  return (
    <QuoteTrayProvider signedIn={Boolean(readAccessToken(jar))} account={featureFlags.rfqProductRef}>
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
              FAQ_KEYS.map((key) => ({
                question: t(`faq.items.${key}.q`),
                answer: faqAnswer((k, values) => t(`faq.${k}`, values), key, company),
              })),
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
        <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-3">
          <div>
            <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
              {t("head.title")}
            </h1>
            <p className="text-muted mt-2 max-w-[60ch] text-pretty">{t("head.lede")}</p>
          </div>
          <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
            <span aria-live="polite">{t("head.totals", { items: items.length, categories: categories.size })}</span>
            {/* D-447 §10.6: "ราคารวม VAT / ไม่รวม VAT" only when the API sent both figures for every price
                listed (`vatSwitchAvailable`); otherwise every price says it includes VAT. */}
            {vatSwitch ? (
              <HubVatSwitch label={t("head.vatLabel")} incl={t("head.vatIncl")} excl={t("head.vatExcl")} />
            ) : (
              <span>{t("head.vatIncludedNote")}</span>
            )}
          </div>
        </header>
      </div>

      <div className={`${container} pb-16 md:pb-20`}>
        {/* Project A: the catalogue comes first, under one sticky toolbar; the buying modes are its tabs. */}
        <section
          id="catalog"
          tabIndex={-1}
          aria-labelledby="catalog-title"
          className="mt-5 scroll-mt-[var(--site-sticky-top)] outline-none md:mt-6"
        >
          <h2 id="catalog-title" className="sr-only">
            {t("catalogue.title")}
          </h2>
          <HubCatalogue
            items={items}
            params={query}
            base={BASE}
            tree={tree}
            categoryPage={categoryHref}
            sticky
            modeLines={lines}
            search={
              <HubSearch
                params={query}
                base={BASE}
                action={getPathname({ href: BASE, locale: locale as Locale })}
                compact
              />
            }
          />
        </section>

        {calcProducts.length ? (
          <HubSection id="calc" title={t("calc.title")} lede={t("calc.lede")}>
            <QuickCalcLazy products={calcProducts} guaranteeHref="/guarantee" />
          </HubSection>
        ) : null}

        {/* The reference sections, folded to their headings: the catalogue and the calculator lead. */}
        <HubSectionStack className="mt-14">
          <HowPricing collapsible />
          <MaterialsTable configurators={configurators} collapsible />
          <ProcessSteps leadBand={instantLeadBand(all)} collapsible />
          <ServiceLinks
            services={services}
            allHref={serviceList.more ? `${hubHref(BASE, DEFAULT_PARAMS, { mode: "service" })}#catalog` : null}
            collapsible
          />
        </HubSectionStack>
        <HubFaq company={company} />
        <CtaBand quoteHref={quoteHref} lineOaId={lineOaId} hours={support?.hours ?? null} />
      </div>

      <RfqTray />
      <LineFloat apiLineOaId={support?.lineOaId} />
    </QuoteTrayProvider>
  );
}
