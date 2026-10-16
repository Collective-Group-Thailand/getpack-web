import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { STYLE_INTAKE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SubmitIntake } from "@/features/partner/intakes/SubmitIntake";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.intakes"))("title") };
}

/**
 * Dielines the factory offers to getpack's library (U3.6, D-272): the form, under the intake terms
 * in force (none set: offers are closed), and what it has offered with Prepress's decision.
 */
export default async function StyleIntakesPage() {
  const [t, format, context] = await Promise.all([
    getTranslations("partnerJobs.intakes"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [terms, list] = await Promise.all([
    attempt(async () => (await contract.GET("/v1/partner/style-intake-terms")).data!),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/style-intakes", {
            params: { path: { factoryId: context.factoryId } },
          })
        ).data!,
    ),
  ]);

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      <PartnerSection title={t("offerTitle")} description={t("offerBody")}>
        {terms.data ? (
          <SubmitIntake terms={terms.data} />
        ) : (
          <p className="text-muted text-sm">
            {t("closed")}{" "}
            <Link className="text-link underline" href="/requests">
              {t("closedAsk")}
            </Link>
          </p>
        )}
      </PartnerSection>
      <PartnerSection title={t("listTitle")}>
        {list.data ? (
          list.data.length ? (
            <ul className="flex flex-col gap-2">
              {list.data.map((i) => (
                <li key={i.id} className="border-border flex flex-col gap-1 rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.title}</span>
                    <StatusChip map={STYLE_INTAKE_STATUS} value={i.status} />
                  </div>
                  <span className="text-muted text-sm">
                    {t("sent", { date: format.date(i.createdAt), file: i.file.originalName })}
                  </span>
                  {i.templateBaseCode ? (
                    <span className="text-sm">{t("asTemplate", { code: i.templateBaseCode })}</span>
                  ) : null}
                  {i.resultRecipe ? (
                    <span className="text-sm">{t("asRecipe", { code: i.resultRecipe.baseCode })}</span>
                  ) : null}
                  {i.rejectReason ? (
                    <span className="text-danger text-sm">{t("rejected", { reason: i.rejectReason })}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="upload" title={t("empty")} />
          )
        ) : (
          <PageError error={list.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
