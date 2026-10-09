import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { RichTextView } from "@/ui/components/RichTextView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.knowledge"))("title") };
}

/** One knowledge-base guide (U2.F7), its rich text in the reader's language (Thai when there is no English). */
export default async function KnowledgeArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t, format, locale] = await Promise.all([getTranslations("partnerJobs.knowledge"), getFormat(), getLocale()]);
  const { contract } = await partnerServerApis();
  const article = await attempt(
    async () =>
      (await contract.GET("/v1/partner/knowledge-base/articles/{slug}", { params: { path: { slug } } })).data!,
  );
  if (!article.data && (article.error as { status?: number } | null)?.status === 404) notFound();
  if (!article.data) return <PageError error={article.error} />;
  const a = article.data;
  const body = (a.body[locale] ?? a.body.th) as unknown;
  return (
    <PartnerPage
      title={locale === "en" && a.titleEn ? a.titleEn : a.titleTh}
      description={t("published", { date: format.date(a.publishedAt) })}
    >
      <Link href="/knowledge" className="text-primary inline-flex min-h-11 items-center underline md:min-h-10">
        {t("back")}
      </Link>
      <RichTextView doc={body} linkAs={Link} />
    </PartnerPage>
  );
}
