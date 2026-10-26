import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { NextStep } from "@/features/customer/shell/NextStep";
import { Link } from "@/i18n/navigation";
import { faqPageSchema, webPageSchema } from "@/lib/seo";
import { Card } from "@/ui/components/Card";
import { DisclosureList } from "@/ui/components/DisclosureList";

const STEPS = ["files", "during", "final", "secrecy"] as const;
const CRITERIA = ["size", "colour", "quantity"] as const;
const VISIBLE = ["proof", "status", "inspection", "guarantee"] as const;
/** The FAQ entries, with the page an answer sends to (if any). */
const FAQ = [
  { key: "responsible" },
  { key: "files" },
  { key: "mismatch", href: "/guarantee" },
  { key: "range", href: "/products" },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.trust.network");
  return { title: t("title"), description: t("intro") };
}

/**
 * getpack's production standard (business Phase 3b, D-435): how a job is checked, the inspection
 * criteria and what the customer sees. Static copy from `src/i18n` — nothing here comes from the API,
 * and nothing says who produces, where, or how many (GLOBAL-RULES §1). The URL stays `/network`.
 */
export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("storefront.trust.network");
  const page = await pageContext("/network", t("title"));
  const faq = FAQ.map(({ key }) => ({
    question: t(`faq.items.${key}.question`),
    answer: t(`faq.items.${key}.answer`),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={webPageSchema({ name: t("title"), description: t("intro"), url: page.url, locale: page.language })}
      />
      <JsonLd data={faqPageSchema(faq)} />
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>

      <div className="mt-8 flex flex-col gap-10">
        <section aria-labelledby="standard-quality">
          <h2 id="standard-quality" className="mb-3 text-xl font-semibold">
            {t("quality.title")}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <Card key={step} as="li" className="flex flex-col gap-1">
                <span className="text-muted text-sm" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="font-semibold">{t(`quality.steps.${step}.title`)}</h3>
                <p className="text-muted text-sm">{t(`quality.steps.${step}.body`)}</p>
              </Card>
            ))}
          </ol>
        </section>

        <section aria-labelledby="standard-criteria">
          <h2 id="standard-criteria" className="mb-3 text-xl font-semibold">
            {t("criteria.title")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {CRITERIA.map((item) => (
              <Card key={item} as="li" className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t(`criteria.items.${item}.label`)}</span>
                <span className="text-xl font-semibold">{t(`criteria.items.${item}.value`)}</span>
                <span className="text-muted text-sm">{t(`criteria.items.${item}.note`)}</span>
              </Card>
            ))}
          </ul>
        </section>

        <section aria-labelledby="standard-visible">
          <h2 id="standard-visible" className="mb-3 text-xl font-semibold">
            {t("visible.title")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {VISIBLE.map((item) => (
              <Card key={item} as="li" className="flex flex-col gap-1">
                <h3 className="font-semibold">{t(`visible.items.${item}.title`)}</h3>
                <p className="text-muted text-sm">{t(`visible.items.${item}.body`)}</p>
              </Card>
            ))}
          </ul>
        </section>

        <section aria-labelledby="standard-faq">
          <h2 id="standard-faq" className="mb-3 text-xl font-semibold">
            {t("faq.title")}
          </h2>
          <DisclosureList
            headingLevel="h3"
            items={FAQ.map((entry, index) => ({
              summary: faq[index]!.question,
              content: (
                <>
                  <p>{faq[index]!.answer}</p>
                  {"href" in entry ? (
                    <p className="mt-2">
                      <Link href={entry.href} className="text-primary underline">
                        {t(`faq.items.${entry.key}.link`)}
                      </Link>
                    </p>
                  ) : null}
                </>
              ),
            }))}
          />
        </section>

        <div>
          <NextStep to="products" />
        </div>
      </div>
    </div>
  );
}
