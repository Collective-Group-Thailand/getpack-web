import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { LeadForm } from "@/features/partner/sales/CrmForms";
import { erpSalespeople } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("editLead") };
}

/** Editing a lead, under `If-Match` (D-359). */
export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const [{ leadId }, t, context] = await Promise.all([params, getTranslations("partnerSales.crm"), factoryContext()]);
  const { contract } = await partnerServerApis();
  const [read, people] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/leads/{leadId}", {
        params: { path: { factoryId: context.factoryId, leadId } },
      });
      return { lead: data!, etag: response.headers.get("etag") };
    }),
    attempt(async () => erpSalespeople(contract, context.factoryId)),
  ]);
  return (
    <PartnerPage
      wide
      title={t("editLead")}
      back={{ href: `/crm/leads/${leadId}`, label: read.data?.lead.name ?? t("title") }}
    >
      {read.data && people.data ? (
        <LeadForm lead={read.data.lead} etag={read.data.etag} people={people.data} />
      ) : (
        <PageError error={read.error ?? people.error} />
      )}
    </PartnerPage>
  );
}
