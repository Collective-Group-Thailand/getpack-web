import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_DELIVERY_STATUS, ERP_SALES_INVOICE_STATUS, ERP_SALES_ORDER_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { SalesOrderActions } from "@/features/partner/sales/SalesOrderActions";
import { SalesLinesTable, SalesTotals } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

type Props = { params: Promise<{ salesOrderId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.salesOrders"))("title") };
}

/** One sales order (D-361): the customer and credit, lines with what is reserved, made, delivered and invoiced. */
export default async function SalesOrderPage({ params }: Props) {
  const { salesOrderId } = await params;
  const [t, tCommon, tLines, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.salesOrders"),
    getTranslations("partnerSales.common"),
    getTranslations("partnerSales.lines"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-orders/{salesOrderId}", {
      params: { path: { factoryId: context.factoryId, salesOrderId } },
    });
    return { doc: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/sales-orders", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { doc, etag } = read.data;
  const qty = (value: string) => formatQty(value, locale);

  return (
    <PartnerPage
      full
      title={doc.soNo}
      back={back}
      meta={
        <>
          <StatusChip map={ERP_SALES_ORDER_STATUS} value={doc.status} />
          {doc.late ? <Badge tone="danger">{tCommon("late")}</Badge> : null}
        </>
      }
    >
      <SalesOrderActions order={doc} etag={etag} />
      {doc.status === "draft" && doc.credit.over ? (
        <Callout tone="warning" title={t("creditOverTitle")}>
          {t("creditOverBody", {
            limit: format.thb(doc.credit.limit ?? "0"),
            receivables: format.thb(doc.credit.receivables),
            orders: format.thb(doc.credit.openOrders),
          })}
        </Callout>
      ) : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: tCommon("customer"), description: `${doc.customer.name} (${doc.customer.code})` },
            { term: tCommon("salesperson"), description: doc.salesperson?.name ?? tCommon("noSalesperson") },
            { term: t("facts.orderDate"), description: format.date(doc.orderDate) },
            { term: t("facts.deliveryDate"), description: doc.deliveryDate ? format.date(doc.deliveryDate) : "—" },
            { term: t("facts.paymentTerms"), description: tCommon("days", { n: doc.paymentTermDays }) },
            { term: t("facts.warehouse"), description: doc.warehouse.code },
            ...(doc.customerPoNo ? [{ term: t("facts.customerPoNo"), description: doc.customerPoNo }] : []),
            ...(doc.quotation
              ? [
                  {
                    term: t("facts.quotation"),
                    description: (
                      <Link className="text-link underline" href={`/quotations/${doc.quotation.id}`}>
                        {doc.quotation.code}
                      </Link>
                    ),
                  },
                ]
              : []),
            {
              term: t("facts.credit"),
              description: doc.credit.limit
                ? t("creditLine", {
                    limit: format.thb(doc.credit.limit),
                    receivables: format.thb(doc.credit.receivables),
                  })
                : t("noLimit"),
            },
            ...(doc.shipToAddress ? [{ term: t("facts.shipTo"), description: doc.shipToAddress }] : []),
            ...(doc.creditOverrideReason ? [{ term: t("facts.override"), description: doc.creditOverrideReason }] : []),
            ...(doc.note ? [{ term: t("facts.note"), description: doc.note }] : []),
            ...(doc.cancelReason || doc.closeReason
              ? [{ term: tCommon("reason"), description: doc.cancelReason ?? doc.closeReason }]
              : []),
          ]}
        />
      </Card>
      <PartnerSection
        title={t("linesTitle")}
        description={t("progress", { pct: formatPlain(doc.deliveredPct, locale, 0) })}
      >
        <SalesLinesTable
          caption={t("linesTitle")}
          lines={doc.lines}
          extra={[
            {
              key: "how",
              header: tLines("fulfilment"),
              cell: (line) =>
                line.productionOrder ? (
                  <Link className="text-link underline" href={`/planning/orders/${line.productionOrder.id}`}>
                    {line.productionOrder.code}
                  </Link>
                ) : (
                  tLines(`fulfilments.${line.fulfilment}`)
                ),
            },
            { key: "reserved", header: t("reserved"), cell: (line) => qty(line.reservedQty) },
            { key: "delivered", header: t("delivered"), cell: (line) => qty(line.deliveredQty) },
            { key: "invoiced", header: t("invoiced"), cell: (line) => qty(line.invoicedQty) },
          ]}
        />
        <SalesTotals doc={doc} />
      </PartnerSection>
      <div className="grid gap-6 lg:grid-cols-2">
        <PartnerSection title={t("deliveriesTitle")}>
          {doc.deliveryNotes.length ? (
            <RowList label={t("deliveriesTitle")}>
              {doc.deliveryNotes.map((d) => (
                <Row
                  key={d.id}
                  href={`/deliveries/${d.id}`}
                  icon="truck"
                  title={<span className="tabular-nums">{d.doNo}</span>}
                  meta={format.date(d.deliverOn)}
                  aside={<StatusChip map={ERP_DELIVERY_STATUS} value={d.status} />}
                />
              ))}
            </RowList>
          ) : (
            <EmptyState icon="truck" title={t("noDeliveries")} />
          )}
        </PartnerSection>
        <PartnerSection title={t("invoicesTitle")}>
          {doc.invoices.length ? (
            <RowList label={t("invoicesTitle")}>
              {doc.invoices.map((i) => (
                <Row
                  key={i.id}
                  href={`/invoices/${i.id}`}
                  icon="receipt"
                  title={<span className="tabular-nums">{i.invoiceNo ?? tCommon("draftNo")}</span>}
                  meta={<StatusChip map={ERP_SALES_INVOICE_STATUS} value={i.status} />}
                  aside={format.thb(i.total)}
                />
              ))}
            </RowList>
          ) : (
            <EmptyState icon="receipt" title={t("noInvoices")} />
          )}
        </PartnerSection>
      </div>
    </PartnerPage>
  );
}
