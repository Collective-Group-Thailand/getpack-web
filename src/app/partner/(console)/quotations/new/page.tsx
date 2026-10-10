import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { factoryContext } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.quotations"))("newTitle") };
}

/** A new draft quotation (D-360); `?customer=` and `?opportunity=` start it from a customer or a deal. */
export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; opportunity?: string }>;
}) {
  const [query, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.quotations"),
    getLocale(),
    factoryContext(),
  ]);
  const pickers = await salesPickers(context.factoryId);
  return (
    <PartnerPage wide title={t("newTitle")} description={t("newBody")} back={{ href: "/quotations", label: t("title") }}>
      {pickers.data ? (
        <SalesDocForm
          kind="quotation"
          pickers={pickers.data}
          locale={locale}
          preset={{
            ...(query.customer ? { customerId: query.customer } : {}),
            ...(query.opportunity ? { opportunityId: query.opportunity } : {}),
          }}
        />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
