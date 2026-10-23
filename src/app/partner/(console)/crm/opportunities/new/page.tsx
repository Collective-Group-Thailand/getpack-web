import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { OpportunityForm } from "@/features/partner/sales/CrmForms";
import { erpCustomers, erpSalespeople } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("newOpportunity") };
}

/** A new opportunity for a customer (`?customer=`) or a lead (`?lead=`, D-359). */
export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; lead?: string }>;
}) {
  const [query, t, context] = await Promise.all([searchParams, getTranslations("partnerSales.crm"), factoryContext()]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const [people, customers] = await Promise.all([
      erpSalespeople(contract, context.factoryId),
      erpCustomers(contract, context.factoryId),
    ]);
    return { people, customers: customers.map((c) => ({ id: c.id, code: c.code, name: c.name })) };
  });
  return (
    <PartnerPage wide title={t("newOpportunity")} back={{ href: "/crm?view=opportunities", label: t("title") }}>
      {read.data ? (
        <OpportunityForm
          people={read.data.people}
          customers={read.data.customers}
          preset={{
            ...(query.customer ? { customerId: query.customer } : {}),
            ...(query.lead ? { leadId: query.lead } : {}),
          }}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
