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
import { shortName, topicsOf } from "@/features/customer/styles/topics";
import { optionSummary } from "@/features/customer/styles/VariantCardFace";
import { StyleDetailActions } from "@/features/customer/styles/StyleDetailActions";
import { VariantPicker } from "@/features/customer/styles/VariantPicker";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { breadcrumbSchema, localePath, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
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
  const v = (await searchParams)["v"];
  const chosen = style.variants.find((x) => x.code === (Array.isArray(v) ? v[0] : v))?.code;
  // The code decides the page; a stale or other-language name is sent to this language's URL.
  if (decodeURIComponent(slug) !== styleSlug(style.code, name))
    redirect({
      href: `${styleHref(style.code, name)}${chosen ? `?v=${encodeURIComponent(chosen)}` : ""}`,
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
  const topicLabel = (id: string) => `${short}${locale === "en" ? " " : ""}${t(`topics.${id}.phrase`)}`;
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

  const facts = [
    { term: t("detail.code"), description: <span className="font-mono">{style.code}</span> },
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
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
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
      <header className="mt-4 flex flex-col gap-3">
        <p className="text-muted text-sm">
          <span className="font-mono">{style.code}</span> · {facetLabel(words, "category", style.category)}
        </p>
        <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
        <p className="text-muted">{t("card.variants", { count: style.variantCount })}</p>
        <CompareLimitProvider limit={settings?.compareLimit}>
          <StyleDetailActions
            code={style.code}
            signedIn={signedIn}
            signInHref={`/sign-in?returnTo=${encodeURIComponent(href)}`}
          />
        </CompareLimitProvider>
      </header>

      <div className="mt-8 scroll-mt-24" id={PICKER}>
        <VariantPicker
          key={chosen ?? "first"}
          style={style}
          name={name}
          initialCode={chosen}
          actions={{ productSlug: style.startingPrice?.catalogProductSlug ?? null, rfqHref: quoteHref }}
          dieline={{
            sizeRanges: style.sizeRanges,
            signedIn,
            signInHref: `/sign-in?returnTo=${encodeURIComponent(`${href}#${DIELINE_FRAGMENT}`)}`,
            orderHref: style.startingPrice ? configureHref(style.startingPrice.catalogProductSlug) : null,
          }}
        />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="style-facts">
          <h2 id="style-facts" className="mb-3 text-lg font-semibold">
            {t("detail.construction")}
          </h2>
          <p className="text-muted mb-4 text-sm">
            {pick(locale, style.descriptionTh ?? style.construction, style.descriptionEn ?? style.construction)}
          </p>
          <DescriptionList items={facts} columns={1} />
        </section>
        <section aria-labelledby="style-sizes">
          <h2 id="style-sizes" className="mb-3 text-lg font-semibold">
            {t("detail.sizes")}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {style.sizeRanges.map((r) => (
              <li key={r.materialClass} className="tabular-nums">
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
      </div>

      {/* D-410: every option in words and every variant code in the page's text — what a search for a
          variant finds; the variants themselves are not pages. */}
      <section aria-labelledby="style-all-options" className="mt-12">
        <h2 id="style-all-options" className="mb-2 text-lg font-semibold">
          {t("detail.allOptions")}
        </h2>
        <p className="text-muted mb-4 text-sm">
          {t("detail.allOptionsIntro", { name, axes: style.axes.length, count: style.variantCount })}
        </p>
        {style.axes.length ? (
          <DescriptionList
            columns={1}
            items={style.axes.map((axis) => ({
              term: axisLabel(words, axis.axis),
              description: axis.values.map((value) => valueLabel(words, axis.axis, value)).join(", "),
            }))}
          />
        ) : null}
      </section>

      {topics.length ? (
        <section aria-labelledby="style-topics" className="mt-10">
          <h2 id="style-topics" className="mb-3 text-lg font-semibold">
            {t("detail.optionPages", { name: short })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={styleTopicHref(style.code, name, topic.id)}
                  className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-control inline-block border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
                >
                  {topicLabel(topic.id)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {style.variants.length > 1 ? (
        <section aria-labelledby="style-all-variants" className="mt-10">
          <h2 id="style-all-variants" className="mb-2 text-lg font-semibold">
            {t("detail.allVariants")}
          </h2>
          <p className="text-muted mb-3 text-sm">{t("detail.allVariantsIntro")}</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {style.variants.map((variant) => (
              <li key={variant.code} className="min-w-0">
                <Link
                  href={`${href}?v=${encodeURIComponent(variant.code)}#${PICKER}`}
                  rel="nofollow"
                  scroll={false}
                  className="text-primary font-mono underline-offset-2 hover:underline"
                >
                  {variant.code}
                </Link>{" "}
                <span className="text-muted">{optionSummary(words, variant.options)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
