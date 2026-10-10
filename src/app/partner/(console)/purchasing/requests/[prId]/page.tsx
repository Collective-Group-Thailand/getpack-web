import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PURCHASE_REQUEST_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { RequestActions } from "@/features/partner/erp/RequestActions";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.requests"))("title") };
}

/** One purchase request (D-336): its lines, the orders they became, who asked and who decided. */
export default async function PurchaseRequestPage({ params }: { params: Promise<{ prId: string }> }) {
  const [{ prId }, t, tCommon, format, locale, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.requests"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}", {
          params: { path: { factoryId: context.factoryId, prId } },
        })
      ).data!,
  );
  const back = { href: "/purchasing/requests", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const pr = read.data;
  const unit = (code: string) => tCommon(`units.${code}` as never);

  return (
    <PartnerPage
      wide
      title={pr.prNo}
      back={back}
      meta={<StatusChip map={ERP_PURCHASE_REQUEST_STATUS} value={pr.status} />}
      actions={<RequestActions request={pr} />}
    >
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: t("table.by"), description: pr.requestedBy },
            { term: t("table.source"), description: t(`sources.${pr.source}` as never) },
            { term: t("table.neededBy"), description: format.date(pr.neededBy) },
            { term: t("table.estimate"), description: <strong>{format.thb(pr.estimatedTotal)}</strong> },
            { term: t("submittedAt"), description: pr.submittedAt ? format.dateTime(pr.submittedAt) : "—" },
            {
              term: t("decided"),
              description: pr.decidedAt
                ? `${pr.decidedBy ?? ""} · ${format.dateTime(pr.decidedAt)}${pr.decisionNote ? ` — ${pr.decisionNote}` : ""}`
                : (pr.decisionNote ?? "—"),
            },
            { term: t("note"), description: pr.note ?? "—" },
          ]}
        />
      </Card>
      <PartnerSection title={t("linesTitle")} description={t("linesBody")}>
        <PartnerTable
          caption={t("linesTitle")}
          rows={pr.lines}
          rowKey={(line) => line.id}
          columns={[
            {
              key: "item",
              header: tCommon("item"),
              primary: true,
              cell: (line) => (
                <Link href={`/stock/items/${line.item.id}`} className="underline-offset-4 hover:underline">
                  {line.item.name}
                </Link>
              ),
            },
            {
              key: "qty",
              header: tCommon("quantity"),
              align: "end",
              cell: (line) =>
                tCommon("inUnit", { qty: formatQty(line.quantity, locale), unit: unit(line.item.baseUnit) }),
            },
            { key: "supplier", header: t("table.supplier"), cell: (line) => line.supplier?.name ?? t("usualSupplier") },
            {
              key: "amount",
              header: t("table.estimate"),
              align: "end",
              hideOnPhone: true,
              cell: (line) => (line.estimatedAmount ? format.thb(line.estimatedAmount) : "—"),
            },
            {
              key: "po",
              header: t("table.po"),
              cell: (line) =>
                line.purchaseOrder ? (
                  <Link
                    href={`/purchasing/${line.purchaseOrder.id}`}
                    className="font-mono underline-offset-4 hover:underline"
                  >
                    {line.purchaseOrder.code || t("draftPo")}
                  </Link>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
