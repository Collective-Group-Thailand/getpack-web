import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.knowledge"))("title") };
}

const pick = (locale: string, th: string, en: string | null) => (locale === "en" && en ? en : th);

/**
 * The partner knowledge base (U2.F7): getpack's own guides for factories — the QC photo standard, packing,
 * labels — by category and searchable in one toolbar, as an index of guides to open (`partner.knowledgeBase.*`).
 */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const query = await searchParams;
  const q = query.q?.trim() || undefined;
  const category = query.category || undefined;
  const [t, tNav, format, locale] = await Promise.all([
    getTranslations("partnerJobs.knowledge"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    getLocale(),
  ]);
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
  const names = new Map((categories.data ?? []).map((c) => [c.slug, pick(locale, c.nameTh, c.nameEn)]));

  return (
    <PartnerPage wide title={t("title")} description={t("body")}>
      <ListToolbar>
        {categories.data && categories.data.length ? (
          <ViewTabs
            label={t("categories")}
            current={category ?? ""}
            items={[
              { key: "", href: `/knowledge${queryOf({ q })}`, label: t("all") },
              ...categories.data.map((c) => ({
                key: c.slug,
                href: `/knowledge${queryOf({ category: c.slug, q })}`,
                label: pick(locale, c.nameTh, c.nameEn),
              })),
            ]}
          />
        ) : null}
        <SearchBar
          id="kb-q"
          action="/knowledge"
          hidden={{ category }}
          q={q}
          label={t("search")}
          placeholder={t("searchPlaceholder")}
          button={t("search")}
        />
      </ListToolbar>
      {!articles.data ? (
        <PageError error={articles.error} />
      ) : articles.data.data.length === 0 ? (
        <EmptyState
          icon="article"
          title={q ? t("noResults") : t("empty")}
          action={
            q || category ? (
              <Button asChild variant="secondary">
                <Link href="/knowledge">{t("all")}</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/requests">{tNav("requests")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {articles.data.data.map((a) => {
            const kinds = a.categorySlugs.map((slug) => names.get(slug)).filter(Boolean);
            const excerpt = pick(locale, a.excerptTh ?? "", a.excerptEn);
            return (
              <li key={a.slug} className="min-w-0">
                <Link
                  href={`/knowledge/${a.slug}`}
                  className="group rounded-card border-border bg-surface hover:border-border-strong focus-visible:ring-focus-ring flex h-full flex-col gap-2 border p-4 transition-colors outline-none focus-visible:ring-2 sm:p-5"
                >
                  {kinds.length ? <span className="text-muted text-xs font-medium">{kinds.join(" · ")}</span> : null}
                  <span className="text-lg leading-snug font-semibold text-balance [overflow-wrap:anywhere] break-keep">
                    {pick(locale, a.titleTh, a.titleEn)}
                  </span>
                  {excerpt ? <span className="text-muted text-sm leading-relaxed text-pretty">{excerpt}</span> : null}
                  <span className="text-muted mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
                    {t("published", { date: format.date(a.publishedAt) })}
                    <Icon
                      name="arrow-right"
                      size={16}
                      aria-hidden="true"
                      className="group-hover:text-fg transition-colors motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PartnerPage>
  );
}
