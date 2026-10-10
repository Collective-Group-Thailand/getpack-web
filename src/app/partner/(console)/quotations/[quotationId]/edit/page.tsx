import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.quotations"))("editTitle") };
}

/** Editing a draft quotation, under `If-Match` (D-360). */
export default async function EditQuotationPage({ params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  const [t, locale, context] = await Promise.all([
    getTranslations("partnerSales.quotations"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [read, pickers] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/quotations/{quotationId}", {
        params: { path: { factoryId: context.factoryId, quotationId } },
      });
      return { doc: data!, etag: response.headers.get("etag") };
    }),
    salesPickers(context.factoryId),
  ]);
  const back = { href: `/quotations/${quotationId}`, label: read.data?.doc.quoteNo ?? t("title") };
  return (
    <PartnerPage wide title={t("editTitle")} back={back}>
      {read.data && pickers.data ? (
        <SalesDocForm
          kind="quotation"
          pickers={pickers.data}
          locale={locale}
          etag={read.data.etag}
          preset={read.data.doc.opportunity ? { opportunityId: read.data.doc.opportunity.id } : {}}
          initial={{
            id: read.data.doc.id,
            customerId: read.data.doc.customer.id,
            salespersonId: read.data.doc.salesperson?.id ?? null,
            date: read.data.doc.quoteDate,
            validUntil: read.data.doc.validUntil,
            paymentTermDays: read.data.doc.paymentTermDays,
            leadTimeDays: read.data.doc.leadTimeDays,
            vatMode: read.data.doc.vatMode,
            terms: read.data.doc.terms,
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
