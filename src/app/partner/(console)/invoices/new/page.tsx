import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { InvoiceFromDeliveries } from "@/features/partner/sales/InvoiceForms";
import { SalesDocForm } from "@/features/partner/sales/SalesDocForm";
import { salesPickers } from "@/features/partner/sales/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.invoices"))("newTitle") };
}

/**
 * A new draft invoice (D-363): from a sales order (`?so=`) or a delivery note (`?do=`) — what was delivered and
 * not yet invoiced — or typed line by line for a sale with no order.
 */
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ so?: string; do?: string }> }) {
  const [query, t, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerSales.invoices"),
    getLocale(),
    factoryContext(),
  ]);
  const back = { href: "/invoices", label: t("title") };
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };

  if (query.so || query.do) {
    const source = await attempt(async () => {
      const delivery = query.do
        ? (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/delivery-notes/{deliveryNoteId}", {
              params: { path: { ...path, deliveryNoteId: query.do } },
            })
          ).data!
        : null;
      const soId = query.so ?? delivery!.salesOrder.id;
      const order = (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}", {
          params: { path: { ...path, salesOrderId: soId } },
        })
      ).data!;
      const open = (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/delivery-notes", {
          params: { path, query: { salesOrderId: soId, status: "uninvoiced", perPage: 100 } },
        })
      ).data!.data;
      return { order, open, delivery };
    });
    return (
      <PartnerPage
        wide
        title={t("newTitle")}
        description={source.data ? t("fromOrder", { no: source.data.order.soNo, customer: source.data.order.customer.name }) : undefined}
        back={back}
      >
        {source.data ? (
          <InvoiceFromDeliveries
            customer={source.data.order.customer}
            salesOrderId={source.data.order.id}
            deliveries={source.data.open.map((d) => ({
              id: d.id,
              doNo: d.doNo,
              deliverOn: d.deliverOn,
              salesOrder: d.salesOrder.code,
            }))}
            {...(source.data.delivery ? { preselected: source.data.delivery.id } : {})}
          />
        ) : (
          <PageError error={source.error} />
        )}
      </PartnerPage>
    );
  }

  const pickers = await salesPickers(context.factoryId);
  return (
    <PartnerPage wide title={t("newTitle")} description={t("newBody")} back={back}>
      {pickers.data ? (
        <SalesDocForm kind="invoice" pickers={pickers.data} locale={locale} />
      ) : (
        <PageError error={pickers.error} />
      )}
    </PartnerPage>
  );
}
