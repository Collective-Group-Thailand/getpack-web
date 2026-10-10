import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_PURCHASE_ORDER_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerForm, PartnerStatusButton } from "@/features/partner/erp/PartnerForm";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

type Props = { params: Promise<{ partnerId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.partners"))("title") };
}

/** One supplier or customer (D-317): its details to edit, and the purchase orders with it. */
export default async function TradingPartnerPage({ params }: Props) {
  const { partnerId } = await params;
  const [t, tCommon, tPo, tPrices, format, context] = await Promise.all([
    getTranslations("partnerErp.partners"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerFactory.prices"),
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
  const unit = (code: string) => tCommon(`units.${code}` as never);
  const canEdit = canAt(context, "factory_trading_partners.manage");

  return (
    <PartnerPage
      wide
      title={partner.name}
      back={back}
      meta={
        <>
          <span className="text-muted font-mono">{partner.code}</span>
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
          {canEdit ? <PartnerStatusButton partner={partner} etag={etag} /> : null}
        </>
      }
    >
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
