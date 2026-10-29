import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getLibraryTotals,
  getPublicConfig,
  getStyleLibrarySettings,
  getSupportChannels,
  listStyles,
} from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { rfqHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { CategoryRail } from "@/features/customer/styles/CategoryRail";
import { CompareLimitProvider } from "@/features/customer/styles/compare-store";
import { CompareTray } from "@/features/customer/styles/CompareTray";
import { groupFacets } from "@/features/customer/styles/facet-groups";
import { ClearFiltersButton, FilterPanel, type PanelGroup } from "@/features/customer/styles/FilterPanel";
import { FilterSheet } from "@/features/customer/styles/FilterSheet";
import { axisLabel, facetLabel, valueLabel, type StylesT } from "@/features/customer/styles/labels";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import { CopyLinkButton, SearchTracker, SortSelect } from "@/features/customer/styles/LibraryControls";
import { LibrarySearch } from "@/features/customer/styles/LibrarySearch";
import { LineFloat } from "@/features/customer/shell/LineFloat";
import { LibraryEmpty } from "@/features/customer/styles/LibraryEmpty";
import { LibraryToolbar } from "@/features/customer/styles/LibraryToolbar";
import { VatSwitch } from "@/features/customer/styles/VatSwitch";
import { figuresOf, vatSwitchAvailable } from "@/features/shared/format/price";
import { LibraryViews } from "@/features/customer/styles/LibraryViews";
import { forUseCaseHref, styleHref, STYLES_HREF } from "@/features/customer/styles/paths";
import {
  activeFilterCount,
  clearFilters,
  FACET_KEYS,
  isFiltered,
  listHref,
  PAGE_SIZE,
  readParams,
  SORTS,
  toggleValue,
  toQuery,
  type ListParams,
} from "@/features/customer/styles/query";
import { landingOfUseCase, PACKAGING_LANDINGS, packagingHref } from "@/features/customer/styles/packaging-landings";
import { QuickViewHost } from "@/features/customer/styles/QuickViewHost";
import { cmOfSize } from "@/features/customer/styles/size";
import { TrustBlock } from "@/features/customer/styles/TrustBlock";
import { WizardButton } from "@/features/customer/styles/WizardButton";
import { wizardSummary } from "@/features/customer/styles/wizard-labels";
import { StudioStyleLibrary } from "@/features/customer/styles/StudioStyleLibrary";
import { CompareToggle, FavouriteToggle } from "@/features/customer/styles/StyleCardActions";
import { cardWords, StyleCardFace } from "@/features/customer/styles/StyleCardFace";
import { StyleResults } from "@/features/customer/styles/StyleResults";
import { isUseCase } from "@/features/customer/styles/use-cases";
import { isVariantsView, readVariantParams } from "@/features/customer/styles/variant-query";
import { VariantsView } from "@/features/customer/styles/VariantsView";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env/server";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { breadcrumbSchema, productSchema } from "@/lib/seo/structured-data";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The landing page a view stands for, if any: one use case and nothing else is that use case's
 * page (`/styles/for/<useCase>`, D-410) — the view canonicalises to it rather than to the list.
 */
function landingOf(params: ListParams): string | null {
  const [useCase, ...more] = params.useCase;
  const others =
    FACET_KEYS.some((k) => k !== "useCase" && params[k].length) ||
    params.eco.length ||
    params.pricePath ||
    params.q ||
    params.size;
  if (!(useCase && more.length === 0 && !others && !params.wizard && !params.category && isUseCase(useCase)))
    return null;
  // C0: with the packaging landing pages on, a use case that has one canonicalises there.
  const landing = featureFlags.packagingLandings ? landingOfUseCase(useCase) : undefined;
  return landing ? packagingHref(landing.slug) : forUseCaseHref(useCase);
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [t, locale, origin, raw] = await Promise.all([
    getTranslations("styles"),
    getLocale(),
    publicOrigin(),
    searchParams,
  ]);
  const params = readParams(raw);
  // A filtered or searched view — and the variants grid, whose cards are not pages (D-410) — is a
  // view of the library, not a page of its own: it points at the list, or at the landing page it equals.
  const { canonical, languages } = alternateUrls(origin, landingOf(params) ?? STYLES_HREF, locale as Locale);
  return {
    title: t("meta.listTitle"),
    description: t("meta.listDescription"),
    alternates: { canonical, languages },
    // A view that equals a landing page is that page under another URL: canonical only (no noindex
    // beside it — the two would contradict each other).
    ...((isFiltered(params) && !landingOf(params)) || isVariantsView(raw)
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

/**
 * The style library (U3.5, redesigned: `docs/design/styles-redesign/PLAN.md`). Rendered on the
 * server from the URL: the head with live search, the category rail, one filter system (a
 * sidebar, a bottom sheet on narrow screens), the toolbar, the active filters, and the first page
 * of cards; the grid continues by cursor. Everything staff curate — categories, facets and their
 * counts, quick search terms, the compare limit, the LINE account — comes from the API, and any
 * part without data is left out.
 */
export default async function StylesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = await searchParams;
  const variantsView = isVariantsView(raw);
  const query = readParams(raw);
  const [t, list, jar, origin, format, totals, settings, support, config] = await Promise.all([
    getTranslations("styles"),
    // The variants grid reads its own page; the styles list then is not needed.
    variantsView ? null : listStyles(toQuery(query, PAGE_SIZE * (query.page ?? 1))),
    cookies(),
    publicOrigin(),
    getFormat(),
    getLibraryTotals(),
    getStyleLibrarySettings(),
    getSupportChannels(),
    getPublicConfig(),
  ]);
  const words = t as unknown as StylesT;
  const action = getPathname({ href: STYLES_HREF, locale: locale as Locale });
  const quickTerms = (settings?.quickSearch ?? []).map((term) => ({
    label: locale === "en" ? (term.label.en ?? term.label.th) : term.label.th,
    query: term.query,
  }));

  const head = (
    <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] lg:items-end lg:gap-x-12">
      <div>
        <h1 className="text-3xl leading-tight font-bold md:text-[2.5rem]">{t("list.heading")}</h1>
        <p className="text-muted mt-2 max-w-2xl">
          {totals ? (
            <b className="text-fg font-semibold tabular-nums">
              {t("library.totals", { styles: totals.styles, variants: totals.variants })}
            </b>
          ) : null}{" "}
          {t("library.lede")}
        </p>
      </div>
      {variantsView ? null : (
        <LibrarySearch
          params={query}
          action={action}
          quickTerms={quickTerms}
          // C0: the size tab only when the API has styles with a fit range.
          sizeSearch={(list?.meta.sizeSearchStyles ?? 0) > 0}
          wizard={featureFlags.stylesWizard ? <WizardButton params={query} /> : undefined}
        />
      )}
    </header>
  );
  const crumbs = (
    <Breadcrumbs
      label={t("library.breadcrumb")}
      items={[{ label: t("library.home"), href: "/" }, { label: t("library.breadcrumb") }]}
      className="mb-4"
    />
  );

  if (variantsView || !list)
    return (
      <div className="max-w-nav mx-auto px-5 py-6 pb-28 md:px-8 md:py-8 xl:px-12">
        {crumbs}
        {head}
        {totals ? <LibraryViews current="variants" totals={totals} className="mt-5" /> : null}
        <VariantsView params={readVariantParams(raw)} locale={locale} />
        <LibraryLinks />
      </div>
    );

  const signedIn = Boolean(readAccessToken(jar));
  const here = listHref(query, { page: query.page });
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(here)}`;
  const tree = await getCatalogueTree();
  const filtered = isFiltered(query) || !!query.category;
  const categoryCount = new Map(list.facets.category.map((f) => [f.value, f.count]));
  // Every style has one category, and that facet ignores its own filter: its counts sum to the matches.
  const allCount = list.facets.category.reduce((n, f) => n + f.count, 0);
  const total = query.category ? (categoryCount.get(query.category) ?? 0) : allCount;
  const active = activeFilterCount(query);
  const instant = list.facets.pricePath.find((f) => f.value === "instant");
  const sorts = (query.q ? ["relevance", ...SORTS] : [...SORTS]).map((s) => ({ value: s, label: t(`sorts.${s}`) }));

  // Each category's quotation form, for the quick view's "ขอใบเสนอราคา" (D-407).
  const quoteHrefs = Object.fromEntries(
    list.facets.category.map(({ value }) => {
      const found = tree.find((c) => c.code === value || c.types.some((type) => type.code === value));
      return [value, found ? rfqHref(found.code) : null];
    }),
  );

  const swatches = new Map((settings?.materialSwatches ?? []).map((s) => [s.materialClass, s]));
  const panelGroups: PanelGroup[] = groupFacets(list.facets, query).map((group) => ({
    key: group.key,
    title: t(`facets.${group.key}`),
    display: group.key === "useCase" ? "chips" : "list",
    subGroups: group.subGroups.map((sub) => ({
      title: sub.axis ? axisLabel(words, sub.axis) : null,
      items: sub.items.map((item) => {
        const swatch = group.key === "materialClass" ? swatches.get(item.value) : undefined;
        return {
          value: item.value,
          count: item.count,
          selected: item.selected,
          label:
            sub.axis && item.option
              ? valueLabel(words, sub.axis, item.option)
              : facetLabel(words, group.key, item.value),
          ...(swatch && (swatch.colour || swatch.imageUrl)
            ? { swatch: { colour: swatch.colour, imageUrl: swatch.imageUrl } }
            : {}),
        };
      }),
    })),
  }));
  const panel = {
    params: query,
    groups: panelGroups,
    instantCount: instant || query.pricePath === "instant" ? (instant?.count ?? 0) : null,
    resultCount: total,
  };

  const cards = list.data.map((style, index) => {
    const cardText = cardWords(style, locale, words, {
      thb: (a) => format.thb(a),
      number: (n) => format.number(n),
    });
    return {
      code: style.code,
      node: (
        <StyleCardFace
          style={style}
          words={cardText}
          // The first row (up to four columns) is above the fold: eager, high priority (LCP).
          priority={index < 4}
          favourite={
            <FavouriteToggle code={style.code} name={cardText.name} signedIn={signedIn} signInHref={signInHref} />
          }
          compare={<CompareToggle code={style.code} name={cardText.name} />}
        />
      ),
    };
  });
  const urlOf = (code: string, name: string) =>
    `${origin}${getPathname({ href: styleHref(code, name), locale: locale as Locale })}`;

  return (
    <CompareLimitProvider limit={settings?.compareLimit}>
      <div className="max-w-nav mx-auto px-5 py-6 pb-32 md:px-8 md:py-8 xl:px-12">
        <JsonLd
          data={[
            breadcrumbSchema([
              { name: t("library.home"), url: `${origin}${getPathname({ href: "/", locale: locale as Locale })}` },
              { name: t("library.breadcrumb") },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: t("list.heading"),
              numberOfItems: total,
              itemListElement: list.data.map((s, i) => {
                const name = pick(locale, s.nameTh, s.nameEn);
                // A Product only where there is a real offer (an instant style's starting price, D-220).
                return {
                  "@type": "ListItem",
                  position: i + 1,
                  ...(s.startingPrice
                    ? {
                        item: productSchema({
                          name,
                          url: urlOf(s.code, name),
                          images: [],
                          sku: s.code,
                          category: facetLabel(words, "category", s.category),
                          lowPrice: s.startingPrice.unitPrice,
                          currency: s.startingPrice.currency,
                        }),
                      }
                    : { url: urlOf(s.code, name), name }),
                };
              }),
            },
          ]}
        />
        <SearchTracker query={query.q} resultCount={list.data.length === 0 ? 0 : total} />
        {crumbs}
        {head}

        {list.facets.category.length > 1 || query.category ? (
          <CategoryRail
            label={t("library.categories")}
            items={[undefined, ...list.facets.category.map((f) => f.value)].map((category) => {
              const count = category ? categoryCount.get(category) : allCount;
              return {
                category: category ?? null,
                label: category ? facetLabel(words, "category", category) : t("library.allCategories"),
                countLabel: count !== undefined ? t("library.categoryCount", { count }) : undefined,
                href: listHref({ ...query, category, style: undefined }),
                current: query.category === category,
              };
            })}
          />
        ) : null}

        <div className="mt-8 grid gap-x-6 gap-y-8 min-[65rem]:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden min-w-0 min-[65rem]:block" aria-labelledby="library-filters">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="library-filters" className="text-base font-semibold">
                {t("library.filters")}
              </h2>
              {active ? <ClearFiltersButton params={query} /> : null}
            </div>
            <FilterPanel {...panel} />
          </aside>

          <section aria-labelledby="library-results" className="flex min-w-0 flex-col gap-4">
            <LibraryToolbar
              count={
                <>
                  {list.data.length === 0 && !filtered ? null : t("library.results", { count: total })}
                  {query.q ? (
                    <span className="text-muted ms-2 text-base font-normal">
                      {t("library.resultsFor", { q: query.q })}
                    </span>
                  ) : null}
                </>
              }
              filters={<FilterSheet {...panel} active={active} />}
              views={totals ? <LibraryViews current="styles" totals={totals} /> : null}
              // Only when the API gives both the VAT-inclusive and exclusive figure (none does today).
              vatSwitch={
                vatSwitchAvailable(list.data.map((s) => figuresOf(s.startingPrice?.unitPrice))) ? (
                  <VatSwitch label={t("library.vatSwitch")} />
                ) : undefined
              }
              copyLink={<CopyLinkButton params={query} />}
              sort={<SortSelect params={query} sorts={sorts} />}
            />

            <ActiveFilters params={query} words={words} t={t} />

            {list.data.some((s) => s.startingPrice) ? (
              <p className="text-muted -mt-1 text-xs">{t("library.vatIncluded")}</p>
            ) : null}

            {list.data.length === 0 && !filtered ? (
              <StudioStyleLibrary />
            ) : list.data.length === 0 ? (
              <LibraryEmpty
                title={t("library.emptyTitle")}
                body={t("library.emptyBody")}
                clearLabel={t("library.emptyClear")}
                clearHref={listHref({ ...clearFilters(query), q: undefined })}
                requestLabel={t("library.emptyRequest")}
                requestHref={requestHref(signedIn)}
              />
            ) : (
              <StyleResults
                key={here}
                initial={cards}
                nextCursor={list.meta.nextCursor}
                query={toQuery(query, PAGE_SIZE)}
                total={total}
                signedIn={signedIn}
                signInHref={signInHref}
              />
            )}

            <TrustBlock trust={settings?.trust} locale={locale} tolerances={config?.tolerances ?? null} />

            {/* "ไม่เจอแบบที่ต้องการ" (U3.6, D-273): a structure the library lacks, asked of getpack's designers. */}
            <Callout className="mt-6" icon="ruler" title={t("library.notFoundTitle")}>
              <p>{t("library.notFoundBody")}</p>
              <Button asChild variant="secondary" className="mt-3">
                <Link href={requestHref(signedIn)}>{t("library.notFoundCta")}</Link>
              </Button>
            </Callout>
          </section>
        </div>
        {featureFlags.packagingLandings ? <PackagingLinks t={t} /> : null}
        <LibraryLinks />
        <CompareTray />
        <QuickViewHost
          quoteHrefs={quoteHrefs}
          signedIn={signedIn}
          taxInvoiceNote={
            settings?.trust.taxInvoiceNote
              ? locale === "en"
                ? (settings.trust.taxInvoiceNote.en ?? settings.trust.taxInvoiceNote.th)
                : settings.trust.taxInvoiceNote.th
              : // C0b: the decision-backed default (D-010, D-125) until staff enter their own wording.
                t("library.trustTaxInvoiceDefault")
          }
        />
        <LineFloat apiLineOaId={support?.lineOaId} />
      </div>
    </CompareLimitProvider>
  );
}

/** "เลือกตามการใช้งาน" (C0): the packaging landing pages, under their flag. */
function PackagingLinks({ t }: { t: Awaited<ReturnType<typeof getTranslations<"styles">>> }) {
  return (
    <section aria-labelledby="library-landings" className="mt-12">
      <h2 id="library-landings" className="text-lg font-semibold">
        {t("library.landingTitle")}
      </h2>
      <p className="text-muted mb-3 text-sm">{t("library.landingBody")}</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PACKAGING_LANDINGS.map((landing) => (
          <li key={landing.slug}>
            <Link
              href={packagingHref(landing.slug)}
              className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-card block border px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-2"
            >
              {t(`useCasePages.${landing.useCase}.title` as never)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const requestHref = (signedIn: boolean) =>
  signedIn
    ? "/account/structural-requests/new"
    : `/sign-in?returnTo=${encodeURIComponent("/account/structural-requests/new")}`;

/**
 * The filters that are on, each a chip that removes it, and "ล้างทั้งหมด" — above the results, so
 * what narrows them is never hidden in a closed panel or a sheet.
 */
function ActiveFilters({
  params,
  words,
  t,
}: {
  params: ListParams;
  words: StylesT;
  t: Awaited<ReturnType<typeof getTranslations<"styles">>>;
}) {
  const chips: { key: string; label: string; href: string }[] = [];
  const size = cmOfSize(params.size);
  if (size)
    chips.push({
      key: "size",
      label: t("library.sizeChip", { ...size }),
      href: listHref({ ...params, size: undefined, style: undefined }),
    });
  if (params.wizard)
    chips.push({
      key: "wiz",
      label: t("library.wizardChip", {
        answers: wizardSummary(params.wizard, (key) => t(key as never)) || t("library.wizardAll"),
      }),
      href: listHref({ ...params, wizard: undefined, style: undefined }),
    });
  if (params.pricePath)
    chips.push({
      key: "price",
      label:
        params.pricePath === "instant" ? t("library.instantOnly") : facetLabel(words, "pricePath", params.pricePath),
      href: listHref({ ...params, pricePath: undefined, style: undefined }),
    });
  for (const key of FACET_KEYS)
    for (const value of params[key])
      chips.push({
        key: `${key}:${value}`,
        label: facetLabel(words, key, value),
        href: listHref({ ...toggleValue(params, key, value), style: undefined }),
      });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="sr-only">{t("library.activeFilters")}</h3>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              replace
              scroll={false}
              aria-label={t("library.removeFilter", { label: chip.label })}
              className="border-primary/40 bg-primary-subtle text-primary-subtle-fg focus-visible:ring-focus-ring rounded-control inline-flex min-h-8 items-center gap-1.5 border px-2.5 text-sm outline-none focus-visible:ring-2"
            >
              {chip.label}
              <Icon name="close" size={14} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={listHref({ ...clearFilters(params), category: params.category })}
        replace
        scroll={false}
        className="text-muted hover:text-fg focus-visible:ring-focus-ring rounded-control text-sm underline underline-offset-2 outline-none focus-visible:ring-2"
      >
        {t("library.clearAll")}
      </Link>
    </div>
  );
}
