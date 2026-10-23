import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.salesOrders"))("newTitle") };
}

/** A new draft sales order without a quotation (D-361); `?customer=` preselects the customer. */
export default async function NewSalesOrderPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const [query, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.salesOrders"),
    getLocale(),
    factoryContext(),
  ]);
  const pickers = await salesPickers(context.factoryId);
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: "/sales-orders", label: t("title") }}
    >
      {pickers.data ? (
        <SalesDocForm
          kind="salesOrder"
          pickers={pickers.data}
          locale={locale}
          preset={query.customer ? { customerId: query.customer } : {}}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
