import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_OPPORTUNITY_STAGE, ERP_QUOTATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { Activities, OpportunityActions } from "@/features/partner/sales/CrmForms";
import { erpSalespeople } from "@/features/partner/sales/server";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("title") };
}

/** One opportunity (D-359): value and chance, the quotations made for it, and the follow-ups. */
export default async function OpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const [{ opportunityId }, t, tCommon, format, context] = await Promise.all([
    params,
    getTranslations("partnerSales.crm"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [read, activities, quotes, people] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/opportunities/{opportunityId}", {
            params: { path: { ...path, opportunityId } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/activities", {
            params: { path, query: { opportunityId, perPage: 100, view: "all" } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/quotations", {
            params: { path, query: { opportunityId, perPage: 50 } },
          })
        ).data!,
    ),
    attempt(async () => erpSalespeople(contract, context.factoryId)),
  ]);
  const back = { href: "/crm?view=opportunities", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const o = read.data;
  const tNext = await getTranslations("partnerSales.common");
  return (
    <PartnerPage full title={o.title} back={back} status={<StatusChip map={ERP_OPPORTUNITY_STAGE} value={o.stage} />}>
      <PartnerDetail
        aside={
          <ActionPanel id="next-steps" tone="neutral" title={tNext("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b pb-3">
              <dt className="text-muted text-sm">{t("opportunityForm.value")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(o.value)}</dd>
            </dl>
            <OpportunityActions opportunity={o} layout="panel" />
          </ActionPanel>
        }
      >
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              ...(o.customer
                ? [{ term: tCommon("customer"), description: `${o.customer.name} (${o.customer.code})` }]
                : []),
              ...(o.lead
                ? [
                    {
                      term: t("lead"),
                      description: (
                        <Link className="text-primary underline" href={`/crm/leads/${o.lead.id}`}>
                          {o.lead.name}
                        </Link>
                      ),
                    },
                  ]
                : []),
              { term: t("opportunityForm.value"), description: format.thb(o.value) },
              {
                term: t("opportunityForm.probability"),
                description: `${o.probabilityPct}% · ${format.thb(o.weightedValue)}`,
              },
              {
                term: t("opportunityForm.expectedCloseOn"),
                description: o.expectedCloseOn ? format.date(o.expectedCloseOn) : "—",
              },
              { term: tCommon("salesperson"), description: o.salesperson?.name ?? tCommon("noSalesperson") },
              ...(o.note ? [{ term: t("opportunityForm.note"), description: o.note }] : []),
              ...(o.lostReason ? [{ term: tCommon("reason"), description: o.lostReason }] : []),
            ]}
          />
        </Card>
        <PartnerSection title={t("quotesTitle")}>
          {quotes.data?.data.length ? (
            <RowList label={t("quotesTitle")}>
              {quotes.data.data.map((qt) => (
                <Row
                  key={qt.id}
                  href={`/quotations/${qt.id}`}
                  icon="document"
                  title={<span className="tabular-nums">{qt.quoteNo}</span>}
                  meta={<StatusChip map={ERP_QUOTATION_STATUS} value={qt.status} />}
                  aside={format.thb(qt.total)}
                />
              ))}
            </RowList>
          ) : (
            <p className="text-muted text-sm">{t("noQuotes")}</p>
          )}
        </PartnerSection>
        <PartnerSection title={t("activities.title")}>
          <Activities
            activities={activities.data?.data ?? []}
            subject={{ opportunityId: o.id }}
            people={people.data ?? []}
            canManage={canAt(context, "factory_sales.manage")}
          />
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
