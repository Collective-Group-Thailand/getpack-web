import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_RFQ_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { QuoteEntry } from "@/features/partner/ops/QuoteEntry";
import { RfqActions } from "@/features/partner/ops/RfqActions";
import { RfqCompare } from "@/features/partner/ops/RfqCompare";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.rfqs"))("title") };
}

/**
 * One request for quotation (D-348): what was asked, of whom, their answers — recorded here — and the
 * comparison from which a supplier is picked per line into draft purchase orders.
 */
export default async function RfqPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const [{ rfqId }, t, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerOps.rfqs"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId, rfqId };
  const read = await attempt(async () => {
    const [rfq, comparison] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}", { params: { path } }),
      contract.GET("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/comparison", { params: { path } }),
    ]);
    return { rfq: rfq.data!, comparison: comparison.data! };
  });
  const back = { href: "/purchasing/rfqs", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { rfq, comparison } = read.data;
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const canAward = rfq.nextActions.some((a) => a.key === "erp_rfq.award" && !a.disabledReason);
  const canRecord = rfq.nextActions.some((a) => a.key === "erp_rfq.record" && !a.disabledReason);

  return (
    <PartnerPage
      full
      title={`${rfq.rfqNo} · ${rfq.title}`}
      back={back}
      meta={<StatusChip map={ERP_RFQ_STATUS} value={rfq.status} />}
      actions={<RfqActions rfq={rfq} />}
    >
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: t("facts.quoteBy"), description: format.date(rfq.quoteBy) },
            { term: t("facts.neededBy"), description: format.date(rfq.neededBy) },
            {
              term: t("facts.request"),
              description: rfq.purchaseRequest ? (
                <Link
                  href={`/purchasing/requests/${rfq.purchaseRequest.id}`}
                  className="text-primary font-mono underline-offset-4 hover:underline"
                >
                  {rfq.purchaseRequest.code}
                </Link>
              ) : (
                "—"
              ),
            },
            { term: t("facts.by"), description: `${rfq.createdBy} · ${format.dateTime(rfq.createdAt)}` },
            { term: t("facts.sentAt"), description: rfq.sentAt ? format.dateTime(rfq.sentAt) : "—" },
            ...(rfq.awardedAt ? [{ term: t("facts.awardedAt"), description: format.dateTime(rfq.awardedAt) }] : []),
            ...(rfq.note ? [{ term: t("facts.note"), description: rfq.note }] : []),
            ...(rfq.cancelReason ? [{ term: t("facts.cancelReason"), description: rfq.cancelReason }] : []),
          ]}
        />
      </Card>
      <PartnerSection title={t("linesTitle")}>
        <PartnerTable
          caption={t("linesTitle")}
          rows={rfq.lines}
          rowKey={(l) => l.id}
          columns={[
            { key: "no", header: "#", cell: (l) => l.lineNo },
            {
              key: "item",
              header: tCommon("item"),
              primary: true,
              cell: (l) => (
                <Link href={`/stock/items/${l.item.id}`} className="underline-offset-4 hover:underline">
                  {l.item.name}
                </Link>
              ),
            },
            {
              key: "qty",
              header: tCommon("quantity"),
              align: "end",
              cell: (l) => tCommon("inUnit", { qty: formatQty(l.quantity, locale), unit: unit(l.item.baseUnit) }),
            },
          ]}
        />
      </PartnerSection>
      <PartnerSection title={t("suppliersTitle")} description={t("suppliersBody")}>
        <QuoteEntry rfq={rfq} locale={locale} canRecord={canRecord && canAt(context, "factory_procurement.manage")} />
      </PartnerSection>
      {rfq.status !== "draft" ? (
        <PartnerSection title={t("compareTitle")} description={t("compareBody")}>
          <RfqCompare rfqId={rfq.id} comparison={comparison} canAward={canAward} locale={locale} />
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
