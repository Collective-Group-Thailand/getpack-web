import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { BillingForm } from "@/features/partner/sales/ReceivableForms";
import { erpCustomers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.billing"))("newTitle") };
}

/** A billing note grouping a customer's invoices (D-365); `?customer=` preselects the customer. */
export default async function NewBillingPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const [query, t, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.billing"),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const customers = await attempt(async () => erpCustomers(contract, context.factoryId));
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/receivables?view=billing", label: t("back") }}
    >
      {customers.data ? (
        <BillingForm
          customers={customers.data.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          preset={query.customer ? { customerId: query.customer } : {}}
        />
      ) : (
        <PageError error={customers.error} />
      )}
    </PartnerPage>
  );
}
