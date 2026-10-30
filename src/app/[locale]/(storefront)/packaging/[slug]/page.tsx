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
import { DisclosureList } from "@/ui/components/DisclosureList";
import { Icon } from "@/ui/icons";

type Params = Promise<{ locale: string; slug: string }>;

// Rendered per request like the rest of the storefront: canonical and JSON-LD URLs come from the
// request host (`publicOrigin` reads headers), which an ISR render cannot read (DYNAMIC_SERVER_USAGE → 500).

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
    <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
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
      <header className="mt-3 max-w-3xl">
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
          {title}
        </h1>
        <p className="text-muted mt-2 text-pretty">{t(`useCasePages.${found.landing.useCase}.intro`)}</p>
      </header>
      {/* Project A: the styles first, under the toolbar; the long intro and the FAQ below the grid. */}
      <section aria-label={title} className="mt-6">
        <StyleCardGrid styles={found.styles} label={title} />
      </section>
      {copy.intro || copy.faq.length ? (
        <div className="mt-14 grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
          {copy.intro ? (
            <section data-landing-intro="" className="min-w-0">
              {(() => {
                // The first paragraph stays in view; the rest folds behind its own disclosure, still in the HTML.
                const [first, ...rest] = copy.intro.split(/\n\s*\n/);
                return (
                  <>
                    <p className="text-fg leading-relaxed whitespace-pre-line">{first}</p>
                    {rest.length ? (
                      <details className="group/intro mt-3">
                        <summary className="text-primary focus-visible:ring-focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                          {t("library.landingIntroMore")}
                          <Icon
                            name="chevron-down"
                            size={16}
                            aria-hidden="true"
                            className="transition-transform group-open/intro:rotate-180 motion-reduce:transition-none"
                          />
                        </summary>
                        <div className="text-muted mt-3 flex flex-col gap-3 leading-relaxed whitespace-pre-line">
                          {rest.map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </>
                );
              })()}
            </section>
          ) : null}
          {copy.faq.length ? (
            <section aria-labelledby="landing-faq" className="min-w-0">
              <h2 id="landing-faq" className="mb-4 text-xl font-semibold">
                {t("library.landingFaq")}
              </h2>
              <DisclosureList
                headingLevel="h3"
                items={copy.faq.map((entry, index) => ({
                  id: `faq-${index + 1}`,
                  summary: entry.question,
                  content: entry.answer,
                }))}
              />
            </section>
          ) : null}
        </div>
      ) : null}
      <LibraryLinks />
    </div>
  );
}
