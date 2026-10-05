import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getGuarantee } from "@/features/customer/trust/api.server";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Link } from "@/i18n/navigation";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.trust.guarantee");
  return { title: t("title"), description: t("intro") };
}

const TYPES: Schemas["ClaimType"][] = ["damaged", "wrong_spec", "print_defect", "quantity_short", "late", "other"];
const SEVERITIES: Schemas["ClaimSeverity"][] = ["minor", "major", "critical"];

/**
 * The guarantee (U2.F4, D-260–D-263): the remedies matrix exactly as packio-api publishes it — for
 * each kind of problem and its severity, what Packio does — with the time to report a claim and the
 * business days Packio answers and decides in. Nothing here is written by hand: a version change on
 * the API changes the page.
 */
export default async function GuaranteePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, guarantee] = await Promise.all([
    getTranslations("storefront.trust.guarantee"),
    getFormat(),
    getGuarantee().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      {!guarantee ? (
        <EmptyState className="mt-8" icon="shield" title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          <section aria-labelledby="guarantee-times">
            <h2 id="guarantee-times" className="mb-3 text-xl font-semibold">
              {t("timesTitle")}
            </h2>
            <DescriptionList
              columns={3}
              items={[
                { term: t("window"), description: t("days", { count: guarantee.claimWindowDays }) },
                { term: t("response"), description: t("businessDays", { count: guarantee.responseBusinessDays }) },
                { term: t("decision"), description: t("businessDays", { count: guarantee.decisionBusinessDays }) },
              ]}
            />
            <p className="text-muted mt-2 text-sm">{t("clock")}</p>
          </section>

          <section aria-labelledby="guarantee-matrix">
            <h2 id="guarantee-matrix" className="mb-3 text-xl font-semibold">
              {t("matrixTitle")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">{t("matrixTitle")}</caption>
                <thead>
                  <tr className="border-border border-b">
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("problem")}
                    </th>
                    {SEVERITIES.map((severity) => (
                      <th key={severity} scope="col" className="py-2 text-start font-medium">
                        {t(`severities.${severity}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TYPES.filter((type) => guarantee.rules.some((rule) => rule.claimType === type)).map((type) => (
                    <tr key={type} className="border-border border-b align-top">
                      <th scope="row" className="py-2 pe-3 text-start font-medium">
                        {t(`types.${type}`)}
                      </th>
                      {SEVERITIES.map((severity) => {
                        const rule = guarantee.rules.find((r) => r.claimType === type && r.severity === severity);
                        return (
                          <td key={severity} className="py-2 pe-3">
                            {!rule
                              ? "—"
                              : rule.remedies.length
                                ? rule.remedies.map((remedy) => t(`remedies.${remedy}`)).join(" / ")
                                : t("noRemedy")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted mt-2 text-sm">{t("severityHint")}</p>
          </section>

          <section aria-labelledby="guarantee-evidence" className="flex flex-col gap-2">
            <h2 id="guarantee-evidence" className="text-xl font-semibold">
              {t("evidenceTitle")}
            </h2>
            <p className="text-sm">{t("evidenceBody")}</p>
            <p className="text-sm">{t("tolerances")}</p>
            <p className="text-sm">
              <Link href="/account/orders" className="text-primary underline underline-offset-4">
                {t("toOrders")}
              </Link>
            </p>
          </section>

          <p className="text-muted text-xs">
            {t("version", { version: guarantee.versionNo, date: format.date(guarantee.effectiveFrom) })}
          </p>
        </div>
      )}
    </div>
  );
}
