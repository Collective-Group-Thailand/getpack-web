import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ReceiptForm } from "@/features/partner/sales/ReceivableForms";
import { erpCustomers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.receipts"))("newTitle") };
}

/** Recording money from a customer, or a refund (D-365); `?customer=` and `?invoice=` start it from an invoice. */
export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; invoice?: string }>;
}) {
  const [query, t, context] = await Promise.all([searchParams, getTranslations("partnerSales.receipts"), factoryContext()]);
  const { contract } = await partnerServerApis();
  const customers = await attempt(async () => erpCustomers(contract, context.factoryId));
  return (
    <PartnerPage
      wide
      title={t("newTitle")}
      description={t("newBody")}
      back={{ href: query.invoice ? `/invoices/${query.invoice}` : "/receivables?view=receipts", label: t("back") }}
    >
      {customers.data ? (
        <ReceiptForm
          customers={customers.data.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          preset={{
            ...(query.customer ? { customerId: query.customer } : {}),
            ...(query.invoice ? { invoiceId: query.invoice } : {}),
          }}
        />
      ) : (
        <PageError error={customers.error} />
      )}
    </PartnerPage>
  );
}
