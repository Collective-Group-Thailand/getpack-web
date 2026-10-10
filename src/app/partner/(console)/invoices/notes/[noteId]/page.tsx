import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_ISSUED_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain, formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { NoteActions } from "@/features/partner/sales/NoteForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ noteId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.notes"))("title") };
}

/** One credit or debit note (D-364): against which invoice, why, the original and corrected values, the VAT. */
export default async function NotePage({ params }: Props) {
  const { noteId } = await params;
  const [t, tReasons, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.notes"),
    getTranslations("partnerSales.notes.reasons"),
    getTranslations("partnerSales.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-notes/{noteId}", {
          params: { path: { factoryId: context.factoryId, noteId } },
        })
      ).data!,
  );
  const back = { href: "/invoices?view=notes", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const note = read.data;
  return (
    <PartnerPage
      full
      title={note.noteNo ?? tCommon("draftNo")}
      description={t(`kinds.${note.kind}`)}
      back={back}
      meta={<StatusChip map={ERP_ISSUED_STATUS} value={note.status} />}
    >
      <NoteActions note={note} />
      {note.voidReason ? <Callout tone="danger" title={t("voidedTitle")}>{note.voidReason}</Callout> : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: tCommon("customer"), description: `${note.customer.name} (${note.customer.code})` },
            {
              term: t("invoice"),
              description: (
                <Link className="text-link underline" href={`/invoices/${note.invoice.id}`}>
                  {note.invoice.invoiceNo}
                </Link>
              ),
            },
            { term: t("issueDate"), description: format.date(note.issueDate) },
            { term: t("reason"), description: `${tReasons(note.reason)}${note.reasonText ? ` — ${note.reasonText}` : ""}` },
            { term: t("originalValue"), description: format.thb(note.originalValue) },
            { term: t("correctValue"), description: format.thb(note.correctValue) },
            { term: t("difference"), description: format.thb(note.difference) },
            ...(note.warehouse ? [{ term: t("warehouse"), description: note.warehouse.code }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("linesTitle")}>
        <PartnerTable
          caption={t("linesTitle")}
          rows={note.lines}
          rowKey={(line) => String(line.lineNo)}
          columns={[
            { key: "d", header: t("form.description"), primary: true, cell: (line) => line.description },
            {
              key: "ret",
              header: t("form.returnQty"),
              align: "end",
              hideOnPhone: true,
              cell: (line) => (line.returnQty ? formatQty(line.returnQty, locale) : "—"),
            },
            { key: "a", header: t("form.amount"), align: "end", cell: (line) => format.thb(line.amount) },
          ]}
        />
        <dl className="ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
          <dt className="text-muted">{tCommon("vat", { rate: formatPlain(note.vatRatePct, locale) })}</dt>
          <dd className="text-end">{format.thb(note.vatAmount)}</dd>
          <dt className="font-semibold">{tCommon("total")}</dt>
          <dd className="text-end text-lg font-semibold">{format.thb(note.total)}</dd>
        </dl>
      </PartnerSection>
    </PartnerPage>
  );
}
