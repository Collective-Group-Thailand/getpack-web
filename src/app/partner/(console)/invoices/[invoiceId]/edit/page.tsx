import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.invoices"))("editTitle") };
}

/** Editing a draft invoice, under `If-Match` (D-363). */
export default async function EditInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const [t, locale, context] = await Promise.all([
    getTranslations("partnerSales.invoices"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [read, pickers] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET(
        "/v1/partner/factories/{factoryId}/erp/sales-invoices/{invoiceId}",
        { params: { path: { factoryId: context.factoryId, invoiceId } } },
      );
      return { doc: data!, etag: response.headers.get("etag") };
    }),
    salesPickers(context.factoryId),
  ]);
  const back = { href: `/invoices/${invoiceId}`, label: t("title") };
  return (
    <PartnerPage wide title={t("editTitle")} back={back}>
      {read.data && pickers.data ? (
        <SalesDocForm
          kind="invoice"
          pickers={pickers.data}
          locale={locale}
          etag={read.data.etag}
          headerOnly={Boolean(read.data.doc.salesOrder) || read.data.doc.deliveryNotes.length > 0}
          initial={{
            id: read.data.doc.id,
            customerId: read.data.doc.customer.id,
            date: read.data.doc.issueDate,
            paymentTermDays: read.data.doc.paymentTermDays,
            vatMode: read.data.doc.vatMode,
            customerPoNo: read.data.doc.customerPoNo,
            note: read.data.doc.note,
            lines: read.data.doc.lines,
          }}
        />
      ) : (
        <PageError error={read.error ?? pickers.error} />
      )}
    </PartnerPage>
  );
}
