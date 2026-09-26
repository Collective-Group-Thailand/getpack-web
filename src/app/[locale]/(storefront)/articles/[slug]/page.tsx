import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";

import { getArticle } from "@/features/customer/catalog/api.server";
import { absoluteImageUrl, storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref } from "@/features/customer/catalog/paths";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { RichTextView } from "@/ui/components/RichTextView";

type Params = Promise<{ locale: string; slug: string }>;

const article = cache((slug: string) => getArticle(slug));

/** The stored body holds one document per language (`{ th: doc, en?: doc }`); Thai is always there. */
function bodyFor(body: Record<string, unknown>, locale: string): unknown {
  return (locale === "en" ? body.en : undefined) ?? body.th;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [found, locale, origin] = await Promise.all([article(slug), getLocale(), publicOrigin()]);
  if (!found) return {};
  const title = pick(locale, found.titleTh, found.titleEn);
  const image = absoluteImageUrl(origin, found.coverUrl);
  return {
    title: found.seo?.title ?? title,
    description: found.seo?.description ?? found.excerptTh ?? undefined,
    keywords: found.seo?.keywords ?? undefined,
    ...(found.seo?.canonicalUrl ? { alternates: { canonical: found.seo.canonicalUrl } } : {}),
    ...(found.seo?.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "article", title, publishedTime: found.publishedAt, ...(image ? { images: [image] } : {}) },
  };
}

/** One article, rendered from its stored rich text on the server (no editor in the bundle). */
export default async function ArticlePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const found = await article(slug);
  if (!found) notFound();

  const [t, currentLocale, format, origin] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    publicOrigin(),
  ]);
  const title = pick(currentLocale, found.titleTh, found.titleEn);
  const cover = storeImageSrc(found.coverUrl);
  const localised = (path: string) => getPathname({ href: path, locale: currentLocale as Locale });
  const crumbs = [
    { label: t("breadcrumbs.home"), href: localised("/") },
    { label: t("articles.title"), href: localised("/articles") },
    { label: title },
  ];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <JsonLd
        data={breadcrumbSchema([
          { name: crumbs[0]!.label, url: `${origin}${crumbs[0]!.href}` },
          { name: crumbs[1]!.label, url: `${origin}${crumbs[1]!.href}` },
          { name: title, url: `${origin}${localised(articleHref(found.slug))}` },
        ])}
      />
      <Breadcrumbs items={crumbs} label={t("breadcrumbs.label")} />
      <header className="mt-6">
        <h1 className="text-3xl leading-tight font-bold md:text-4xl">{title}</h1>
        <p className="text-muted mt-3 text-sm">
          <time dateTime={found.publishedAt}>{t("articles.published", { date: format.date(found.publishedAt) })}</time>
        </p>
      </header>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- API-origin image (see ProductCard)
        <img
          src={cover}
          alt=""
          width={1200}
          height={675}
          fetchPriority="high"
          className="mt-6 aspect-video w-full rounded-2xl object-cover"
        />
      ) : null}
      <RichTextView className="mt-8" doc={bodyFor(found.body, currentLocale)} linkAs={Link} />
      <p className="mt-12">
        <Link href="/articles" className="text-primary underline underline-offset-2">
          {t("articles.back")}
        </Link>
      </p>
    </article>
  );
}
