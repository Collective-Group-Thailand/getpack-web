import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { listArticleCategories, listArticles } from "@/features/customer/catalog/api.server";
import { storeImageSrc } from "@/features/customer/catalog/images";
import { pick } from "@/features/customer/catalog/localize";
import { articleHref } from "@/features/customer/catalog/paths";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { itemListSchema, localePath, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";
import { ProductCard } from "@/ui/components/ProductCard";
import { cn } from "@/ui/lib/cn";

const PER_PAGE = 12;

type SearchParams = Promise<{ category?: string | string[]; page?: string | string[] }>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("articles.title"), description: t("articles.description") };
}

/** Articles (F2.5's CMS): newest first, filtered by category through links. */
export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const category = one(query.category);
  const page = Math.max(1, Number(one(query.page)) || 1);

  const [t, currentLocale, format, categories, articles] = await Promise.all([
    getTranslations("catalog"),
    getLocale(),
    getFormat(),
    listArticleCategories(),
    listArticles({ category, page, perPage: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(articles.meta.total / articles.meta.perPage));
  const seo = await pageContext("/articles", t("articles.heading"));
  // The index as a CollectionPage listing the articles on it (SEO pass); the first unfiltered
  // page only, which is the one in the sitemap.
  const structured =
    !category && page === 1
      ? [
          seo.breadcrumb,
          webPageSchema({
            type: "CollectionPage",
            name: t("articles.title"),
            description: t("articles.description"),
            url: seo.url,
            locale: seo.language,
          }),
          itemListSchema(
            articles.data.map((article) => ({
              name: pick(currentLocale, article.titleTh, article.titleEn),
              url: `${seo.origin}${localePath(articleHref(article.slug), seo.locale)}`,
              description: article.excerptTh,
              image: article.coverUrl,
            })),
            t("articles.heading"),
          ),
        ]
      : [];
  const href = (target: { category?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (target.category) search.set("category", target.category);
    if (target.page && target.page > 1) search.set("page", String(target.page));
    const text = search.toString();
    return text ? `/articles?${text}` : "/articles";
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-control border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
      active
        ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
        : "border-border hover:bg-bg-subtle",
    );

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8 md:py-12">
      {structured.map((data, index) => (
        <JsonLd key={index} data={data} />
      ))}
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">{t("articles.heading")}</h1>
        <p className="text-muted mt-2">{t("articles.intro")}</p>
      </header>

      {categories.length > 0 ? (
        <nav aria-label={t("articles.categories")} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href={href({})} aria-current={!category ? "page" : undefined} className={chip(!category)}>
                {t("articles.all")}
              </Link>
            </li>
            {categories.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={href({ category: entry.slug })}
                  aria-current={category === entry.slug ? "page" : undefined}
                  className={chip(category === entry.slug)}
                >
                  {pick(currentLocale, entry.nameTh, entry.nameEn)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {articles.data.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="article"
          // In a category: back to all of them. With none at all: out to help and the products —
          // never "learn first", whose own empty state sends the reader here (a loop).
          title={category ? t("articles.emptyTitle") : t("articles.emptyAllTitle")}
          description={category ? t("articles.emptyBody") : t("articles.emptyAllBody")}
          action={
            category ? (
              <Button asChild>
                <Link href="/articles">{t("articles.allArticles")}</Link>
              </Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <NextStep to="help" />
                <NextStep to="products" variant="secondary" />
              </div>
            )
          }
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.data.map((article, index) => {
            const name = pick(currentLocale, article.titleTh, article.titleEn);
            const src = storeImageSrc(article.coverUrl, "thumb");
            return (
              <ProductCard
                key={article.slug}
                as="li"
                headingLevel="h2"
                priority={index < 2}
                title={<Link href={articleHref(article.slug)}>{name}</Link>}
                image={src ? { src, alt: "" } : null}
                topLine={format.date(article.publishedAt)}
                meta={article.excerptTh}
              />
            );
          })}
        </ul>
      )}

      <LinkPagination
        className="mt-8"
        page={page}
        pages={pages}
        hrefFor={(target) => href({ category, page: target })}
        linkAs={Link}
        labels={{
          nav: t("pagination.nav"),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          page: (n) => t("pagination.page", { page: n }),
        }}
      />
    </div>
  );
}
