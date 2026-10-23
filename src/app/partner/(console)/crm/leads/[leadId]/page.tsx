import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_LEAD_STAGE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Activities, LeadActions } from "@/features/partner/sales/CrmForms";
import { erpCustomers, erpSalespeople } from "@/features/partner/sales/server";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("title") };
}

/** One lead (D-359): who, how to reach them, where they came from, and the follow-ups. */
export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const [{ leadId }, t, tSource, tCommon, format, context] = await Promise.all([
    params,
    getTranslations("partnerSales.crm"),
    getTranslations("partnerSales.crm.sources"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [read, activities, people, customers] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/leads/{leadId}", {
            params: { path: { ...path, leadId } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/activities", {
            params: { path, query: { leadId, perPage: 100, view: "all" } },
          })
        ).data!,
    ),
    attempt(async () => erpSalespeople(contract, context.factoryId)),
    attempt(async () => erpCustomers(contract, context.factoryId)),
  ]);
  const back = { href: "/crm?view=leads", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const lead = read.data;
  return (
    <PartnerPage full title={lead.name} back={back} meta={<StatusChip map={ERP_LEAD_STAGE} value={lead.stage} />}>
      <LeadActions
        lead={lead}
        customers={(customers.data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      />
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            ...(lead.contactName ? [{ term: t("leadForm.contactName"), description: lead.contactName }] : []),
            ...(lead.phone
              ? [
                  {
                    term: t("leadForm.phone"),
                    description: (
                      <a className="text-link underline" href={`tel:${lead.phone}`}>
                        {lead.phone}
                      </a>
                    ),
                  },
                ]
              : []),
            ...(lead.lineId ? [{ term: t("leadForm.lineId"), description: lead.lineId }] : []),
            ...(lead.email ? [{ term: t("leadForm.email"), description: lead.email }] : []),
            { term: t("leadForm.source"), description: tSource(lead.source) },
            { term: tCommon("salesperson"), description: lead.salesperson?.name ?? tCommon("noSalesperson") },
            ...(lead.expectedValue
              ? [{ term: t("leadForm.expectedValue"), description: format.thb(lead.expectedValue) }]
              : []),
            ...(lead.customer
              ? [
                  {
                    term: tCommon("customer"),
                    description: (
                      <Link className="text-link underline" href={`/partners/${lead.customer.id}`}>
                        {lead.customer.name}
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(lead.address ? [{ term: t("leadForm.address"), description: lead.address }] : []),
            ...(lead.note ? [{ term: t("leadForm.note"), description: lead.note }] : []),
            ...(lead.lostReason ? [{ term: tCommon("reason"), description: lead.lostReason }] : []),
            { term: t("created"), description: format.dateTime(lead.createdAt) },
          ]}
        />
      </Card>
      <PartnerSection title={t("activities.title")}>
        <Activities
          activities={activities.data?.data ?? []}
          subject={{ leadId: lead.id }}
          people={people.data ?? []}
          canManage={canAt(context, "factory_sales.manage")}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
