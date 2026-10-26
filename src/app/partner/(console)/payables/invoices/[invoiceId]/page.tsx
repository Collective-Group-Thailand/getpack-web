import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_SUPPLIER_INVOICE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { InvoiceActions } from "@/features/partner/erp/PayablesActions";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables"))("title") };
}

/** One supplier invoice (D-337): the match against the order and the goods, the amounts, the payments. */
export default async function SupplierInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const [{ invoiceId }, t, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.payables"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-invoices/{invoiceId}", {
          params: { path: { factoryId: context.factoryId, invoiceId } },
        })
      ).data!,
  );
  const back = { href: "/payables", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const inv = read.data;
  const pct = (v: string) => `${formatPlain(v, locale, 2)}%`;

  return (
    <PartnerPage
      wide
      title={`${inv.docNo} · ${inv.invoiceNo}`}
      back={back}
      meta={
        <>
          <StatusChip map={ERP_SUPPLIER_INVOICE_STATUS} value={inv.status} />
          {inv.overdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
        </>
      }
      actions={<InvoiceActions invoice={inv} />}
    >
      {inv.status === "variance" && inv.matchNote ? (
        <Callout tone="warning" title={t("detail.variance")}>
          {inv.matchNote}
        </Callout>
      ) : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            {
              term: t("table.supplier"),
              description: (
                <Link href={`/partners/${inv.supplier.id}`} className="underline-offset-4 hover:underline">
                  {inv.supplier.name}
                </Link>
              ),
            },
            {
              term: t("detail.po"),
              description: inv.purchaseOrder ? (
                <Link
                  href={`/purchasing/${inv.purchaseOrder.id}`}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {inv.purchaseOrder.code}
                </Link>
              ) : (
                "—"
              ),
            },
            { term: t("detail.invoiceDate"), description: format.date(inv.invoiceDate) },
            { term: t("table.due"), description: format.date(inv.dueDate) },
            { term: t("detail.taxInvoice"), description: inv.taxInvoiceNo ?? "—" },
            { term: t("detail.subtotal"), description: format.thb(inv.subtotal) },
            { term: t("detail.vat", { rate: pct(inv.vatRatePct) }), description: format.thb(inv.vatAmount) },
            { term: t("table.total"), description: format.thb(inv.total) },
            { term: t("detail.wht", { rate: pct(inv.whtRatePct) }), description: format.thb(inv.whtAmount) },
            { term: t("detail.payable"), description: <strong>{format.thb(inv.payableAmount)}</strong> },
            { term: t("detail.paid"), description: format.thb(inv.paidAmount) },
            {
              term: t("table.outstanding"),
              description: <strong className="text-lg">{format.thb(inv.outstanding)}</strong>,
            },
            ...(inv.approvedAt
              ? [
                  {
                    term: t("detail.approved"),
                    description: `${inv.approvedBy ?? ""} · ${format.dateTime(inv.approvedAt)}`,
                  },
                ]
              : []),
            ...(inv.note ? [{ term: t("detail.note"), description: inv.note }] : []),
            ...(inv.cancelReason ? [{ term: t("detail.cancelReason"), description: inv.cancelReason }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("detail.lines")} description={t("detail.linesBody")}>
        <PartnerTable
          caption={t("detail.lines")}
          rows={inv.lines}
          rowKey={(line) => String(line.lineNo)}
          columns={[
            { key: "desc", header: t("detail.description"), primary: true, cell: (line) => line.description },
            { key: "qty", header: tCommon("quantity"), align: "end", cell: (line) => formatQty(line.quantity, locale) },
            { key: "price", header: t("detail.unitPrice"), align: "end", cell: (line) => format.thb(line.unitPrice) },
            { key: "amount", header: t("detail.amount"), align: "end", cell: (line) => format.thb(line.amount) },
            {
              key: "match",
              header: t("detail.match"),
              cell: (line) =>
                line.variance ? (
                  <span className="flex flex-col gap-0.5">
                    <Badge tone="warning">{t(`variances.${line.variance}` as never)}</Badge>
                    {line.receivedQty || line.orderedPrice ? (
                      <span className="text-muted text-sm">
                        {t("detail.against", {
                          received: line.receivedQty ? formatQty(line.receivedQty, locale) : "—",
                          price: line.orderedPrice ? format.thb(line.orderedPrice) : "—",
                        })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <Badge tone="success">{t("detail.matched")}</Badge>
                ),
            },
          ]}
        />
      </PartnerSection>
      <PartnerSection title={t("detail.payments")}>
        <PartnerTable
          caption={t("detail.payments")}
          rows={inv.payments}
          rowKey={(p) => `${p.id}`}
          rowHref={(p) => `/payables/payments/${p.id}`}
          empty={<EmptyState icon="coins" title={t("detail.noPayments")} />}
          columns={[
            {
              key: "no",
              header: t("table.paymentNo"),
              primary: true,
              cell: (p) => <span className="tabular-nums">{p.paymentNo}</span>,
            },
            { key: "date", header: t("table.paidOn"), cell: (p) => format.date(p.paidOn) },
            { key: "amount", header: t("table.amount"), align: "end", cell: (p) => format.thb(p.amount) },
          ]}
        />
      </PartnerSection>
      <PostedEntries sourceId={inv.id} />
    </PartnerPage>
  );
}
