import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentPage, ContentSection, StepList } from "@/features/customer/content/ContentPage";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { Link } from "@/i18n/navigation";
import { zoneHosts } from "@/lib/env/server";
import { serviceSchema, webPageSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { Icon, type IconName } from "@/ui/icons";

interface Block {
  title: string;
  body: string;
}

const BENEFIT_ICONS: IconName[] = ["file-check", "factory", "wallet", "sort"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.partner");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * The factory recruitment page (SEO pass): what a partner gets, how to apply, and the way into
 * the partner portal for a factory that already is one. getpack's launch plan recruits further
 * factories from the traffic this page draws.
 */
export default async function PartnerWithUsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon, headerList] = await Promise.all([
    getTranslations("pages.partner"),
    getTranslations("pages.common"),
    headers(),
  ]);
  const page = await pageContext("/partner-with-us", t("title"));
  const scheme = headerList.get("x-forwarded-proto") ?? (zoneHosts.partner.startsWith("localhost") ? "http" : "https");
  const partnerLoginUrl = `${scheme}://${zoneHosts.partner}/login`;
  const benefits = t.raw("benefits") as Block[];
  const how = t.raw("how") as Block[];

  return (
    <ContentPage
      crumbs={page.crumbs}
      crumbLabel={page.crumbLabel}
      title={t("title")}
      answer={t("answer")}
      lead={t("lead")}
      jsonLd={[
        page.breadcrumb,
        webPageSchema({
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: page.url,
          locale: page.language,
          speakableSelector: ["#page-answer"],
        }),
        serviceSchema({
          name: t("title"),
          description: t("answer"),
          url: page.url,
          serviceType: "Packaging production partner programme",
        }),
      ]}
    >
      <ContentSection id="benefits" title={t("benefitsTitle")}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit, index) => (
            <li key={benefit.title} className="border-border bg-surface rounded-card border p-5">
              <span className="bg-primary-subtle text-primary-subtle-fg grid size-10 place-items-center rounded-full">
                <Icon name={BENEFIT_ICONS[index] ?? "check"} size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-lg font-semibold">{benefit.title}</h3>
              <p className="text-muted mt-1.5 text-sm leading-relaxed">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection id="how" title={t("howTitle")}>
        <StepList steps={how} tipLabel={tCommon("tip")} />
      </ContentSection>

      <section className="bg-primary-subtle rounded-card flex flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div>
          <h2 className="text-xl font-semibold">{t("ctaTitle")}</h2>
          <p className="text-muted mt-1">{t("ctaBody")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/contact?topic=partner">{t("ctaContact")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <a href={partnerLoginUrl}>{t("ctaLogin")}</a>
          </Button>
        </div>
      </section>
    </ContentPage>
  );
}
