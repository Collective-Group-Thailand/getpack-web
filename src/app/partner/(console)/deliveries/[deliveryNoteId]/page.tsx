import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_DELIVERY_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { DeliveryActions } from "@/features/partner/sales/DeliveryForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ deliveryNoteId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.deliveries"))("title") };
}

/** One delivery note (D-362): the customer and order, what ships, at what cost once issued, and who received it. */
export default async function DeliveryPage({ params }: Props) {
  const { deliveryNoteId } = await params;
  const [t, tCommon, tUnits, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.deliveries"),
    getTranslations("partnerSales.common"),
    getTranslations("partnerErp.common.units"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET(
      "/v1/partner/factories/{factoryId}/erp/delivery-notes/{deliveryNoteId}",
      { params: { path: { factoryId: context.factoryId, deliveryNoteId } } },
    );
    return { doc: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/deliveries", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { doc, etag } = read.data;
  const issued = doc.status !== "draft";

  const tNext = await getTranslations("partnerSales.common");
  return (
    <PartnerPage
      full
      title={doc.doNo}
      back={back}
      status={
        <>
          <StatusChip map={ERP_DELIVERY_STATUS} value={doc.status} />
          {doc.invoiced ? <Badge tone="success">{t("invoiced")}</Badge> : null}
        </>
      }
    >
      <PartnerDetail
        aside={
          <ActionPanel id="next-steps" tone="neutral" title={tNext("nextSteps")}>
            <DeliveryActions delivery={doc} etag={etag} layout="panel" />
          </ActionPanel>
        }
      >
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              { term: tCommon("customer"), description: `${doc.customer.name} (${doc.customer.code})` },
              {
                term: t("table.salesOrder"),
                description: (
                  <Link className="text-primary underline" href={`/sales-orders/${doc.salesOrder.id}`}>
                    {doc.salesOrder.code}
                  </Link>
                ),
              },
              { term: t("table.deliverOn"), description: format.date(doc.deliverOn) },
              { term: t("facts.warehouse"), description: doc.warehouse.code },
              ...(doc.vehicle ? [{ term: t("facts.vehicle"), description: doc.vehicle }] : []),
              ...(doc.shipToAddress ? [{ term: t("facts.shipTo"), description: doc.shipToAddress }] : []),
              ...(doc.issuedAt ? [{ term: t("facts.issued"), description: format.dateTime(doc.issuedAt) }] : []),
              ...(doc.deliveredAt
                ? [
                    {
                      term: t("facts.delivered"),
                      description: t("receivedLine", {
                        name: doc.receivedBy ?? "",
                        at: format.dateTime(doc.deliveredAt),
                      }),
                    },
                  ]
                : []),
              ...(issued ? [{ term: t("facts.cost"), description: format.thb(doc.costTotal) }] : []),
              ...(doc.note ? [{ term: t("facts.note"), description: doc.note }] : []),
              ...(doc.cancelReason ? [{ term: tCommon("reason"), description: doc.cancelReason }] : []),
            ]}
          />
        </Card>
        <PartnerSection title={t("linesTitle")}>
          <PartnerTable
            caption={t("linesTitle")}
            rows={doc.lines}
            rowKey={(line) => line.id}
            columns={[
              {
                key: "item",
                header: t("lines.item"),
                primary: true,
                cell: (line) => (
                  <span className="flex flex-col">
                    <span>{line.description || line.item?.name}</span>
                    {line.item ? <span className="text-muted text-sm">{line.item.sku}</span> : null}
                  </span>
                ),
              },
              {
                key: "qty",
                header: t("lines.quantity"),
                align: "end",
                cell: (line) => `${formatQty(line.quantity, locale)} ${tUnits(line.unit as never)}`,
              },
              {
                key: "cost",
                header: t("lines.cost"),
                align: "end",
                hideOnPhone: true,
                cell: (line) => (line.costAmount ? format.thb(line.costAmount) : "—"),
              },
              {
                key: "invoiced",
                header: t("lines.invoiced"),
                align: "end",
                cell: (line) => formatQty(line.invoicedQty, locale),
              },
            ]}
          />
        </PartnerSection>
        <PostedEntries sourceId={doc.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
