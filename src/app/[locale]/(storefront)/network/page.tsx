import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { NextStep } from "@/features/customer/shell/NextStep";
import { webPageSchema } from "@/lib/seo";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.trust.network");
  return { title: t("title"), description: t("intro") };
}

/**
 * getpack's partner network (U2.F4, D-201, D-264): how factories are audited, what the network can
 * make, and its aggregate figures over a stated window — only when getpack-api publishes them (enough
 * factories and jobs). No factory is named; no figure is ever filled in here.
 */
export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("storefront.trust.network");
  const page = await pageContext("/network", t("title"));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <JsonLd data={page.breadcrumb} />
      <JsonLd
        data={webPageSchema({ name: t("title"), description: t("intro"), url: page.url, locale: page.language })}
      />
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <EmptyState
        className="mt-8"
        icon="factory"
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={<NextStep to="products" />}
      />
    </div>
  );
}
