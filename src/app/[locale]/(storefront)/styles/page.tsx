import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { getLibraryTotals, listStyles } from "@/features/customer/catalog/api.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { CompareTray } from "@/features/customer/styles/CompareTray";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { styleHref, STYLES_HREF } from "@/features/customer/styles/paths";
import {
  FILTER_KEYS,
  isFiltered,
  listHref,
  readParams,
  SORTS,
  toQuery,
  type FilterKey,
} from "@/features/customer/styles/query";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import { LibraryViews } from "@/features/customer/styles/LibraryViews";
import { StyleResults } from "@/features/customer/styles/StyleResults";
import { isVariantsView, readVariantParams } from "@/features/customer/styles/variant-query";
import { VariantsView } from "@/features/customer/styles/VariantsView";
import { StudioStyleLibrary } from "@/features/customer/styles/StudioStyleLibrary";
import { StyleCardActions } from "@/features/customer/styles/StyleCardActions";
import { cardWords, StyleCardFace } from "@/features/customer/styles/StyleCardFace";
import { getFormat } from "@/features/shared/format/server";
import { pick } from "@/features/customer/catalog/localize";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

const PER_PAGE = 24;
/** The facets in the sidebar, in this order; `category` is the tabs above the grid. */
const SIDEBAR: FilterKey[] = ["closure", "feature", "useCase", "materialClass", "pricePath", "family"];
const CATEGORIES = ["folding_carton", "corrugated", "rigid", "flexible", "label", "tag_sleeve", "insert"];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [t, locale, origin, raw] = await Promise.all([
    getTranslations("styles"),
    getLocale(),
    publicOrigin(),
    searchParams,
  ]);
  const params = readParams(raw);
  const { canonical, languages } = alternateUrls(origin, STYLES_HREF, locale as Locale);
  return {
    title: t("meta.listTitle"),
    description: t("meta.listDescription"),
    alternates: { canonical, languages },
    // A filtered or searched view — and the variants grid, whose cards are not pages (D-410) — is a
    // view of this page, not a page of its own (U3.5 §5).
    ...(isFiltered(params) || isVariantsView(raw) ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * The style library (U3.5): every published base structure, by category, with the API's facets,
 * a Thai / English search (synonyms and typos are the API's), an order, and save and compare on
 * each card. The page is the list's first page; the grid continues it by cursor.
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
  const [t, list, jar, origin, format, totals] = await Promise.all([
    getTranslations("styles"),
    // The variants grid reads its own page; the styles list then is not needed.
    variantsView ? null : listStyles(toQuery(query, PER_PAGE)),
    cookies(),
    publicOrigin(),
    getFormat(),
    getLibraryTotals(),
  ]);
  const header = (
    <header className="max-w-3xl">
      <h1 className="text-3xl font-bold md:text-4xl">
        {query.q && !variantsView ? t("list.resultsFor", { q: query.q }) : t("list.heading")}
      </h1>
      {totals && !query.q ? (
        <p className="text-primary mt-2 text-xl font-semibold md:text-2xl">
          {t("claim.headline", { count: totals.variants })}
        </p>
      ) : null}
      {!query.q ? <p className="text-muted mt-2">{variantsView ? t("list.variantsIntro") : t("list.intro")}</p> : null}
      {totals ? <LibraryViews current={variantsView ? "variants" : "styles"} totals={totals} /> : null}
    </header>
  );

  if (variantsView || !list)
    return (
      <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
        {header}
        <VariantsView params={readVariantParams(raw)} locale={locale} />
        <LibraryLinks />
      </div>
    );

  const words = t as unknown as StylesT;
  const signedIn = Boolean(readAccessToken(jar));
  const here = listHref(query);
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(here)}`;
  const action = getPathname({ href: STYLES_HREF, locale: locale as Locale });
  const sort = query.sort ?? (query.q ? "relevance" : "popular");
  const sorts = query.q ? ["relevance", ...SORTS] : [...SORTS];
  const filtered = FILTER_KEYS.some((k) => query[k]) || !!query.q;
  const categoryCount = new Map(list.facets.category.map((f) => [f.value, f.count]));
  // Every style has one category, and that facet ignores its own filter: its counts sum to the matches.
  const total = query.category
    ? (categoryCount.get(query.category) ?? 0)
    : list.facets.category.reduce((n, f) => n + f.count, 0);

  return (
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t("list.heading"),
          itemListElement: list.data.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${origin}${getPathname({ href: styleHref(s.code, pick(locale, s.nameTh, s.nameEn)), locale: locale as Locale })}`,
            name: pick(locale, s.nameTh, s.nameEn),
          })),
        }}
      />
      {header}

      <nav aria-label={t("list.categories")} className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-1">
          {[undefined, ...CATEGORIES].map((category) => {
            const current = query.category === category;
            const count = category ? categoryCount.get(category) : undefined;
            return (
              <li key={category ?? "all"}>
                <Link
                  href={listHref(query, { category })}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control block px-3 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2",
                    current ? "bg-primary text-primary-fg" : "hover:bg-bg-subtle",
                  )}
                >
                  {category ? facetLabel(words, "category", category) : t("list.allCategories")}
                  {count !== undefined ? (
                    <span className="ms-1 tabular-nums opacity-80">{t("list.count", { count })}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-[15rem_1fr]">
        <aside className="flex min-w-0 flex-col gap-6" aria-label={t("list.filters")}>
          <form action={action} role="search" className="flex gap-2">
            {FILTER_KEYS.filter((k) => query[k]).map((k) => (
              <input key={k} type="hidden" name={k} value={query[k]} />
            ))}
            <label className="sr-only" htmlFor="styles-q">
              {t("list.searchLabel")}
            </label>
            <Input
              id="styles-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder={t("list.searchPlaceholder")}
            />
            <Button type="submit" variant="secondary">
              {t("list.searchSubmit")}
            </Button>
          </form>

          {SIDEBAR.map((facet) => {
            const values = list.facets[facet];
            if (values.length === 0) return null;
            return (
              <section key={facet} aria-labelledby={`facet-${facet}`}>
                <h2 id={`facet-${facet}`} className="mb-2 text-sm font-medium">
                  {t(`facets.${facet}`)}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {values.slice(0, 12).map(({ value, count }) => {
                    const on = query[facet] === value;
                    return (
                      <li key={value}>
                        <Link
                          href={listHref(query, { [facet]: on ? undefined : value })}
                          aria-current={on ? "true" : undefined}
                          rel="nofollow"
                          className={cn(
                            "focus-visible:ring-focus-ring flex justify-between gap-2 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2",
                            on ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                          )}
                        >
                          <span>{facetLabel(words, facet, value)}</span>
                          <span className="text-muted tabular-nums">{count}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted text-sm" aria-live="polite">
              {/* With nothing published yet the studio's own styles stand in, so "0 แบบ" would be wrong. */}
              {list.data.length === 0 && !filtered ? null : t("list.results", { count: total })}
              {filtered ? (
                <>
                  {" "}
                  <Link href={STYLES_HREF} className="text-primary underline underline-offset-2">
                    {t("list.clear")}
                  </Link>
                </>
              ) : null}
            </p>
            <nav aria-label={t("list.sort")} className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-muted me-1">{t("list.sort")}</span>
              {sorts.map((s) => (
                <Link
                  key={s}
                  href={listHref(query, { sort: s === "popular" && !query.q ? undefined : s })}
                  aria-current={s === sort ? "true" : undefined}
                  rel="nofollow"
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control px-2.5 py-1 outline-none focus-visible:ring-2",
                    s === sort ? "bg-primary-subtle text-primary-subtle-fg font-medium" : "hover:bg-bg-subtle",
                  )}
                >
                  {t(`sorts.${s}`)}
                </Link>
              ))}
            </nav>
          </div>

          {list.data.length === 0 && !filtered ? (
            <StudioStyleLibrary />
          ) : list.data.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("list.emptyTitle")}
              description={t("list.emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <Link href={STYLES_HREF}>{t("list.clear")}</Link>
                </Button>
              }
            />
          ) : (
            <StyleResults
              key={here}
              initial={list.data.map((style, index) => {
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
                      priority={index < 2}
                      actions={
                        <StyleCardActions
                          code={style.code}
                          name={cardText.name}
                          signedIn={signedIn}
                          signInHref={signInHref}
                        />
                      }
                    />
                  ),
                };
              })}
              nextCursor={list.meta.nextCursor}
              query={toQuery(query, PER_PAGE)}
              signedIn={signedIn}
              signInHref={signInHref}
            />
          )}
          {/* "ไม่เจอแบบที่ต้องการ" (U3.6, D-273): a structure the library lacks, asked of getpack's designers. */}
          <Callout className="mt-8" icon="ruler" title={t("request.ctaTitle")}>
            <p>{t("request.ctaBody")}</p>
            <Button asChild variant="secondary" className="mt-3">
              <Link
                href={
                  signedIn
                    ? "/account/structural-requests/new"
                    : `/sign-in?returnTo=${encodeURIComponent("/account/structural-requests/new")}`
                }
              >
                {t("request.cta")}
              </Link>
            </Button>
          </Callout>
        </div>
      </div>
      <LibraryLinks />
      <CompareTray />
    </div>
  );
}
