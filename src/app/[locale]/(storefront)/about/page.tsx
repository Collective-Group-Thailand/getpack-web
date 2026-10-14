import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentPage, ContentSection } from "@/features/customer/content/ContentPage";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { Link } from "@/i18n/navigation";
import { organizationSchema, webPageSchema } from "@/lib/seo";
import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand";
import { Button } from "@/ui/components/Button";

interface Section {
  title: string;
  body: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.about");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * Who Packio is (SEO/GEO pass): the entity statement first — brand, operator, what it does,
 * where — so a search or answer engine can describe Packio in one sentence and attribute it to
 * Collective Group (Thailand); then the longer story, and the company facts as a list.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.about");
  const page = await pageContext("/about", t("title"));
  const sections = t.raw("sections") as Section[];

  return (
    <ContentPage
      crumbs={page.crumbs}
      crumbLabel={page.crumbLabel}
      title={t("title")}
      answer={t("answer")}
      lead={t("lead")}
      jsonLd={[
        page.breadcrumb,
        {
          ...webPageSchema({
            type: "AboutPage",
            name: t("metaTitle"),
            description: t("metaDescription"),
            url: page.url,
            locale: page.language,
            speakableSelector: ["#page-answer"],
          }),
          mainEntity: organizationSchema(page.origin),
        },
      ]}
      aside={
        <dl className="border-border bg-surface rounded-card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border p-5 text-sm">
          <dt className="text-muted">{t("facts.brand")}</dt>
          <dd className="font-semibold">{BRAND_NAME}</dd>
          <dt className="text-muted">{t("facts.company")}</dt>
          <dd>{BRAND_COMPANY}</dd>
          <dt className="text-muted">{t("facts.where")}</dt>
          <dd>{t("facts.whereValue")}</dd>
          <dt className="text-muted">{t("facts.contact")}</dt>
          <dd>
            <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
              {t("ctaContact")}
            </Link>
          </dd>
        </dl>
      }
    >
      {sections.map((section, index) => (
        <ContentSection key={section.title} id={`about-${index + 1}`} title={section.title}>
          {section.body}
        </ContentSection>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href="/network">{t("ctaNetwork")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/guarantee">{t("ctaGuarantee")}</Link>
        </Button>
        <Button asChild>
          <Link href="/contact">{t("ctaContact")}</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
