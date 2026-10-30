import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  getCatalogueTree,
  getStyle,
  getStyleLibrarySettings,
  type StyleDetail,
} from "@/features/customer/catalog/api.server";
import { CompareLimitProvider } from "@/features/customer/styles/compare-store";
import { pick } from "@/features/customer/catalog/localize";
import { configureHref, rfqHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { axisLabel, facetLabel, valueLabel, type StylesT } from "@/features/customer/styles/labels";
import {
  codeOfSlug,
  DIELINE_FRAGMENT,
  styleHref,
  styleSlug,
  STYLES_HREF,
  styleTopicHref,
} from "@/features/customer/styles/paths";
import { shortName, topicHeading, topicsOf } from "@/features/customer/styles/topics";
import { optionSummary } from "@/features/customer/styles/VariantCardFace";
import { StyleDetailActions } from "@/features/customer/styles/StyleDetailActions";
import { VariantPicker } from "@/features/customer/styles/VariantPicker";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { breadcrumbSchema, localePath, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { HubSection, HubSectionStack } from "@/features/customer/products/HubSections";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The fragment of the variant picker, where a chosen variant's link lands. */
const PICKER = "options";

const nameIn = (style: StyleDetail, locale: string) => pick(locale, style.nameTh, style.nameEn);

/** Each language's URL of the style: its code and its name in that language (U3.5 §5). */
function languages(origin: string, style: StyleDetail) {
  const url = (locale: Locale) => `${origin}${localePath(styleHref(style.code, nameIn(style, locale)), locale)}`;
  return {
    ...(Object.fromEntries(routing.locales.map((l) => [l, url(l)])) as Record<Locale, string>),
    "x-default": url(routing.defaultLocale),
  };
}

async function load(slug: string) {
  const code = codeOfSlug(slug);
  return code ? getStyle(code) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, locale } = await params;
  const [t, style, origin] = await Promise.all([getTranslations("styles"), load(slug), publicOrigin()]);
  if (!style) return {};
  const name = nameIn(style, locale);
  const alternates = languages(origin, style);
  return {
    title: t("meta.detailTitle", { name, code: style.code }),
    description: t("meta.detailDescription", { name, code: style.code, count: style.variantCount }),
    alternates: { canonical: alternates[locale as Locale], languages: alternates },
  };
}

/**
 * One base structure (U3.5 §2, §3, §5): one indexable page per style with all its variants — the
 * code, the verified international code (D-211), instant or quotation, the sizes per material and
 * the API's "starting from" — and the variant picker with its 3D model on request.
 */
export default async function StylePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const style = await load(slug);
  if (!style) notFound();
  const name = nameIn(style, locale);
  // A card of the variants grid opens its style with that variant chosen (D-410).
  const query = await searchParams;
  const v = query["v"];
  const chosen = style.variants.find((x) => x.code === (Array.isArray(v) ? v[0] : v))?.code;
  // A product page's "ดาวน์โหลดแบบกล่อง" brings its default size (mm, inside) for the dieline form.
  const one = (key: string) => (Array.isArray(query[key]) ? query[key][0] : query[key]);
  const [l, w, h] = [one("l"), one("w"), one("h")];
  const initialSize =
    l && w && h && [l, w, h].every((value) => /^\d{1,4}(\.\d)?$/.test(value)) ? { l, w, h } : undefined;
  const sizeQuery = initialSize ? `&l=${initialSize.l}&w=${initialSize.w}&h=${initialSize.h}` : "";
  // The code decides the page; a stale or other-language name is sent to this language's URL.
  if (decodeURIComponent(slug) !== styleSlug(style.code, name))
    redirect({
      href: `${styleHref(style.code, name)}${chosen ? `?v=${encodeURIComponent(chosen)}${sizeQuery}` : ""}`,
      locale: locale as Locale,
    });

  const [t, tree, jar, origin, format, settings] = await Promise.all([
    getTranslations("styles"),
    getCatalogueTree(),
    cookies(),
    publicOrigin(),
    getFormat(),
    getStyleLibrarySettings(),
  ]);
  const words = t as unknown as StylesT;
  const signedIn = Boolean(readAccessToken(jar));
  const href = styleHref(style.code, name);
  const short = shortName(name);
  const topics = topicsOf(style.options);
  // "กล่องฝาเสียบมีหน้าต่าง" / "Tuck-end carton with a window".
  const topicLabel = (id: string) => topicHeading(name, t(`topics.${id}.phrase`), locale);
  const url = `${origin}${getPathname({ href, locale: locale as Locale })}`;
  const rfqCategory = tree.find(
    (c) => c.code === style.category || c.types.some((type) => type.code === style.category),
  );
  // The quotation form of the style's product type (D-407), the variant added by the picker.
  const quoteHref = rfqCategory
    ? `${rfqHref(rfqCategory.code)}${style.productTypeCode ? `?type=${style.productTypeCode}` : ""}`
    : null;
  const range = (min: number | null, max: number | null) =>
    // Whole millimetres inside the rule (a derived minimum like 23.554 reads as 24).
    min !== null && max !== null
      ? t("detail.range", { min: format.number(Math.ceil(min)), max: format.number(Math.floor(max)) })
      : "none";

  // The construction in the page's language: Thai only from `descriptionTh` — `construction` is the API's English
  // engineering line, so a Thai page without a Thai description shows none rather than English (API data gap).
  const construction =
    locale === "en" ? (style.descriptionEn ?? style.construction ?? null) : (style.descriptionTh ?? null);
  const facts = [
    { term: t("detail.code"), description: <span className="tabular-nums">{style.code}</span> },
    ...(style.referenceCode ? [{ term: t("detail.internationalName"), description: style.referenceCode }] : []),
    { term: t("facets.category"), description: facetLabel(words, "category", style.category) },
    { term: t("facets.family"), description: facetLabel(words, "family", style.family) },
    {
      term: t("detail.price"),
      description: (
        <Badge
          tone={style.pricePath === "instant" ? "instant" : "info"}
          icon={style.pricePath === "instant" ? "zap" : undefined}
        >
          {t(`pricePaths.${style.pricePath}`)}
        </Badge>
      ),
    },
    ...(style.startingPrice
      ? [
          {
            term: t("compare.rows.price"),
            description: `${t("card.from", { price: format.thb(style.startingPrice.unitPrice) })} ${t(
              "card.fromQuantity",
              {
                quantity: format.number(style.startingPrice.quantity),
              },
            )}`,
          },
        ]
      : []),
    ...(style.leadTime
      ? [
          {
            term: t("compare.rows.leadTime"),
            description: t("detail.leadTime", { min: style.leadTime.minDays, max: style.leadTime.maxDays }),
          },
        ]
      : []),
    ...(style.useCases.length
      ? [
          {
            term: t("detail.useCases"),
            description: style.useCases.map((u) => facetLabel(words, "useCase", u)).join(", "),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
      <JsonLd
        data={[
          breadcrumbSchema([
            {
              name: t("breadcrumbs.library"),
              url: `${origin}${getPathname({ href: STYLES_HREF, locale: locale as Locale })}`,
            },
            { name },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name,
            alternateName: style.code,
            url,
            ...(style.descriptionTh || style.descriptionEn
              ? { description: pick(locale, style.descriptionTh ?? "", style.descriptionEn ?? "") }
              : {}),
            genre: facetLabel(words, "category", style.category),
          },
        ]}
      />
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: name }]}
      />
      {/* Project A: the picture beside one configuration panel that starts with the style's head. */}
      <div className="mt-4 scroll-mt-24" id={PICKER}>
        <VariantPicker
          key={chosen ?? "first"}
          style={style}
          name={name}
          initialCode={chosen}
          head={
            <header className="flex flex-col gap-2">
              <p className="text-muted flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="tabular-nums">{style.code}</span> · {facetLabel(words, "category", style.category)}
                </span>
                <span className="bg-primary-subtle text-primary-subtle-fg rounded-control px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                  {t("card.variants", { count: style.variantCount })}
                </span>
              </p>
              <h1 className="text-[1.625rem] leading-[1.2] font-semibold tracking-tight text-balance md:text-[2rem]">
                {name}
              </h1>
              <CompareLimitProvider limit={settings?.compareLimit}>
                <StyleDetailActions
                  code={style.code}
                  signedIn={signedIn}
                  signInHref={`/sign-in?returnTo=${encodeURIComponent(href)}`}
                />
              </CompareLimitProvider>
            </header>
          }
          besidePanel={
            topics.length ? (
              <section
                aria-labelledby="style-topics"
                className="border-border bg-surface rounded-panel border p-5 md:p-6"
              >
                <h2 id="style-topics" className="mb-3 text-base font-semibold">
                  {t("detail.optionPages", { name: short })}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={styleTopicHref(style.code, name, topic.id)}
                        className="border-border bg-surface hover:border-primary focus-visible:ring-focus-ring rounded-control inline-flex min-h-10 items-center border px-3.5 text-sm outline-none focus-visible:ring-2"
                      >
                        {topicLabel(topic.id)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : undefined
          }
          below={
            <>
              <section
                aria-labelledby="style-facts"
                className="border-border bg-surface rounded-panel border p-5 md:p-6"
              >
                <h2 id="style-facts" className="mb-2 text-lg font-semibold">
                  {t("detail.construction")}
                </h2>
                {construction ? <p className="text-muted mb-4 text-sm">{construction}</p> : null}
                <DescriptionList items={facts} columns={1} />
              </section>
              <section
                aria-labelledby="style-sizes"
                className="border-border bg-surface rounded-panel border p-5 md:p-6"
              >
                <h2 id="style-sizes" className="mb-3 text-lg font-semibold">
                  {t("detail.sizes")}
                </h2>
                <ul className="divide-border m-0 flex list-none flex-col divide-y p-0 text-sm">
                  {style.sizeRanges.map((r) => (
                    <li key={r.materialClass} className="py-2.5 tabular-nums first:pt-0 last:pb-0">
                      {t("detail.size", {
                        material: facetLabel(words, "materialClass", r.materialClass),
                        l: range(r.minLMm, r.maxLMm),
                        w: range(r.minWMm, r.maxWMm),
                        h: range(r.minHMm, r.maxHMm),
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          }
          actions={{
            productSlug: style.startingPrice?.catalogProductSlug ?? null,
            rfqHref: quoteHref,
            quoteResponseDays: style.quoteResponseBusinessDays,
          }}
          dieline={{
            sizeRanges: style.sizeRanges,
            signedIn,
            signInHref: `/sign-in?returnTo=${encodeURIComponent(`${href}#${DIELINE_FRAGMENT}`)}`,
            orderHref: style.startingPrice ? configureHref(style.startingPrice.catalogProductSlug) : null,
            initialSize,
          }}
        />
      </div>

      {/* D-410: every option in words and every variant code in the page's text — what a search for a
          variant finds; the variants themselves are not pages. Project A: folded to their headings below the
          task, still in the HTML for search. */}
      <HubSectionStack className="mt-12">
        <HubSection
          id="style-all-options"
          collapsible
          title={t("detail.allOptions")}
          lede={t("detail.allOptionsIntro", { name, axes: style.axes.length, count: style.variantCount })}
        >
          {style.axes.length ? (
            <DescriptionList
              columns={1}
              items={style.axes.map((axis) => ({
                term: axisLabel(words, axis.axis),
                description: axis.values.map((value) => valueLabel(words, axis.axis, value)).join(", "),
              }))}
            />
          ) : null}
        </HubSection>
        {style.variants.length > 1 ? (
          <HubSection
            id="style-all-variants"
            collapsible
            title={t("detail.allVariants")}
            lede={t("detail.allVariantsIntro")}
          >
            <ul className="divide-border m-0 grid list-none gap-x-8 p-0 text-sm sm:grid-cols-2">
              {style.variants.map((variant) => (
                <li key={variant.code} className="border-border min-w-0 border-b py-2">
                  <Link
                    href={`${href}?v=${encodeURIComponent(variant.code)}#${PICKER}`}
                    rel="nofollow"
                    scroll={false}
                    className="text-primary font-medium tabular-nums underline-offset-2 hover:underline"
                  >
                    {variant.code}
                  </Link>{" "}
                  <span className="text-muted">{optionSummary(words, variant.options)}</span>
                </li>
              ))}
            </ul>
          </HubSection>
        ) : null}
      </HubSectionStack>
    </div>
  );
}
