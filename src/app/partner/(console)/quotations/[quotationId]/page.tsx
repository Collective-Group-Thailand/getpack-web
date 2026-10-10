import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_QUOTATION_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { QuotationActions } from "@/features/partner/sales/QuotationActions";
import { SalesLinesTable, SalesTotals } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ quotationId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.quotations"))("title") };
}

/** One quotation (D-360): the customer, validity, lines and totals, its revisions and what became of it. */
export default async function QuotationPage({ params }: Props) {
  const { quotationId } = await params;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.quotations"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/quotations/{quotationId}", {
      params: { path: { factoryId: context.factoryId, quotationId } },
    });
    return { doc: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/quotations", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { doc, etag } = read.data;

  return (
    <PartnerPage
      full
      title={doc.revision > 1 ? `${doc.quoteNo} (${t("revision", { n: doc.revision })})` : doc.quoteNo}
      back={back}
      meta={<StatusChip map={ERP_QUOTATION_STATUS} value={doc.status} />}
    >
      <QuotationActions quotation={doc} etag={etag} />
      {doc.status === "accepted" && doc.acceptedName ? (
        <Callout tone="success" title={t("acceptedBy", { name: doc.acceptedName })}>
          {t(doc.acceptedVia === "link" ? "acceptedOnline" : "acceptedRecorded", {
            date: doc.acceptedAt ? format.dateTime(doc.acceptedAt) : "",
            position: doc.acceptedPosition ?? "",
          })}
        </Callout>
      ) : null}
      {doc.rejectReason ? <Callout tone="danger" title={t("rejectedTitle")}>{doc.rejectReason}</Callout> : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: tCommon("customer"), description: `${doc.customer.name} (${doc.customer.code})` },
            { term: tCommon("salesperson"), description: doc.salesperson?.name ?? tCommon("noSalesperson") },
            { term: t("facts.date"), description: format.date(doc.quoteDate) },
            { term: t("facts.validUntil"), description: format.date(doc.validUntil) },
            { term: t("facts.paymentTerms"), description: tCommon("days", { n: doc.paymentTermDays }) },
            ...(doc.leadTimeDays != null
              ? [{ term: t("facts.leadTime"), description: tCommon("days", { n: doc.leadTimeDays }) }]
              : []),
            ...(doc.opportunity ? [{ term: t("facts.opportunity"), description: doc.opportunity.code }] : []),
            ...(doc.sentAt ? [{ term: t("facts.sent"), description: format.dateTime(doc.sentAt) }] : []),
            ...(doc.salesOrder
              ? [
                  {
                    term: t("facts.salesOrder"),
                    description: (
                      <Link className="text-link underline" href={`/sales-orders/${doc.salesOrder.id}`}>
                        {doc.salesOrder.code}
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(doc.terms ? [{ term: t("facts.terms"), description: doc.terms }] : []),
            ...(doc.note ? [{ term: t("facts.note"), description: doc.note }] : []),
            ...(doc.cancelReason ? [{ term: tCommon("reason"), description: doc.cancelReason }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("linesTitle")}>
        <SalesLinesTable caption={t("linesTitle")} lines={doc.lines} />
        <SalesTotals doc={doc} />
      </PartnerSection>
      {doc.revisions.length > 1 ? (
        <PartnerSection title={t("revisionsTitle")}>
          <ul className="flex flex-col gap-1">
            {doc.revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Link className="text-link underline" href={`/quotations/${r.id}`}>
                  {t("revision", { n: r.revision })}
                </Link>
                <StatusChip map={ERP_QUOTATION_STATUS} value={r.status} />
                <span className="tabular-nums">{format.thb(r.total)}</span>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
