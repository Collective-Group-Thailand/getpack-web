import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getStyle, listAllStyles, listStyleVariants, type StyleDetail } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { illustrationOf } from "@/features/customer/styles/illustration";
import type { StylesT } from "@/features/customer/styles/labels";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import {
  codeOfSlug,
  previewSrc,
  styleHref,
  styleSlug,
  STYLES_HREF,
  styleTopicHref,
  topicHubHref,
} from "@/features/customer/styles/paths";
import { shortName, topicById, topicFilter, topicsOf, variantIn, type Topic } from "@/features/customer/styles/topics";
import { VariantCardFace, variantWords } from "@/features/customer/styles/VariantCardFace";
import { VariantResults } from "@/features/customer/styles/VariantResults";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { breadcrumbSchema, localePath, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { ProductPlate } from "@/ui/components/ProductIllustration";

type Params = Promise<{ locale: string; slug: string; topic: string }>;

const PER_PAGE = 48;
/** How many other styles with the same feature the page links to. */
const OTHERS = 12;

/** The style and the feature a URL names, when the style offers it. */
async function load(slug: string, id: string): Promise<{ style: StyleDetail; topic: Topic } | null> {
  const code = codeOfSlug(slug);
  const topic = topicById(id);
  if (!code || !topic) return null;
  const style = await getStyle(code);
  return style && topicsOf(style.options).some((t) => t.id === topic.id) ? { style, topic } : null;
}

/** "กล่องฝาเสียบมีหน้าต่าง" / "Tuck-end carton with a window". */
function headingOf(t: (key: string) => string, locale: string, name: string, topic: Topic) {
  return `${shortName(name)}${locale === "en" ? " " : ""}${t(`topics.${topic.id}.phrase`)}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, topic: id, locale } = await params;
  const [t, found, origin] = await Promise.all([getTranslations("styles"), load(slug, id), publicOrigin()]);
  if (!found) return {};
  const { style, topic } = found;
  const name = pick(locale, style.nameTh, style.nameEn);
  const title = headingOf(t, locale, name, topic);
  const count = style.variants.filter((v) => variantIn(topic, v.options)).length;
  const url = (l: Locale) =>
    `${origin}${localePath(styleTopicHref(style.code, pick(l, style.nameTh, style.nameEn), topic.id), l)}`;
  const languages = {
    ...(Object.fromEntries(routing.locales.map((l) => [l, url(l)])) as Record<Locale, string>),
    "x-default": url(routing.defaultLocale),
  };
  return {
    title: t("topicPage.metaTitle", { title, count }),
    description: t("topicPage.metaDescription", { title, about: t(`topics.${topic.id}.about`), count }),
    alternates: { canonical: languages[locale as Locale], languages },
  };
}

/**
 * One style with one sought-after feature (D-410): "กล่องฝาเสียบมีหน้าต่าง", "กล่องลูกฟูกมีช่องมือจับ"
 * — a page of its own for that search, with what the feature is, the style's variants that have it
 * as cards (variants differing only in a detail — a front or a top window — are cards here, never
 * pages), and the way on to the style, its other features and other styles with the same one.
 */
export default async function StyleTopicPage({ params }: { params: Params }) {
  const { locale, slug, topic: id } = await params;
  setRequestLocale(locale);
  const found = await load(slug, id);
  if (!found) notFound();
  const { style, topic } = found;
  const name = pick(locale, style.nameTh, style.nameEn);
  if (decodeURIComponent(slug) !== styleSlug(style.code, name))
    redirect({ href: styleTopicHref(style.code, name, topic.id), locale: locale as Locale });

  const option = topicFilter(topic, style.options);
  const [t, list, all, origin] = await Promise.all([
    getTranslations("styles"),
    listStyleVariants({ style: style.code, option, limit: PER_PAGE }),
    listAllStyles().catch(() => []),
    publicOrigin(),
  ]);
  const words = t as unknown as StylesT;
  const heading = headingOf(t, locale, name, topic);
  const href = styleTopicHref(style.code, name, topic.id);
  const thumb = storeImageSrc(list.data.find((v) => v.thumbnailUrl)?.thumbnailUrl, "thumb");
  const others = all
    .filter((s) => s.code !== style.code && topicsOf(s.options ?? []).some((x) => x.id === topic.id))
    .slice(0, OTHERS);
  const siblings = topicsOf(style.options).filter((x) => x.id !== topic.id);
  const absolute = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;

  return (
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: t("breadcrumbs.library"), url: absolute(STYLES_HREF) },
            { name, url: absolute(styleHref(style.code, name)) },
            { name: heading },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: heading,
            url: absolute(href),
            description: t(`topics.${topic.id}.about`),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: list.meta.total,
              itemListElement: list.data.slice(0, 20).map((v, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${name} ${v.code}`,
              })),
            },
          },
        ]}
      />
      <Breadcrumbs
        label={t("breadcrumbs.library")}
        items={[
          { label: t("breadcrumbs.library"), href: STYLES_HREF },
          { label: name, href: styleHref(style.code, name) },
          { label: heading },
        ]}
      />

      <header className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="bg-bg-subtle rounded-card overflow-hidden">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the API's file host (ProductCard)
            <img
              src={thumb}
              alt={t("detail.thumbnailAlt", { name, code: style.code })}
              width={640}
              height={480}
              className="h-auto w-full"
            />
          ) : list.data[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- the engine's drawing, served by this app
            <img
              src={previewSrc(style.code, list.data[0].options)}
              alt={t("detail.thumbnailAlt", { name, code: list.data[0].code })}
              width={640}
              height={480}
              className="bg-surface aspect-[4/3] h-auto w-full object-contain p-6"
            />
          ) : (
            <ProductPlate family={illustrationOf(style)} />
          )}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            <span className="font-mono">{style.code}</span> · {t(`topics.${topic.id}.chip`)}
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">{heading}</h1>
          <p className="text-primary text-lg font-semibold">
            {t("topicPage.variants", { count: list.meta.total, title: t(`topics.${topic.id}.phrase`) })}
          </p>
          <p className="text-muted">{t(`topics.${topic.id}.about`)}</p>
          {style.descriptionTh || style.descriptionEn ? (
            <p className="text-muted text-sm">{pick(locale, style.descriptionTh ?? "", style.descriptionEn ?? "")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild>
              <Link href={styleHref(style.code, name)}>{t("topicPage.seeStyle", { name: shortName(name) })}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={topicHubHref(topic.id)}>{t(`topics.${topic.id}.title`)}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section aria-label={heading} className="mt-10">
        <VariantResults
          initial={list.data.map((card, index) => ({
            code: card.code,
            node: <VariantCardFace card={card} words={variantWords(card, locale, words)} priority={index < 2} />,
          }))}
          nextCursor={list.meta.nextCursor}
          query={{ style: style.code, option, limit: PER_PAGE }}
          total={list.meta.total}
        />
      </section>

      {siblings.length ? (
        <section aria-labelledby="topic-siblings" className="mt-12">
          <h2 id="topic-siblings" className="mb-3 text-lg font-semibold">
            {t("topicPage.otherTopics", { name: shortName(name) })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((x) => (
              <li key={x.id}>
                <Link
                  href={styleTopicHref(style.code, name, x.id)}
                  className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-control inline-block border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
                >
                  {headingOf(t, locale, name, x)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {others.length ? (
        <section aria-labelledby="topic-others" className="mt-10">
          <h2 id="topic-others" className="mb-3 text-lg font-semibold">
            {t("topicPage.otherStyles", { phrase: t(`topics.${topic.id}.phrase`) })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((s) => {
              const other = pick(locale, s.nameTh, s.nameEn);
              return (
                <li key={s.code}>
                  <Link
                    href={styleTopicHref(s.code, other, topic.id)}
                    className="border-border hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-control inline-block border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
                  >
                    {headingOf(t, locale, other, topic)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <LibraryLinks except={{ topic: topic.id }} />
    </div>
  );
}
