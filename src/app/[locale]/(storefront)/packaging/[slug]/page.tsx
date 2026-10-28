import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listStyles } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { facetLabel, type StylesT } from "@/features/customer/styles/labels";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import {
  isLandingPublished,
  landingOfSlug,
  PACKAGING_LANDINGS,
  packagingHref,
  type PackagingLanding,
} from "@/features/customer/styles/packaging-landings";
import { styleHref, STYLES_HREF } from "@/features/customer/styles/paths";
import { StyleCardGrid } from "@/features/customer/styles/StyleCardGrid";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { featureFlags } from "@/lib/env/server";
import { alternateUrls, breadcrumbSchema, publicOrigin } from "@/lib/seo";
import { faqPageSchema, productSchema } from "@/lib/seo/structured-data";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type Params = Promise<{ locale: string; slug: string }>;

/** Static at build time and refreshed every 15 minutes (the catalogue's own data lifetime). */
export const revalidate = 900;

export function generateStaticParams() {
  return featureFlags.packagingLandings ? PACKAGING_LANDINGS.map(({ slug }) => ({ slug })) : [];
}

async function load(
  slug: string,
): Promise<{ landing: PackagingLanding; styles: Awaited<ReturnType<typeof listStyles>>["data"] } | null> {
  const landing = featureFlags.packagingLandings ? landingOfSlug(slug) : undefined;
  if (!landing) return null;
  const list = await listStyles({ useCase: landing.useCase, limit: 100 });
  return list.data.length ? { landing, styles: list.data } : null;
}

/** The approved copy of a page, when there is any (`packagingPages.<slug>`): never invented here. */
async function copyOf(slug: string) {
  const t = await getTranslations("styles");
  const has = (key: string) => t.has(`packagingPages.${slug}.${key}` as never);
  const intro = has("intro") ? (t(`packagingPages.${slug}.intro` as never) as string) : null;
  const faq = has("faq")
    ? (t.raw(`packagingPages.${slug}.faq` as never) as { question: string; answer: string }[])
    : [];
  return { intro, faq: Array.isArray(faq) ? faq : [] };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, locale } = await params;
  const [t, found, origin] = await Promise.all([getTranslations("styles"), load(slug), publicOrigin()]);
  if (!found) return {};
  const title = t(`useCasePages.${found.landing.useCase}.title`);
  const { canonical, languages } = alternateUrls(origin, packagingHref(slug), locale as Locale);
  return {
    title: t("useCasePage.metaTitle", { title }),
    description: t("useCasePage.metaDescription", { title, intro: t(`useCasePages.${found.landing.useCase}.intro`) }),
    alternates: { canonical, languages },
    // C0b: draft copy (not yet approved by the owner) is reviewable with the flag on, never indexed.
    ...(isLandingPublished(slug) ? {} : { robots: { index: false, follow: true } }),
  };
}

/**
 * A packaging landing page (C0): the use case's title and short lede, the approved answer-first
 * intro and FAQ when they exist (slots left out otherwise — OPEN QUESTION in the C0 report), and
 * the same grid as the library. JSON-LD: BreadcrumbList, ItemList of Products (an offer only for a
 * style with a real starting price, D-220) and FAQPage only with an approved FAQ.
 */
export default async function PackagingLandingPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const found = await load(slug);
  if (!found) notFound();
  const [t, origin, copy] = await Promise.all([getTranslations("styles"), publicOrigin(), copyOf(slug)]);
  const words = t as unknown as StylesT;
  const title = t(`useCasePages.${found.landing.useCase}.title`);
  const absolute = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;

  return (
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: t("breadcrumbs.library"), url: absolute(STYLES_HREF) },
            { name: title, url: absolute(packagingHref(slug)) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: title,
            numberOfItems: found.styles.length,
            itemListElement: found.styles.map((s, i) => {
              const name = pick(locale, s.nameTh, s.nameEn);
              return {
                "@type": "ListItem",
                position: i + 1,
                item: productSchema({
                  name,
                  url: absolute(styleHref(s.code, name)),
                  images: [],
                  sku: s.code,
                  category: facetLabel(words, "category", s.category),
                  ...(s.startingPrice
                    ? { lowPrice: s.startingPrice.unitPrice, currency: s.startingPrice.currency }
                    : {}),
                }),
              };
            }),
          },
          ...(copy.faq.length && isLandingPublished(slug) ? [faqPageSchema(copy.faq)] : []),
        ]}
      />
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: title }]}
      />
      <header className="mt-4 max-w-3xl">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="text-muted mt-2">{t(`useCasePages.${found.landing.useCase}.intro`)}</p>
      </header>
      {copy.intro ? (
        <section className="prose mt-6 max-w-3xl whitespace-pre-line" data-landing-intro="">
          {copy.intro}
        </section>
      ) : null}
      <section aria-label={title} className="mt-8">
        <StyleCardGrid styles={found.styles} label={title} />
      </section>
      {copy.faq.length ? (
        <section aria-labelledby="landing-faq" className="mt-12 max-w-3xl">
          <h2 id="landing-faq" className="mb-4 text-xl font-semibold">
            {t("library.landingFaq")}
          </h2>
          <dl className="flex flex-col gap-4">
            {copy.faq.map((entry) => (
              <div key={entry.question}>
                <dt className="font-semibold">{entry.question}</dt>
                <dd className="text-muted mt-1">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <LibraryLinks />
    </div>
  );
}
