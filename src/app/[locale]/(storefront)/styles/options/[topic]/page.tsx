import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listAllStyles, listStyleVariants } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { LibraryLinks } from "@/features/customer/styles/LibraryLinks";
import { STYLES_HREF, styleTopicHref, topicHubHref } from "@/features/customer/styles/paths";
import { StyleCardGrid } from "@/features/customer/styles/StyleCardGrid";
import { topicById, topicsOf, type Topic } from "@/features/customer/styles/topics";
import { variantsHref } from "@/features/customer/styles/variant-query";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { alternateUrls, breadcrumbSchema, publicOrigin } from "@/lib/seo";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";

type Params = Promise<{ locale: string; topic: string }>;

/** Every variant with the feature: one count per axis it may sit on (a style has one of them). */
async function countOf(topic: Topic): Promise<number> {
  const totals = await Promise.all(
    Object.entries(topic.options).map(([axis, values]) =>
      listStyleVariants({ option: values.map((v) => `${axis}:${v}`), limit: 1 }).then((l) => l.meta.total),
    ),
  );
  return totals.reduce((n, x) => n + x, 0);
}

async function load(id: string) {
  const topic = topicById(id);
  if (!topic) return null;
  const [all, count] = await Promise.all([listAllStyles(), countOf(topic)]);
  const styles = all.filter((s) => topicsOf(s.options ?? []).some((x) => x.id === topic.id));
  return styles.length ? { topic, styles, count } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic: id, locale } = await params;
  const [t, found, origin] = await Promise.all([getTranslations("styles"), load(id), publicOrigin()]);
  if (!found) return {};
  const title = t(`topics.${found.topic.id}.title`);
  const { canonical, languages } = alternateUrls(origin, topicHubHref(found.topic.id), locale as Locale);
  return {
    title: t("topicPage.metaTitle", { title, count: found.count }),
    description: t("topicPage.metaDescription", {
      title,
      about: t(`topics.${found.topic.id}.about`),
      count: found.count,
    }),
    alternates: { canonical, languages },
  };
}

/**
 * A feature across the library (D-410): "กล่องมีหน้าต่าง", "กล่องฝาแม่เหล็ก" — what it is, how many
 * variants have it, and every style that offers it, each card going to that style's page for the
 * feature.
 */
export default async function TopicHubPage({ params }: { params: Params }) {
  const { locale, topic: id } = await params;
  setRequestLocale(locale);
  const found = await load(id);
  if (!found) notFound();
  const { topic, styles, count } = found;
  const [t, origin] = await Promise.all([getTranslations("styles"), publicOrigin()]);
  const title = t(`topics.${topic.id}.title`);
  const absolute = (path: string) => `${origin}${getPathname({ href: path, locale: locale as Locale })}`;
  const [axis, values] = Object.entries(topic.options)[0]!;

  return (
    <div className="max-w-content mx-auto px-5 py-8 pb-28 md:px-8 md:py-12">
      <JsonLd
        data={[
          breadcrumbSchema([{ name: t("breadcrumbs.library"), url: absolute(STYLES_HREF) }, { name: title }]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            url: absolute(topicHubHref(topic.id)),
            description: t(`topics.${topic.id}.about`),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: styles.length,
              itemListElement: styles.map((s, i) => {
                const name = pick(locale, s.nameTh, s.nameEn);
                return {
                  "@type": "ListItem",
                  position: i + 1,
                  name,
                  url: absolute(styleTopicHref(s.code, name, topic.id)),
                };
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
          {t("useCasePage.count", { styles: styles.length, count })}
        </p>
        <p className="text-muted mt-2">{t(`topics.${topic.id}.about`)}</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={variantsHref({ option: values.map((v) => `${axis}:${v}`) })} rel="nofollow">
            {t("list.viewVariants")}
          </Link>
        </Button>
      </header>

      <section aria-labelledby="hub-styles" className="mt-8">
        <h2 id="hub-styles" className="mb-4 text-lg font-semibold">
          {t("topicPage.styles", { phrase: t(`topics.${topic.id}.phrase`) })}
        </h2>
        <StyleCardGrid styles={styles} label={title} hrefOf={(s, name) => styleTopicHref(s.code, name, topic.id)} />
      </section>
      <LibraryLinks except={{ topic: topic.id }} />
    </div>
  );
}
