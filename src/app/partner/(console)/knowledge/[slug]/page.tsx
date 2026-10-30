import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { richTextHeadings, RichTextView } from "@/ui/components/RichTextView";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.knowledge"))("title") };
}

const pick = (locale: string, th: string, en: string | null) => (locale === "en" && en ? en : th);

/**
 * One knowledge-base guide (U2.F7), its rich text in the reader's language (Thai when there is no English), set
 * for reading: a ~68ch measure, a calm heading scale, and — on a desk, when the guide has sections — its contents
 * beside it, following the scroll.
 */
export default async function KnowledgeArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.knowledge"), getFormat(), getLocale()]);
  const { contract } = await partnerServerApis();
  const [article, categories] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/knowledge-base/articles/{slug}", { params: { path: { slug } } })).data!,
    ),
    attempt(async () => (await contract.GET("/v1/partner/knowledge-base/categories")).data ?? []),
  ]);
  if (!article.data && (article.error as { status?: number } | null)?.status === 404) notFound();
  const back = { href: "/knowledge", label: t("back") };
  if (!article.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={article.error} />
      </PartnerPage>
    );
  const a = article.data;
  const body = (a.body[locale] ?? a.body.th) as unknown;
  const headings = richTextHeadings(body);
  const toc = headings.length >= 2;
  const inCategories = (categories.data ?? []).filter((c) => a.categorySlugs.includes(c.slug));
  const excerpt = pick(locale, a.excerptTh ?? "", a.excerptEn);

  return (
    <PartnerPage
      wide
      title={pick(locale, a.titleTh, a.titleEn)}
      back={back}
      meta={
        <span className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {inCategories.map((c) => (
            <Link
              key={c.slug}
              href={`/knowledge?category=${encodeURIComponent(c.slug)}`}
              className="text-primary font-medium hover:underline"
            >
              {pick(locale, c.nameTh, c.nameEn)}
            </Link>
          ))}
          <span>{t("published", { date: format.date(a.publishedAt) })}</span>
        </span>
      }
      description={excerpt || undefined}
    >
      <div className={cn("grid items-start gap-10", toc && "lg:grid-cols-[minmax(0,1fr)_14rem] xl:gap-16")}>
        <article className="border-border min-w-0 border-t pt-6">
          <RichTextView
            doc={body}
            linkAs={Link}
            anchorHeadings={toc}
            className="max-w-[68ch] text-base leading-[1.8] [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:leading-snug [&_h2]:tracking-tight [&_h3]:mt-7 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:leading-snug [&_li]:mt-1.5 [&_p]:mt-4 [&_p]:text-pretty"
          />
        </article>
        {toc ? (
          <nav aria-labelledby="toc-title" className="hidden lg:sticky lg:top-20 lg:block">
            <p id="toc-title" className="text-muted mb-2 text-sm font-medium">
              {t("onThisPage")}
            </p>
            <ol className="border-border flex flex-col border-s">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={cn(
                      "text-muted hover:text-fg hover:border-border-strong -ms-px block border-s border-transparent py-1.5 text-sm leading-snug",
                      h.level === 3 ? "ps-6" : "ps-3",
                    )}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
    </PartnerPage>
  );
}
