import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.salesOrders"))("editTitle") };
}

/** Editing a draft sales order, under `If-Match` (D-361). */
export default async function EditSalesOrderPage({ params }: { params: Promise<{ salesOrderId: string }> }) {
  const { salesOrderId } = await params;
  const [t, locale, context] = await Promise.all([
    getTranslations("partnerSales.salesOrders"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const [read, pickers] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET(
        "/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}",
        { params: { path: { factoryId: context.factoryId, salesOrderId } } },
      );
      return { doc: data!, etag: response.headers.get("etag") };
    }),
    salesPickers(context.factoryId),
  ]);
  const back = { href: `/sales-orders/${salesOrderId}`, label: read.data?.doc.soNo ?? t("title") };
  return (
    <PartnerPage wide title={t("editTitle")} back={back}>
      {read.data && pickers.data ? (
        <SalesDocForm
          kind="salesOrder"
          pickers={pickers.data}
          locale={locale}
          etag={read.data.etag}
          initial={{
            id: read.data.doc.id,
            customerId: read.data.doc.customer.id,
            salespersonId: read.data.doc.salesperson?.id ?? null,
            date: read.data.doc.orderDate,
            deliveryDate: read.data.doc.deliveryDate,
            paymentTermDays: read.data.doc.paymentTermDays,
            vatMode: read.data.doc.vatMode,
            customerPoNo: read.data.doc.customerPoNo,
            warehouseId: read.data.doc.warehouse.id,
            shipToAddress: read.data.doc.shipToAddress,
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
