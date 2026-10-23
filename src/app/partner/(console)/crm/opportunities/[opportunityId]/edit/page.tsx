import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { OpportunityForm } from "@/features/partner/sales/CrmForms";
import { erpCustomers, erpSalespeople } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("editOpportunity") };
}

/** Editing an open opportunity, under `If-Match` (D-359). */
export default async function EditOpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const [{ opportunityId }, t, context] = await Promise.all([
    params,
    getTranslations("partnerSales.crm"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [{ data, response }, people, customers] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/opportunities/{opportunityId}", {
        params: { path: { factoryId: context.factoryId, opportunityId } },
      }),
      erpSalespeople(contract, context.factoryId),
      erpCustomers(contract, context.factoryId),
    ]);
    return {
      opportunity: data!,
      etag: response.headers.get("etag"),
      people,
      customers: customers.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    };
  });
  return (
    <PartnerPage
      wide
      title={t("editOpportunity")}
      back={{ href: `/crm/opportunities/${opportunityId}`, label: read.data?.opportunity.title ?? t("title") }}
    >
      {read.data ? (
        <OpportunityForm
          opportunity={read.data.opportunity}
          etag={read.data.etag}
          people={read.data.people}
          customers={read.data.customers}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
