import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CHANGE_REQUEST_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { factoryReferences } from "@/features/partner/onboarding/StepContent";
import { ChangeRequestForm } from "@/features/partner/requests/ChangeRequestForm";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerRequests"))("title") };
}

/**
 * Everything the factory asked the Partner team (`partner.changeRequests.list`, newest first) and
 * the answers — who answered and when — plus a way to ask something new.
 */
export default async function RequestsPage() {
  const t = await getTranslations("partnerRequests");
  const tForm = await getTranslations("partnerRequests.form");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const [asks, references] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/change-requests", {
            params: { path: { factoryId: context.factoryId }, query: { perPage: 50 } },
          })
        ).data!,
    ),
    factoryReferences(context.factoryId),
  ]);

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      <PartnerSection title={t("newTitle")}>
        <Card padding="lg">
          <ChangeRequestForm topic="other" chooseTopic primary productTypes={references.productTypes} />
        </Card>
      </PartnerSection>
      <PartnerSection title={t("listTitle")}>
        {asks.data ? (
          asks.data.data.length ? (
            <ul className="flex flex-col gap-2">
              {asks.data.data.map((ask) => (
                <li key={ask.id}>
                  <Card padding="md" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 font-medium">{tForm(`topics.${ask.topic}`)}</span>
                      <StatusChip map={CHANGE_REQUEST_STATUS} value={ask.status} size="md" />
                    </div>
                    <p className="whitespace-pre-wrap">{ask.message}</p>
                    {ask.preferredDates.length ? (
                      <p className="text-sm">
                        {t("dates", { dates: ask.preferredDates.map((day) => format.date(day)).join(", ") })}
                      </p>
                    ) : null}
                    {ask.response ? (
                      <p className="bg-surface-subtle rounded-md p-2 text-sm">
                        {t("response", { response: ask.response })}
                        {ask.respondedBy && ask.respondedAt ? (
                          <span className="text-muted mt-1 block">
                            {t("answeredBy", {
                              by: ask.respondedBy.displayName,
                              date: format.dateTime(ask.respondedAt),
                            })}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="text-muted text-sm">
                      {t("meta", { by: ask.createdBy.displayName, date: format.dateTime(ask.createdAt) })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="inbox" title={t("empty")} />
          )
        ) : (
          <PageError error={asks.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
