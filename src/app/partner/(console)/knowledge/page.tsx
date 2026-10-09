import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { EmptyState } from "@/ui/components/EmptyState";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.knowledge"))("title") };
}

const pick = (locale: string, th: string, en: string | null) => (locale === "en" && en ? en : th);

/**
 * The partner knowledge base (U2.F7): Packio's own guides for factories — the QC photo standard,
 * packing, labels — searchable and by category, rendered from the API (`partner.knowledgeBase.*`).
 * Screens link into it where the guide applies (the QC step to its photo standard).
 */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.knowledge"), getFormat(), getLocale()]);
  const { contract } = await partnerServerApis();
  const [articles, categories] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/knowledge-base/articles", {
            params: { query: { ...(q ? { q } : {}), ...(category ? { category } : {}), perPage: 50 } },
          })
        ).data!,
    ),
    attempt(async () => (await contract.GET("/v1/partner/knowledge-base/categories")).data ?? []),
  ]);

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      <form role="search" action="/knowledge" className="flex gap-2">
        <label htmlFor="kb-q" className="sr-only">
          {t("search")}
        </label>
        <Input
          id="kb-q"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="min-h-11 md:min-h-10"
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <Button type="submit" className="min-h-11 md:min-h-10">
          {t("search")}
        </Button>
      </form>
      {categories.data && categories.data.length ? (
        <nav aria-label={t("categories")} className="flex flex-wrap gap-2">
          <Link
            href="/knowledge"
            aria-current={!category ? "page" : undefined}
            className={
              !category
                ? "bg-primary-subtle rounded-control inline-flex min-h-11 items-center px-4 md:min-h-10"
                : "border-border rounded-control inline-flex min-h-11 items-center border px-4 md:min-h-10"
            }
          >
            {t("all")}
          </Link>
          {categories.data.map((c) => (
            <Link
              key={c.slug}
              href={`/knowledge?category=${encodeURIComponent(c.slug)}`}
              aria-current={category === c.slug ? "page" : undefined}
              className={
                category === c.slug
                  ? "bg-primary-subtle rounded-control inline-flex min-h-11 items-center px-4 md:min-h-10"
                  : "border-border rounded-control inline-flex min-h-11 items-center border px-4 md:min-h-10"
              }
            >
              {pick(locale, c.nameTh, c.nameEn)}
            </Link>
          ))}
        </nav>
      ) : null}
      {!articles.data ? (
        <PageError error={articles.error} />
      ) : articles.data.data.length === 0 ? (
        <EmptyState icon="article" title={q ? t("noResults") : t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.data.data.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/knowledge/${a.slug}`}
                className="border-border hover:bg-bg-subtle block rounded-lg border p-4"
              >
                <span className="block font-medium">{pick(locale, a.titleTh, a.titleEn)}</span>
                {a.excerptTh ? (
                  <span className="text-muted block text-sm">{pick(locale, a.excerptTh, a.excerptEn)}</span>
                ) : null}
                <span className="text-muted block text-xs">{t("published", { date: format.date(a.publishedAt) })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PartnerPage>
  );
}
