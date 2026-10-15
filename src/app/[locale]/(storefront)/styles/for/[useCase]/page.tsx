import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listStyles, listStyleVariants } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import { styleHref, STYLES_HREF, forUseCaseHref } from "@/features/customer/styles/paths";
import { StyleCardGrid } from "@/features/customer/styles/StyleCardGrid";
import { isUseCase } from "@/features/customer/styles/use-cases";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { alternateUrls, breadcrumbSchema, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type Params = Promise<{ locale: string; useCase: string }>;

async function load(useCase: string) {
  if (!isUseCase(useCase)) return null;
  const [list, variants] = await Promise.all([
    listStyles({ useCase, limit: 100 }),
    listStyleVariants({ useCase, limit: 1 }),
  ]);
  return list.data.length ? { useCase, styles: list.data, count: variants.meta.total } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { useCase, locale } = await params;
  const [t, found, origin] = await Promise.all([getTranslations("styles"), load(useCase), publicOrigin()]);
  if (!found) return {};
  const title = t(`useCasePages.${found.useCase}.title`);
  const { canonical, languages } = alternateUrls(origin, forUseCaseHref(found.useCase), locale as Locale);
  return {
    title: t("useCasePage.metaTitle", { title }),
    description: t("useCasePage.metaDescription", { title, intro: t(`useCasePages.${found.useCase}.intro`) }),
    alternates: { canonical, languages },
  };
}

/**
 * The styles that suit a product (D-410): "กล่องสบู่", "กล่องครีมและเครื่องสำอาง" — the master
 * file's use cases, each a page of its own with every suitable style as a card.
 */
export default async function UseCasePage({ params }: { params: Params }) {
  const { locale, useCase } = await params;
  setRequestLocale(locale);
  const found = await load(useCase);
  if (!found) notFound();
  const [t, origin] = await Promise.all([getTranslations("styles"), publicOrigin()]);
  const title = t(`useCasePages.${found.useCase}.title`);
  const absolute = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;

  return (
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
      <JsonLd
        data={[
          breadcrumbSchema([{ name: t("breadcrumbs.library"), url: absolute(STYLES_HREF) }, { name: title }]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            url: absolute(forUseCaseHref(found.useCase)),
            description: t(`useCasePages.${found.useCase}.intro`),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: found.styles.length,
              itemListElement: found.styles.map((s, i) => {
                const name = pick(locale, s.nameTh, s.nameEn);
                return { "@type": "ListItem", position: i + 1, name, url: absolute(styleHref(s.code, name)) };
              }),
            },
          },
        ]}
      />
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: title }]}
      />
      <header className="mt-4 max-w-3xl">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="text-primary mt-2 text-lg font-semibold">
          {t("useCasePage.count", { styles: found.styles.length, count: found.count })}
        </p>
        <p className="text-muted mt-2">{t(`useCasePages.${found.useCase}.intro`)}</p>
      </header>
      <section aria-label={title} className="mt-8">
        <StyleCardGrid styles={found.styles} label={title} />
      </section>
      <LibraryLinks except={{ useCase: found.useCase }} />
    </div>
  );
}
