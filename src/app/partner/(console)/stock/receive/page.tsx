import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { GoodsReceiptForm } from "@/features/partner/erp/GoodsReceiptForm";
import { erpPickers } from "@/features/partner/erp/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { Row, RowList } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.move"))("receiveTitle") };
}

/**
 * Goods into stock (D-325): first which purchase order is being delivered (or none), then what arrived.
 * `?po=<id>` opens the order's open lines; `?po=none` a receipt without an order.
 */
export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const [{ po }, t, tStock, tPo, format, locale, context] = await Promise.all([
    searchParams,
    getTranslations("partnerErp.move"),
    getTranslations("partnerErp.stock"),
    getTranslations("partnerErp.purchasing"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [open, order, pickers] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
            params: { path, query: { status: "open", perPage: 100 } },
          })
        ).data!.data,
    ),
    po && po !== "none"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}", {
                params: { path: { ...path, poId: po } },
              })
            ).data!,
        )
      : Promise.resolve({ data: null, error: null }),
    erpPickers(context.factoryId),
  ]);
  const back = { href: "/stock", label: tStock("title") };
  const failed = open.error ?? order.error ?? pickers.error;
  if (failed || !open.data || !pickers.data)
    return (
      <PartnerPage title={t("receiveTitle")} back={back}>
        <PageError error={failed} />
      </PartnerPage>
    );

  // Which delivery is it? Open orders first, as big rows; "no purchase order" last.
  if (!po && open.data.length)
    return (
      <PartnerPage title={t("receiveTitle")} description={t("receiveBody")} back={back}>
        <RowList label={t("selectPurchaseOrder")}>
          {open.data.map((row) => (
            <Row
              key={row.id}
              href={`/stock/receive?po=${row.id}`}
              icon="cart"
              tone={row.late ? "danger" : "neutral"}
              title={`${row.poNo ?? ""} · ${row.supplier.name}`}
              meta={`${tPo("table.expected")} ${format.date(row.expectedOn)} · ${tPo("table.received")} ${formatPlain(row.receivedPct, locale, 0)}%`}
              aside={format.thb(row.total)}
            />
          ))}
          <Row href="/stock/receive?po=none" icon="package" title={t("noPurchaseOrder")} />
        </RowList>
      </PartnerPage>
    );

  return (
    <PartnerPage wide title={t("receiveTitle")} description={t("receiveBody")} back={back}>
      <GoodsReceiptForm
        key={order.data?.id ?? "none"}
        openOrders={open.data}
        order={order.data}
        items={pickers.data.items}
        suppliers={pickers.data.suppliers}
        warehouses={pickers.data.warehouses}
        locale={locale}
      />
    </PartnerPage>
  );
}
