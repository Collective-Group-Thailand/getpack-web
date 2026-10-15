import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { pageContext } from "@/features/customer/content/page-meta.server";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { NextStep } from "@/features/customer/shell/NextStep";
import { pick } from "@/features/customer/catalog/localize";
import { getNetworkStats } from "@/features/customer/trust/api.server";
import { getFormat } from "@/features/shared/format/server";
import { webPageSchema } from "@/lib/seo";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.trust.network");
  return { title: t("title"), description: t("intro") };
}

/**
 * Packio's partner network (U2.F4, D-201, D-264): how factories are audited, what the network can
 * make, and its aggregate figures over a stated window — only when packio-api publishes them (enough
 * factories and jobs). No factory is named; no figure is ever filled in here.
 */
export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, current, stats] = await Promise.all([
    getTranslations("storefront.trust.network"),
    getFormat(),
    getLocale(),
    getNetworkStats().catch(() => null),
  ]);
  const figures = stats?.network;
  const page = await pageContext("/network", t("title"));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <JsonLd data={page.breadcrumb} />
      <JsonLd data={webPageSchema({ name: t("title"), description: t("intro"), url: page.url, locale: page.language })} />
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      {!stats || !figures ? (
        <EmptyState
          className="mt-8"
          icon="factory"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<NextStep to="products" />}
        />
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          <section aria-labelledby="network-figures">
            <h2 id="network-figures" className="mb-3 text-xl font-semibold">
              {t("figuresTitle")}
            </h2>
            {figures.published ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat
                    label={t("partners")}
                    value={figures.partnerCount !== null ? format.number(figures.partnerCount) : "—"}
                  />
                  <Stat
                    label={t("onTime")}
                    value={figures.onTimePct !== null ? t("pct", { value: figures.onTimePct }) : "—"}
                  />
                  <Stat
                    label={t("firstPass")}
                    value={figures.firstPassPct !== null ? t("pct", { value: figures.firstPassPct }) : "—"}
                  />
                </div>
                <p className="text-muted mt-2 text-sm">
                  {t("window", { days: figures.windowDays, date: format.date(stats.generatedAt) })}
                </p>
              </>
            ) : (
              <Callout tone="info" title={t("notYet")}>
                {t("notYetBody", { factories: figures.minFactories, jobs: figures.minJobs, days: figures.windowDays })}
              </Callout>
            )}
          </section>

          {stats.auditCriteria.length ? (
            <section aria-labelledby="network-audit">
              <h2 id="network-audit" className="mb-3 text-xl font-semibold">
                {t("auditTitle")}
              </h2>
              <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                {stats.auditCriteria.map((item) => (
                  <li key={item.key}>{pick(current, item.labelTh, item.labelEn)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {stats.coverage.length ? (
            <section aria-labelledby="network-coverage">
              <h2 id="network-coverage" className="mb-3 text-xl font-semibold">
                {t("coverageTitle")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {stats.coverage.map((c) => (
                  <li key={c.productTypeCode}>
                    <Badge tone={c.available ? "success" : "neutral"}>
                      {t("coverageItem", {
                        name: pick(current, c.nameTh, c.nameEn),
                        state: c.available ? t("available") : t("notAvailable"),
                      })}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
