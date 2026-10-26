import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_RECEIPT_STATUS, ERP_SALES_INVOICE_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { BillingActions } from "@/features/partner/sales/ReceivableForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ billingNoteId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.billing"))("title") };
}

/** One billing note (D-365): the customer, when it will be collected, and the invoices on it. */
export default async function BillingNotePage({ params }: Props) {
  const { billingNoteId } = await params;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.billing"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/billing-notes/{billingNoteId}", {
          params: { path: { factoryId: context.factoryId, billingNoteId } },
        })
      ).data!,
  );
  const back = { href: "/receivables?view=billing", label: t("back") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const bn = read.data;
  return (
    <PartnerPage full title={bn.billingNo} back={back} meta={<StatusChip map={ERP_RECEIPT_STATUS} value={bn.status} />}>
      <BillingActions billing={bn} />
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: tCommon("customer"), description: `${bn.customer.name} (${bn.customer.code})` },
            { term: t("form.billingDate"), description: format.date(bn.billingDate) },
            ...(bn.collectOn ? [{ term: t("form.collectOn"), description: format.date(bn.collectOn) }] : []),
            { term: tCommon("total"), description: format.thb(bn.total) },
            ...(bn.note ? [{ term: t("form.note"), description: bn.note }] : []),
            ...(bn.cancelReason ? [{ term: tCommon("reason"), description: bn.cancelReason }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("invoicesTitle")}>
        <PartnerTable
          caption={t("invoicesTitle")}
          rows={bn.lines}
          rowKey={(row) => row.invoice.id}
          columns={[
            {
              key: "iv",
              header: t("form.invoices"),
              primary: true,
              cell: (row) => (
                <Link className="tabular-nums" href={`/invoices/${row.invoice.id}`}>
                  {row.invoice.invoiceNo}
                </Link>
              ),
            },
            { key: "d", header: tCommon("date"), cell: (row) => format.date(row.issueDate) },
            { key: "due", header: tCommon("due"), cell: (row) => format.date(row.dueDate) },
            {
              key: "s",
              header: tCommon("status"),
              cell: (row) => <StatusChip map={ERP_SALES_INVOICE_STATUS} value={row.invoice.status} />,
            },
            { key: "a", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.amount) },
          ]}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
