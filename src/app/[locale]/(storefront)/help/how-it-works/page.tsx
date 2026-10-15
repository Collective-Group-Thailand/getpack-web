import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentPage, ContentSection, StepList } from "@/features/customer/content/ContentPage";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { Link } from "@/i18n/navigation";
import { faqPageSchema, howToSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";

interface Step {
  title: string;
  body: string;
  tip?: string;
}
interface Faq {
  q: string;
  a: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.howItWorks");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * How ordering works (SEO/AEO pass): the six steps as a `HowTo`, the questions as `FAQPage`, and
 * the answer paragraph first — the page an answer engine quotes for "how do I order from Packio".
 */
export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([getTranslations("pages.howItWorks"), getTranslations("pages.common")]);
  const page = await pageContext("/help/how-it-works", t("title"));
  const steps = t.raw("steps") as Step[];
  const faq = t.raw("faq") as Faq[];

  return (
    <ContentPage
      crumbs={page.crumbs}
      crumbLabel={page.crumbLabel}
      title={t("title")}
      answer={t("answer")}
      lead={t("intro")}
      jsonLd={[
        page.breadcrumb,
        webPageSchema({
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: page.url,
          locale: page.language,
          speakableSelector: ["#page-answer"],
        }),
        howToSchema({
          name: t("title"),
          description: t("answer"),
          steps: steps.map((step) => ({ name: step.title, text: step.body })),
        }),
        faqPageSchema(faq.map((entry) => ({ question: entry.q, answer: entry.a }))),
      ]}
    >
      <ContentSection id="steps" title={t("stepsTitle")}>
        <StepList steps={steps} tipLabel={tCommon("tip")} />
      </ContentSection>

      <ContentSection id="faq" title={t("faqTitle")}>
        <DisclosureList headingLevel="h3" items={faq.map((entry) => ({ summary: entry.q, content: entry.a }))} />
      </ContentSection>

      <section className="bg-primary-subtle rounded-card flex flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div>
          <h2 className="text-xl font-semibold">{t("ctaTitle")}</h2>
          <p className="text-muted mt-1">{t("ctaBody")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/studio">{t("ctaStart")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/products">{t("ctaProducts")}</Link>
          </Button>
        </div>
      </section>
    </ContentPage>
  );
}
