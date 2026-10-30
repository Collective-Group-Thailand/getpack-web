import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_RECEIPT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ReceiptActions } from "@/features/partner/sales/ReceivableForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ receiptId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.receipts"))("title") };
}

/** One receipt or refund (D-365): how much came in and how, the customer's WHT, and the invoices it settled. */
export default async function ReceiptPage({ params }: Props) {
  const { receiptId } = await params;
  const [t, tCommon, tMethods, format, context] = await Promise.all([
    getTranslations("partnerSales.receipts"),
    getTranslations("partnerSales.common"),
    getTranslations("partnerSales.methods"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/receipts/{receiptId}", {
          params: { path: { factoryId: context.factoryId, receiptId } },
        })
      ).data!,
  );
  const back = { href: "/receivables?view=receipts", label: t("back") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const rc = read.data;
  const tNext = await getTranslations("partnerSales.common");
  return (
    <PartnerPage
      full
      title={rc.receiptNo}
      description={t(`kinds.${rc.kind}`)}
      back={back}
      status={<StatusChip map={ERP_RECEIPT_STATUS} value={rc.status} />}
    >
      <PartnerDetail
        aside={
          <ActionPanel id="next-steps" tone="neutral" title={tNext("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b pb-3">
              <dt className="text-muted text-sm">{t("form.amount")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(rc.amount)}</dd>
            </dl>
            <ReceiptActions receipt={rc} layout="panel" />
          </ActionPanel>
        }
      >
        {rc.cancelReason ? (
          <Callout tone="danger" title={t("cancelledTitle")}>
            {rc.cancelReason}
          </Callout>
        ) : null}
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              { term: tCommon("customer"), description: `${rc.customer.name} (${rc.customer.code})` },
              { term: t("form.receivedOn"), description: format.date(rc.receivedOn) },
              { term: t("form.method"), description: tMethods(rc.method) },
              ...(rc.reference ? [{ term: t("form.reference"), description: rc.reference }] : []),
              ...(rc.chequeNo
                ? [
                    {
                      term: t("form.chequeNo"),
                      description: `${rc.chequeNo} ${rc.chequeBank ?? ""} ${rc.chequeDate ? format.date(rc.chequeDate) : ""}`,
                    },
                  ]
                : []),
              { term: t("form.amount"), description: `${format.thb(rc.amount)} (${rc.amountInWords})` },
              ...(rc.whtAmount !== "0.00"
                ? [
                    {
                      term: t("form.wht"),
                      description: `${format.thb(rc.whtAmount)}${rc.whtCertNo ? ` · ${t("certLine", { no: rc.whtCertNo, date: rc.whtCertDate ? format.date(rc.whtCertDate) : "" })}` : ""}`,
                    },
                  ]
                : []),
              ...(rc.note ? [{ term: t("form.note"), description: rc.note }] : []),
            ]}
          />
        </Card>
        <PartnerSection title={t("allocationsTitle")}>
          <PartnerTable
            caption={t("allocationsTitle")}
            rows={rc.allocations}
            rowKey={(row) => row.invoice.id}
            columns={[
              {
                key: "iv",
                header: t("table.invoice"),
                primary: true,
                cell: (row) => (
                  <Link className="tabular-nums" href={`/invoices/${row.invoice.id}`}>
                    {row.invoice.invoiceNo}
                  </Link>
                ),
              },
              {
                key: "total",
                header: t("table.invoiceTotal"),
                align: "end",
                cell: (row) => format.thb(row.invoice.total),
              },
              { key: "amount", header: t("table.settled"), align: "end", cell: (row) => format.thb(row.amount) },
            ]}
          />
        </PartnerSection>
        <PostedEntries sourceId={rc.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
