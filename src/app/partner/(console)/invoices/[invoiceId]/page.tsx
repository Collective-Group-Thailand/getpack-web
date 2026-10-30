import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_ISSUED_STATUS, ERP_RECEIPT_STATUS, ERP_SALES_INVOICE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { InvoiceActions } from "@/features/partner/sales/InvoiceForms";
import { SalesLinesTable, SalesTotals } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ invoiceId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.invoices"))("title") };
}

/**
 * One invoice / tax invoice (D-363): seller and buyer as printed, lines and totals, what has been received,
 * credited or debited, and what is still owed.
 */
export default async function InvoicePage({ params }: Props) {
  const { invoiceId } = await params;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.invoices"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-invoices/{invoiceId}", {
      params: { path: { factoryId: context.factoryId, invoiceId } },
    });
    return { doc: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/invoices", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { doc, etag } = read.data;
  const settledRows = [
    ...(doc.debitedAmount !== "0.00" ? [{ label: t("debited"), value: doc.debitedAmount }] : []),
    ...(doc.creditedAmount !== "0.00" ? [{ label: t("credited"), value: `-${doc.creditedAmount}` }] : []),
    ...(doc.receivedAmount !== "0.00" ? [{ label: t("received"), value: `-${doc.receivedAmount}` }] : []),
    ...(doc.status !== "draft" && doc.status !== "voided"
      ? [{ label: tCommon("open"), value: doc.openAmount, strong: true }]
      : []),
  ];

  return (
    <PartnerPage
      full
      title={doc.invoiceNo ?? tCommon("draftNo")}
      description={t(doc.isTaxInvoice ? `kinds.${doc.form}Tax` : `kinds.${doc.form}`)}
      back={back}
      status={
        <>
          <StatusChip map={ERP_SALES_INVOICE_STATUS} value={doc.status} />
          {doc.overdue ? <Badge tone="danger">{tCommon("overdue")}</Badge> : null}
        </>
      }
    >
      {/* The invoice as a document on the left; what it comes to, what is still owed and what to do next on the right. */}
      <PartnerDetail
        aside={
          <ActionPanel id="iv-next" tone="neutral" title={tCommon("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3">
              <dt className="text-muted text-sm">{tCommon("total")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(doc.total)}</dd>
              {doc.status !== "draft" && doc.status !== "voided" ? (
                <>
                  <dt className="text-muted text-sm">{tCommon("open")}</dt>
                  <dd className="text-end tabular-nums">{format.thb(doc.openAmount)}</dd>
                </>
              ) : null}
              <dt className="text-muted text-sm">{t("facts.dueDate")}</dt>
              <dd className={doc.overdue ? "text-danger text-end tabular-nums" : "text-end tabular-nums"}>
                {format.date(doc.dueDate)}
              </dd>
            </dl>
            <InvoiceActions invoice={doc} etag={etag} layout="panel" />
          </ActionPanel>
        }
      >
        {doc.voidReason ? (
          <Callout tone="danger" title={t("voidedTitle")}>
            {doc.voidReason}
          </Callout>
        ) : null}
        <Card padding="md">
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <DescriptionList
              columns={1}
              items={[
                { term: t("buyer"), description: doc.buyer.name },
                ...(doc.buyer.address ? [{ term: t("address"), description: doc.buyer.address }] : []),
                ...(doc.buyer.taxId
                  ? [
                      {
                        term: t("taxId"),
                        description: `${doc.buyer.taxId} ${doc.buyer.branchCode === "00000" ? t("headOffice") : doc.buyer.branchCode ? t("branch", { code: doc.buyer.branchCode }) : ""}`,
                      },
                    ]
                  : []),
              ]}
            />
            <DescriptionList
              columns={2}
              items={[
                { term: t("facts.issueDate"), description: format.date(doc.issueDate) },
                { term: t("facts.dueDate"), description: format.date(doc.dueDate) },
                { term: t("facts.paymentTerms"), description: tCommon("days", { n: doc.paymentTermDays }) },
                ...(doc.customerPoNo ? [{ term: t("facts.customerPoNo"), description: doc.customerPoNo }] : []),
                ...(doc.salesOrder
                  ? [
                      {
                        term: t("facts.salesOrder"),
                        description: (
                          <Link className="text-primary underline" href={`/sales-orders/${doc.salesOrder.id}`}>
                            {doc.salesOrder.code}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(doc.deliveryNotes.length
                  ? [
                      {
                        term: t("facts.deliveries"),
                        description: (
                          <span className="flex flex-wrap gap-2">
                            {doc.deliveryNotes.map((d) => (
                              <Link
                                key={d.id}
                                className="text-primary tabular-nums underline"
                                href={`/deliveries/${d.id}`}
                              >
                                {d.doNo}
                              </Link>
                            ))}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(doc.salesperson ? [{ term: tCommon("salesperson"), description: doc.salesperson.name }] : []),
                ...(doc.note ? [{ term: t("facts.note"), description: doc.note }] : []),
              ]}
            />
          </div>
        </Card>
        <PartnerSection title={t("linesTitle")}>
          <SalesLinesTable caption={t("linesTitle")} lines={doc.lines} />
          <SalesTotals doc={doc} extra={settledRows} />
          {doc.status !== "draft" ? (
            <p className="text-muted text-end text-sm">{tCommon("inWords", { words: doc.totalInWords })}</p>
          ) : null}
        </PartnerSection>
        <div className="grid gap-6 xl:grid-cols-2">
          <PartnerSection title={t("receiptsTitle")}>
            {doc.receipts.length ? (
              <RowList label={t("receiptsTitle")}>
                {doc.receipts.map((r) => (
                  <Row
                    key={r.id}
                    href={`/receivables/receipts/${r.id}`}
                    icon="coins"
                    title={<span className="tabular-nums">{r.receiptNo}</span>}
                    meta={
                      <span className="flex items-center gap-2">
                        {format.date(r.receivedOn)}
                        <StatusChip map={ERP_RECEIPT_STATUS} value={r.status} />
                      </span>
                    }
                    aside={format.thb(r.amount)}
                  />
                ))}
              </RowList>
            ) : (
              <p className="text-muted text-sm">{t("noReceipts")}</p>
            )}
          </PartnerSection>
          <PartnerSection title={t("notesTitle")}>
            {doc.notes.length ? (
              <RowList label={t("notesTitle")}>
                {doc.notes.map((n) => (
                  <Row
                    key={n.id}
                    href={`/invoices/notes/${n.id}`}
                    icon="receipt"
                    title={
                      <span className="tabular-nums">
                        {n.noteNo ?? `${t(`noteKinds.${n.kind}`)} ${tCommon("draftNo")}`}
                      </span>
                    }
                    meta={<StatusChip map={ERP_ISSUED_STATUS} value={n.status} />}
                    aside={format.thb(n.total)}
                  />
                ))}
              </RowList>
            ) : (
              <p className="text-muted text-sm">{t("noNotes")}</p>
            )}
          </PartnerSection>
        </div>
        <PostedEntries sourceId={doc.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
