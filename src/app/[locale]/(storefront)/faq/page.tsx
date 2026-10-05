import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { NextStep } from "@/features/customer/shell/NextStep";
import { listFaqs } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { faqPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { DisclosureList } from "@/ui/components/DisclosureList";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("faq.title"), description: t("faq.description") };
}

/**
 * Every published FAQ, grouped as the CMS groups them (F2.5), with `FAQPage` markup built from
 * exactly the questions on the page. Each group has an anchor (`/faq#ordering`), so help text
 * elsewhere can link straight to it.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, currentLocale, groups] = await Promise.all([getTranslations("catalog"), getLocale(), listFaqs()]);

  const entries = groups.map((group) => ({
    code: group.categoryCode ?? "other",
    name: group.categoryNameTh ? pick(currentLocale, group.categoryNameTh, group.categoryNameEn) : t("faq.other"),
    faqs: group.faqs.map((faq) => ({
      question: pick(currentLocale, faq.questionTh, faq.questionEn),
      answer: pick(currentLocale, faq.answerTh, faq.answerEn),
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {entries.length > 0 ? <JsonLd data={faqPageSchema(entries.flatMap((entry) => entry.faqs))} /> : null}
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("faq.heading")}</h1>
        <p className="text-muted mt-2">{t("faq.intro")}</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="help"
          title={t("faq.emptyTitle")}
          description={t("faq.emptyBody")}
          action={<NextStep to="chat" />}
        />
      ) : (
        entries.map((entry) => (
          <section
            key={entry.code}
            id={entry.code}
            aria-labelledby={`faq-${entry.code}`}
            className="mt-10 scroll-mt-24"
          >
            <h2 id={`faq-${entry.code}`} className="text-xl font-semibold">
              {entry.name}
            </h2>
            <DisclosureList
              className="mt-4"
              headingLevel="h3"
              items={entry.faqs.map((faq) => ({ summary: faq.question, content: faq.answer }))}
            />
          </section>
        ))
      )}

      <div className="mt-12">
        <Button asChild variant="secondary">
          <Link href="/help/chat">{t("faq.contact")}</Link>
        </Button>
      </div>
    </div>
  );
}
