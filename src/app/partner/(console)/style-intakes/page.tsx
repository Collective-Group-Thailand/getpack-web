import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { STYLE_INTAKE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SubmitIntake } from "@/features/partner/intakes/SubmitIntake";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Panel } from "@/ui/components/Panel";

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

  const offer = (
    <Panel id="offer" title={t("offerTitle")}>
      {terms.data ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted -mt-2 text-sm text-pretty">{t("offerBody")}</p>
          <SubmitIntake terms={terms.data} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm text-pretty">{t("closed")}</p>
          <Button asChild variant="secondary" className="self-start">
            <Link href="/requests?new=1">{t("closedAsk")}</Link>
          </Button>
        </div>
      )}
    </Panel>
  );

  return (
    <PartnerPage wide title={t("title")} description={t("body")}>
      <PartnerDetail aside={offer}>
        <PartnerSection id="sent" title={t("listTitle")}>
          {list.data ? (
            list.data.length ? (
              <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                {list.data.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-medium [overflow-wrap:anywhere] break-keep">{i.title}</span>
                      <StatusChip map={STYLE_INTAKE_STATUS} value={i.status} />
                    </div>
                    <span className="text-muted text-sm [overflow-wrap:anywhere]">
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
              <EmptyState
                icon="upload"
                title={t("empty")}
                action={
                  <Button asChild variant="secondary">
                    <a href="#offer">{t("offerTitle")}</a>
                  </Button>
                }
              />
            )
          ) : (
            <PageError error={list.error} />
          )}
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
