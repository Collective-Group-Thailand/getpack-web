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
import {
  shortName,
  topicById,
  topicFilter,
  topicHeading,
  topicsOf,
  variantIn,
  type Topic,
} from "@/features/customer/styles/topics";
import { VariantCardFace, variantWords } from "@/features/customer/styles/VariantCardFace";
import { VariantResults } from "@/features/customer/styles/VariantResults";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { breadcrumbSchema, localePath, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
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
  return topicHeading(name, t(`topics.${topic.id}.phrase`), locale);
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
    <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
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

      {/* Project A: a compact head — the picture (5 of 12) beside the name, the count, what the feature is and ONE
          primary way on; the feature's own page is a quiet link. */}
      <header className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
        <div className="border-border bg-surface rounded-panel overflow-hidden border">
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
            <span className="tabular-nums">{style.code}</span> · {t(`topics.${topic.id}.chip`)}
          </p>
          <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance md:text-[2.25rem]">
            {heading}
          </h1>
          <p className="text-primary text-lg font-semibold">
            {t("topicPage.variants", { count: list.meta.total, title: t(`topics.${topic.id}.phrase`) })}
          </p>
          <p className="text-muted">{t(`topics.${topic.id}.about`)}</p>
          {style.descriptionTh || style.descriptionEn ? (
            <p className="text-muted text-sm">{pick(locale, style.descriptionTh ?? "", style.descriptionEn ?? "")}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
            <Button asChild size="lg" iconEnd="arrow-right">
              <Link href={styleHref(style.code, name)}>{t("topicPage.seeStyle", { name: shortName(name) })}</Link>
            </Button>
            <Link
              href={topicHubHref(topic.id)}
              className="text-primary focus-visible:ring-focus-ring rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
            >
              {t(`topics.${topic.id}.title`)}
            </Link>
          </div>
        </div>
      </header>

      {/* The variants as one list (Project A): code, name, the options as chips, the way on — not a wall of
          near-identical pictures. */}
      <section aria-label={heading} className="mt-10">
        <VariantResults
          layout="row"
          initial={list.data.map((card, index) => ({
            code: card.code,
            node: (
              <VariantCardFace
                card={card}
                words={variantWords(card, locale, words)}
                priority={index < 2}
                layout="row"
              />
            ),
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
                  className="border-border bg-surface hover:border-primary focus-visible:ring-focus-ring rounded-control inline-flex min-h-10 items-center border px-3.5 text-sm outline-none focus-visible:ring-2"
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
                    className="border-border bg-surface hover:border-primary focus-visible:ring-focus-ring rounded-control inline-flex min-h-10 items-center border px-3.5 text-sm outline-none focus-visible:ring-2"
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

      {/* The page's one primary action, in reach at the foot of a phone's screen. */}
      <MobileActionBar>
        <Button asChild iconEnd="arrow-right">
          <Link href={styleHref(style.code, name)}>{t("topicPage.seeStyle", { name: shortName(name) })}</Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
