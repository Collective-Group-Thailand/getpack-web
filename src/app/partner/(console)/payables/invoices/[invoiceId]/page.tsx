import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_SUPPLIER_INVOICE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { InvoiceActions } from "@/features/partner/erp/PayablesActions";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables"))("title") };
}

/** One supplier invoice (D-337): the match against the order and the goods, the amounts, the payments. */
export default async function SupplierInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const [{ invoiceId }, t, tCommon, tSales, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.payables"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerSales.common"),
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
      full
      title={inv.docNo}
      description={inv.supplier.name}
      back={back}
      status={
        <>
          <StatusChip map={ERP_SUPPLIER_INVOICE_STATUS} value={inv.status} />
          {inv.overdue ? <Badge tone="danger">{t("overdue")}</Badge> : null}
        </>
      }
    >
      <PartnerDetail
        aside={
          <ActionPanel id="ap-next" tone="neutral" title={tSales("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3">
              <dt className="text-muted text-sm">{t("table.outstanding")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(inv.outstanding)}</dd>
              <dt className="text-muted text-sm">{t("detail.payable")}</dt>
              <dd className="text-end tabular-nums">{format.thb(inv.payableAmount)}</dd>
              <dt className="text-muted text-sm">{t("table.due")}</dt>
              <dd className={inv.overdue ? "text-danger text-end tabular-nums" : "text-end tabular-nums"}>
                {format.date(inv.dueDate)}
              </dd>
            </dl>
            <InvoiceActions invoice={inv} layout="panel" />
          </ActionPanel>
        }
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
                  <Link
                    href={`/partners/${inv.supplier.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {inv.supplier.name}
                  </Link>
                ),
              },
              { term: t("detail.invoiceNo"), description: <span className="tabular-nums">{inv.invoiceNo}</span> },
              {
                term: t("detail.po"),
                description: inv.purchaseOrder ? (
                  <Link
                    href={`/purchasing/${inv.purchaseOrder.id}`}
                    className="text-primary tabular-nums underline-offset-4 hover:underline"
                  >
                    {inv.purchaseOrder.code}
                  </Link>
                ) : (
                  "—"
                ),
              },
              { term: t("detail.taxInvoice"), description: inv.taxInvoiceNo ?? "—" },
              { term: t("detail.invoiceDate"), description: format.date(inv.invoiceDate) },
              { term: t("table.due"), description: format.date(inv.dueDate) },
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
              {
                key: "qty",
                header: tCommon("quantity"),
                align: "end",
                cell: (line) => formatQty(line.quantity, locale),
              },
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
        <dl className="border-border bg-surface ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl border p-4 text-sm">
          <dt className="text-muted">{t("detail.subtotal")}</dt>
          <dd className="text-end tabular-nums">{format.thb(inv.subtotal)}</dd>
          <dt className="text-muted">{t("detail.vat", { rate: pct(inv.vatRatePct) })}</dt>
          <dd className="text-end tabular-nums">{format.thb(inv.vatAmount)}</dd>
          <dt className="border-border border-t pt-1.5 font-medium">{t("table.total")}</dt>
          <dd className="border-border border-t pt-1.5 text-end font-semibold tabular-nums">{format.thb(inv.total)}</dd>
          <dt className="text-muted">{t("detail.wht", { rate: pct(inv.whtRatePct) })}</dt>
          <dd className="text-end tabular-nums">{format.thb(inv.whtAmount)}</dd>
          <dt className="text-muted">{t("detail.paid")}</dt>
          <dd className="text-end tabular-nums">{format.thb(inv.paidAmount)}</dd>
        </dl>
        <PartnerSection title={t("detail.payments")}>
          <PartnerTable
            caption={t("detail.payments")}
            rows={inv.payments}
            rowKey={(p) => `${p.id}`}
            rowHref={(p) => `/payables/payments/${p.id}`}
            empty={<p className="text-muted text-sm">{t("detail.noPayments")}</p>}
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
      </PartnerDetail>
    </PartnerPage>
  );
}
