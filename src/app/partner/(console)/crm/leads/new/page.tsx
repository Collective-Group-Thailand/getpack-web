import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { LeadForm } from "@/features/partner/sales/CrmForms";
import { erpSalespeople } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("newLead") };
}

/** A new lead (D-359). */
export default async function NewLeadPage() {
  const [t, context] = await Promise.all([getTranslations("partnerSales.crm"), factoryContext()]);
  const { contract } = await partnerServerApis();
  const people = await attempt(async () => erpSalespeople(contract, context.factoryId));
  return (
    <PartnerPage wide title={t("newLead")} back={{ href: "/crm?view=leads", label: t("title") }}>
      {people.data ? <LeadForm people={people.data} /> : <PageError error={people.error} />}
    </PartnerPage>
  );
}
