import type { Metadata } from "next";
import { defaultsOf, presetsOf, RECIPES } from "@packio/dieline";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getCatalogueTree, getStyle, type StyleDetail } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { configureHref, rfqHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { codeOfSlug, DIELINE_FRAGMENT, styleHref, styleSlug, STYLES_HREF } from "@/features/customer/styles/paths";
import { studioHref as studioEntry } from "@/features/customer/studio/paths";
import { StyleDetailActions } from "@/features/customer/styles/StyleDetailActions";
import { VariantPicker } from "@/features/customer/styles/VariantPicker";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { readAccessToken } from "@/lib/auth/session";
import { breadcrumbSchema, localePath, publicOrigin } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Params = Promise<{ locale: string; slug: string }>;

const nameIn = (style: StyleDetail, locale: string) => pick(locale, style.nameTh, style.nameEn);

/** Each language's URL of the style: its code and its name in that language (U3.5 §5). */
function languages(origin: string, style: StyleDetail) {
  const url = (locale: Locale) => `${origin}${localePath(styleHref(style.code, nameIn(style, locale)), locale)}`;
  return {
    ...(Object.fromEntries(routing.locales.map((l) => [l, url(l)])) as Record<Locale, string>),
    "x-default": url(routing.defaultLocale),
  };
}

/**
 * The studio for this style (U4.1): the engine's recipe of the base, at its first starting size, on
 * the product the style is priced through — or `null` when the engine draws no recipe of the base.
 */
function studioHref(code: string, productSlug: string): string | null {
  const recipe = RECIPES.find((candidate) => candidate.base === code);
  if (!recipe) return null;
  const values = { ...defaultsOf(recipe), ...presetsOf(recipe)[0]?.values };
  const [l, w, h] = [values.length, values.width, values.height];
  if (typeof l !== "number" || typeof w !== "number" || typeof h !== "number") return null;
  return studioEntry({ product: productSlug, style: recipe.id, dims: { l, w, h }, step: "box" });
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
export default async function StylePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const style = await load(slug);
  if (!style) notFound();
  const name = nameIn(style, locale);
  // The code decides the page; a stale or other-language name is sent to this language's URL.
  if (decodeURIComponent(slug) !== styleSlug(style.code, name))
    redirect({ href: styleHref(style.code, name), locale: locale as Locale });

  const [t, tree, jar, origin, format] = await Promise.all([
    getTranslations("styles"),
    getCatalogueTree(),
    cookies(),
    publicOrigin(),
    getFormat(),
  ]);
  const words = t as unknown as StylesT;
  const signedIn = Boolean(readAccessToken(jar));
  const href = styleHref(style.code, name);
  const url = `${origin}${getPathname({ href, locale: locale as Locale })}`;
  const rfqCategory = tree.find(
    (c) => c.code === style.category || c.types.some((type) => type.code === style.category),
  );
  const range = (min: number | null, max: number | null) =>
    min !== null && max !== null ? t("detail.range", { min: format.number(min), max: format.number(max) }) : "none";

  const facts = [
    { term: t("detail.code"), description: <span className="font-mono">{style.code}</span> },
    ...(style.referenceCode ? [{ term: t("detail.internationalName"), description: style.referenceCode }] : []),
    { term: t("facets.category"), description: facetLabel(words, "category", style.category) },
    { term: t("facets.family"), description: facetLabel(words, "family", style.family) },
    {
      term: t("detail.price"),
      description: (
        <Badge tone={style.pricePath === "instant" ? "success" : "info"}>{t(`pricePaths.${style.pricePath}`)}</Badge>
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
    ...(style.partnersCount !== null
      ? [{ term: t("detail.makers"), description: t("detail.partners", { count: style.partnersCount }) }]
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
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 md:py-12">
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
        <StyleDetailActions
          code={style.code}
          signedIn={signedIn}
          signInHref={`/sign-in?returnTo=${encodeURIComponent(href)}`}
        />
      </header>

      <div className="mt-8">
        <VariantPicker
          style={style}
          name={name}
          instantActions={
            style.startingPrice ? (
              <>
                <Button asChild>
                  <Link href={configureHref(style.startingPrice.catalogProductSlug)}>{t("detail.configure")}</Link>
                </Button>
                {studioHref(style.code, style.startingPrice.catalogProductSlug) ? (
                  <Button asChild variant="secondary" iconStart="sparkles">
                    <Link href={studioHref(style.code, style.startingPrice.catalogProductSlug)!}>
                      {t("detail.designInStudio")}
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <Button asChild variant="secondary">
                <Link href={rfqCategory ? rfqHref(rfqCategory.code) : "/contact"}>{t("detail.requestQuote")}</Link>
              </Button>
            )
          }
          dieline={{
            sizeRanges: style.sizeRanges,
            signedIn,
            signInHref: `/sign-in?returnTo=${encodeURIComponent(`${href}#${DIELINE_FRAGMENT}`)}`,
            orderHref: style.startingPrice ? configureHref(style.startingPrice.catalogProductSlug) : null,
          }}
          rfqActions={
            <Button asChild variant="secondary">
              <Link href={rfqCategory ? rfqHref(rfqCategory.code) : "/contact"}>{t("detail.requestQuote")}</Link>
            </Button>
          }
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
    </div>
  );
}
