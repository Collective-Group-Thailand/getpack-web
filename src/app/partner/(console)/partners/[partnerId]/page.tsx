import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_PURCHASE_ORDER_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerForm, PartnerStatusButton } from "@/features/partner/erp/PartnerForm";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { RelatedDocuments } from "@/features/partner/ops/RelatedDocuments";
import { queryOf } from "@/features/partner/erp/ui";
import { StatStrip } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

type Props = { params: Promise<{ partnerId: string }> };

const dec = (v: string) => Number(v);
/** Sums money strings in satang, so 0.1 + 0.2 stays 0.30. */
const sum = (values: string[]) => {
  const satang = values.reduce((total, v) => total + Math.round(Number(v) * 100), 0);
  return (satang / 100).toFixed(2);
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.partners"))("title") };
}

/** One supplier or customer (D-317): its details to edit, and the purchase orders with it. */
export default async function TradingPartnerPage({ params }: Props) {
  const { partnerId } = await params;
  const [t, tCommon, tPo, tPrices, tSourcing, format, context] = await Promise.all([
    getTranslations("partnerErp.partners"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerFactory.prices"),
    getTranslations("partnerOps.sourcing"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}", {
      params: { path: { ...path, partnerId } },
    });
    return { partner: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/partners", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { partner, etag } = read.data;
  const buysFrom = partner.kind !== "customer" && canAt(context, "factory_procurement.read");
  const orders = buysFrom
    ? await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
              params: { path, query: { supplierId: partner.id, perPage: 20 } },
            })
          ).data!,
      )
    : null;
  const items =
    partner.kind !== "customer" && canAt(context, "factory_inventory.read")
      ? await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}/items", {
                params: { path: { ...path, partnerId } },
              })
            ).data!,
        )
      : null;
  // D-349: the supplier's 12-month score and its latest rejections.
  const card =
    partner.kind !== "customer" && canAt(context, "factory_trading_partners.read")
      ? await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}/scorecard", {
                params: { path: { ...path, partnerId } },
              })
            ).data!,
        )
      : null;
  // What is open with this partner: what we owe them (supplier invoices) and what they owe us (sales invoices).
  const [payables, receivables] = await Promise.all([
    partner.kind !== "customer" && canAt(context, "factory_ap.read")
      ? attempt(async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-invoices", {
              params: { path, query: { supplierId: partner.id, perPage: 100 } },
            })
          ).data!.data.filter((inv) => dec(inv.outstanding) > 0),
        ).then((r) => r.data)
      : null,
    partner.kind !== "supplier" && canAt(context, "factory_receivables.read")
      ? attempt(async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-invoices", {
              params: { path, query: { customerId: partner.id, perPage: 100 } },
            })
          ).data!.data.filter((inv) => dec(inv.openAmount) > 0),
        ).then((r) => r.data)
      : null,
  ]);
  const pct = (value: string | null) => (value ? `${Number(value).toFixed(1)}%` : "—");
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const canEdit = canAt(context, "factory_trading_partners.manage");

  const [tSales, tOpen] = await Promise.all([
    getTranslations("partnerSales.partner"),
    getTranslations("partnerErp.partners.open"),
  ]);
  return (
    <PartnerPage
      wide
      title={partner.name}
      back={back}
      meta={
        <>
          <span className="text-muted tabular-nums">{partner.code}</span>
          <Badge tone="neutral">{tCommon(`partnerKinds.${partner.kind}`)}</Badge>
          {partner.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
        </>
      }
      actions={
        <>
          {buysFrom && canAt(context, "factory_procurement.manage") && partner.status === "active" ? (
            <Button asChild size="lg" iconStart="cart">
              <Link href={`/purchasing/new?supplier=${partner.id}`}>{tPo("new")}</Link>
            </Button>
          ) : null}
          {partner.kind !== "supplier" && partner.status === "active" && canAt(context, "factory_sales.manage") ? (
            <>
              <Button asChild size="lg" iconStart="document">
                <Link href={`/quotations/new?customer=${partner.id}`}>{tSales("newQuotation")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" iconStart="cart">
                <Link href={`/sales-orders/new?customer=${partner.id}`}>{tSales("newOrder")}</Link>
              </Button>
            </>
          ) : null}
          {partner.kind !== "supplier" && canAt(context, "factory_receivables.manage") ? (
            <Button asChild size="lg" variant="secondary" iconStart="coins">
              <Link href={`/receivables/receipts/new?customer=${partner.id}`}>{tSales("receive")}</Link>
            </Button>
          ) : null}
          {canEdit ? <PartnerStatusButton partner={partner} etag={etag} /> : null}
        </>
      }
    >
      {payables?.length || receivables?.length ? (
        <PartnerSection title={tOpen("title")} description={tOpen("body")}>
          <StatStrip
            label={tOpen("title")}
            items={[
              ...(payables?.length
                ? [
                    {
                      key: "ap",
                      label: tOpen("weOwe"),
                      value: format.thb(sum(payables.map((i) => i.outstanding))),
                      hint: tOpen("invoices", { count: payables.length }),
                      href: `/payables${queryOf({ q: partner.name })}`,
                    },
                    ...(payables.some((i) => i.overdue)
                      ? [
                          {
                            key: "apLate",
                            label: tOpen("overdue"),
                            value: format.thb(sum(payables.filter((i) => i.overdue).map((i) => i.outstanding))),
                            tone: "danger" as const,
                          },
                        ]
                      : []),
                  ]
                : []),
              ...(receivables?.length
                ? [
                    {
                      key: "ar",
                      label: tOpen("theyOwe"),
                      value: format.thb(sum(receivables.map((i) => i.openAmount))),
                      hint: tOpen("invoices", { count: receivables.length }),
                      href: `/receivables${queryOf({ q: partner.name })}`,
                    },
                    ...(receivables.some((i) => i.overdue)
                      ? [
                          {
                            key: "arLate",
                            label: tOpen("overdue"),
                            value: format.thb(sum(receivables.filter((i) => i.overdue).map((i) => i.openAmount))),
                            tone: "danger" as const,
                          },
                        ]
                      : []),
                  ]
                : []),
            ]}
          />
        </PartnerSection>
      ) : null}
      {card?.data ? (
        <PartnerSection title={tSourcing("scoreTitle")} description={tSourcing("scoreBody")}>
          <StatStrip
            label={tSourcing("scoreTitle")}
            items={[
              {
                key: "score",
                label: tSourcing("score.score"),
                value: card.data.score ? `${Number(card.data.score).toFixed(1)}` : "—",
                hint: card.data.grade ? tSourcing("grade", { grade: card.data.grade }) : tSourcing("noGrade"),
                tone: card.data.grade === "A" ? "success" : card.data.grade === "D" ? "danger" : "neutral",
              },
              { key: "quality", label: tSourcing("score.quality"), value: pct(card.data.qualityPct) },
              { key: "onTime", label: tSourcing("score.onTime"), value: pct(card.data.onTimePct) },
              { key: "receipts", label: tSourcing("score.receipts"), value: card.data.receipts },
              {
                key: "rejected",
                label: tSourcing("score.rejectedLines"),
                value: card.data.rejectedLines,
                tone: card.data.rejectedLines ? "warning" : "neutral",
              },
              { key: "approved", label: tSourcing("score.approvedItems"), value: card.data.approvedItems },
              { key: "pending", label: tSourcing("score.pendingItems"), value: card.data.pendingItems },
            ]}
          />
          {card.data.rejections.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">{tSourcing("rejectionsTitle")}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {card.data.rejections.map((r) => (
                  <li key={`${r.goodsReceipt.id}-${r.item.id}`}>
                    <Link
                      href={`/purchasing/receipts/${r.goodsReceipt.id}`}
                      className="tabular-nums underline-offset-4 hover:underline"
                    >
                      {r.goodsReceipt.code}
                    </Link>
                    {" · "}
                    {tSourcing("rejectionLine", {
                      date: format.date(r.receivedOn),
                      item: r.item.name,
                      qty: tCommon("inUnit", { qty: r.rejectedQuantity.replace(/\.?0+$/, ""), unit: unit(r.unit) }),
                    })}
                    {r.reason ? (
                      <span className="text-muted"> {tSourcing("rejectionReason", { reason: r.reason })}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </PartnerSection>
      ) : null}
      {items ? (
        <PartnerSection title={tPrices("supplierItems")}>
          {items.data ? (
            <PartnerTable
              caption={tPrices("supplierItems")}
              rows={items.data}
              rowKey={(link) => link.id}
              rowHref={(link) => `/stock/items/${link.item.id}`}
              empty={<EmptyState icon="tag" title={tPrices("supplierItemsEmpty")} />}
              columns={[
                {
                  key: "item",
                  header: tPrices("table.item"),
                  primary: true,
                  cell: (link) => (
                    <span className="flex flex-col">
                      {link.item.name}
                      <span className="text-muted text-sm">
                        {link.item.sku}
                        {link.supplierSku ? ` · ${tPrices("theirCode", { code: link.supplierSku })}` : ""}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "price",
                  header: tPrices("lastPrice"),
                  align: "end",
                  cell: (link) =>
                    link.lastPrice
                      ? tPrices("perUnit", { price: format.thb(link.lastPrice), unit: unit(link.purchaseUnit) })
                      : "—",
                },
                {
                  key: "date",
                  header: tPrices("table.date"),
                  hideOnPhone: true,
                  cell: (link) => format.date(link.lastPricedOn),
                },
                {
                  key: "flags",
                  header: tPrices("table.flags"),
                  cell: (link) => (
                    <span className="flex flex-wrap gap-1">
                      {link.preferred ? <Badge tone="primary">{tPrices("preferred")}</Badge> : null}
                      {link.cheapest ? <Badge tone="success">{tPrices("cheapest")}</Badge> : null}
                      {link.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
                    </span>
                  ),
                },
              ]}
            />
          ) : (
            <PageError error={items.error} />
          )}
        </PartnerSection>
      ) : null}
      {orders ? (
        <PartnerSection title={t("detail.orders")}>
          {orders.data ? (
            <PartnerTable
              caption={t("detail.orders")}
              rows={orders.data.data}
              rowKey={(po) => po.id}
              rowHref={(po) => `/purchasing/${po.id}`}
              empty={<EmptyState icon="cart" title={t("detail.noOrders")} />}
              columns={[
                { key: "no", header: tPo("table.no"), primary: true, cell: (po) => po.poNo ?? tPo("draftNo") },
                { key: "date", header: tPo("table.ordered"), cell: (po) => format.date(po.orderedOn) },
                { key: "total", header: tPo("table.total"), align: "end", cell: (po) => format.thb(po.total) },
                {
                  key: "status",
                  header: tPo("table.status"),
                  cell: (po) => <StatusChip map={ERP_PURCHASE_ORDER_STATUS} value={po.status} />,
                },
              ]}
            />
          ) : (
            <PageError error={orders.error} />
          )}
        </PartnerSection>
      ) : null}
      <RelatedDocuments type="trading_partner" id={partner.id} label={partner.name} />
      <PartnerSection title={t("form.editTitle")}>
        {canEdit ? (
          <PartnerForm partner={partner} etag={etag} />
        ) : (
          <p className="text-muted">
            {[partner.contactName, partner.phone, partner.email, partner.address].filter(Boolean).join(" · ")}
          </p>
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
