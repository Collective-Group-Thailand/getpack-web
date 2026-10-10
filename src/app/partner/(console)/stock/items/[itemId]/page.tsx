import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { ItemForm, ItemStatusButton } from "@/features/partner/erp/ItemForm";
import { ItemSuppliers } from "@/features/partner/erp/ItemSuppliers";
import { erpSuppliers } from "@/features/partner/erp/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

type Props = { params: Promise<{ itemId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.stock"))("title") };
}

/** One stock item (D-320, D-321): what it is, how much is where, its latest movements, and its details. */
export default async function ItemPage({ params }: Props) {
  const { itemId } = await params;
  const [t, tStock, tCommon, tPrices, format, locale, context] = await Promise.all([
    getTranslations("partnerErp.item"),
    getTranslations("partnerErp.stock"),
    getTranslations("partnerErp.common"),
    getTranslations("partnerFactory.prices"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const item = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/items/{itemId}", {
      params: { path: { ...path, itemId } },
    });
    return { item: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/stock", label: tStock("title") };
  if (!item.data)
    return (
      <PartnerPage title={tStock("title")} back={back}>
        <PageError error={item.error} />
      </PartnerPage>
    );
  const { item: it, etag } = item.data;
  const canEdit = canAt(context, "factory_inventory.manage");
  const canPrice = canAt(context, "factory_procurement.manage");
  const [balances, moves, suppliers, links, history] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/stock", {
            params: { path, query: { q: it.sku, perPage: 100 } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/stock/movements", {
            params: { path, query: { itemId, perPage: 10 } },
          })
        ).data!,
    ),
    (canEdit || canPrice) && canAt(context, "factory_trading_partners.read")
      ? attempt(() => erpSuppliers(contract, context.factoryId))
      : Promise.resolve({ data: [] as never[], error: null }),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/items/{itemId}/suppliers", {
            params: { path: { ...path, itemId } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/items/{itemId}/prices", {
            params: { path: { ...path, itemId }, query: { perPage: 20 } },
          })
        ).data!,
    ),
  ]);
  const unit = (code: string | null) => (code ? tCommon(`units.${code}` as never) : "");
  const qty = (value: string, code = it.baseUnit) =>
    tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });
  const here = (balances.data?.data ?? []).filter((row) => row.item.id === it.id);

  return (
    <PartnerPage
      wide
      title={it.name}
      back={back}
      meta={
        <>
          <span className="text-muted font-mono">{it.sku}</span>
          <Badge tone="neutral">{tCommon(`itemKinds.${it.kind}` as never)}</Badge>
          {it.status === "archived" ? <Badge tone="neutral">{tCommon("archived")}</Badge> : null}
          {it.stock.low ? <Badge tone="warning">{tCommon("low")}</Badge> : null}
        </>
      }
      actions={
        canAt(context, "factory_inventory.manage") && it.status === "active" ? (
          <>
            <Button asChild size="lg" variant="secondary" iconStart="package">
              <Link href={`/stock/issue?item=${it.id}`}>{tStock("actions.issue")}</Link>
            </Button>
            {canAt(context, "factory_inventory.adjust") ? (
              <Button asChild size="lg" variant="secondary" iconStart="checklist">
                <Link href={`/stock/count?item=${it.id}`}>{tStock("actions.count")}</Link>
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: tStock("table.onHand"), description: <strong className="text-lg">{qty(it.stock.onHand)}</strong> },
            { term: tStock("table.available"), description: qty(it.stock.available) },
            { term: tStock("table.onOrder"), description: qty(it.stock.onOrder) },
            { term: tStock("table.value"), description: format.thb(it.stock.value) },
            { term: tStock("table.avgCost"), description: format.thb(it.stock.avgCost) },
            {
              term: t("facts.reorder"),
              description: it.reorderPoint
                ? `${qty(it.reorderPoint)} / ${it.reorderQty ? qty(it.reorderQty) : "—"}`
                : "—",
            },
            {
              term: t("facts.units"),
              description: it.purchaseUnit
                ? t("facts.unitsValue", {
                    base: unit(it.baseUnit),
                    purchase: unit(it.purchaseUnit),
                    factor: formatQty(it.purchaseFactor, locale),
                  })
                : t("facts.unitsSame", { base: unit(it.baseUnit) }),
            },
            { term: t("facts.supplier"), description: it.defaultSupplier?.name ?? t("noSupplier") },
            {
              term: t("facts.leadTime"),
              description: it.leadTimeDays === null ? "—" : t("facts.days", { n: it.leadTimeDays }),
            },
            {
              term: t("facts.lastPrice"),
              description: it.lastPurchasePrice
                ? t("facts.perUnit", {
                    price: format.thb(it.lastPurchasePrice),
                    unit: unit(it.purchaseUnit ?? it.baseUnit),
                  })
                : "—",
            },
            { term: t("facts.lots"), description: it.trackLots ? t("facts.lotsOn") : t("facts.lotsOff") },
          ]}
        />
      </Card>

      <PartnerSection title={tPrices("title")} description={tPrices("body")}>
        {links.data ? (
          <ItemSuppliers
            item={it}
            links={links.data}
            suppliers={(suppliers.data ?? []).filter((s) => s.status === "active")}
            canManage={canPrice && it.status === "active"}
            locale={locale}
          />
        ) : (
          <PageError error={links.error} />
        )}
      </PartnerSection>

      <PartnerSection title={tPrices("historyTitle")}>
        {history.data ? (
          <PartnerTable
            caption={tPrices("historyTitle")}
            rows={history.data.data}
            rowKey={(row) => row.id}
            empty={<EmptyState icon="history" title={tPrices("historyEmpty")} />}
            columns={[
              {
                key: "date",
                header: tPrices("table.date"),
                primary: true,
                className: "whitespace-nowrap",
                cell: (row) => format.date(row.pricedOn),
              },
              { key: "supplier", header: tPrices("table.supplier"), cell: (row) => row.supplier.name },
              {
                key: "source",
                header: tPrices("table.source"),
                cell: (row) => (
                  <span className="flex flex-col">
                    {tPrices(`sources.${row.source}` as never)}
                    {row.documentNo ? <span className="text-muted font-mono text-sm">{row.documentNo}</span> : null}
                  </span>
                ),
              },
              {
                key: "qty",
                header: tPrices("table.quantity"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => (row.quantity ? qty(row.quantity, row.unit) : "—"),
              },
              {
                key: "price",
                header: tPrices("table.price"),
                align: "end",
                cell: (row) => tPrices("perUnit", { price: format.thb(row.unitPrice), unit: unit(row.unit) }),
              },
              {
                key: "base",
                header: tPrices("table.basePrice", { unit: unit(it.baseUnit) }),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.baseUnitPrice),
              },
            ]}
          />
        ) : (
          <PageError error={history.error} />
        )}
      </PartnerSection>

      <PartnerSection title={t("stockTitle")}>
        {here.length ? (
          <PartnerTable
            caption={t("stockTitle")}
            rows={here}
            rowKey={(row) => row.warehouse.id}
            columns={[
              { key: "warehouse", header: tStock("table.warehouse"), primary: true, cell: (row) => row.warehouse.name },
              { key: "onHand", header: tStock("table.onHand"), align: "end", cell: (row) => qty(row.onHand) },
              { key: "value", header: tStock("table.value"), align: "end", cell: (row) => format.thb(row.value) },
            ]}
          />
        ) : (
          <EmptyState icon="warehouse" title={tStock("emptyMoves")} />
        )}
      </PartnerSection>

      <PartnerSection
        title={t("movesTitle")}
        actions={
          <Link
            href={`/stock?view=movements&q=${encodeURIComponent(it.sku)}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("allMoves")}
          </Link>
        }
      >
        {moves.data ? (
          <PartnerTable
            caption={t("movesTitle")}
            rows={moves.data.data}
            rowKey={(move) => move.id}
            empty={<EmptyState icon="history" title={tStock("emptyMoves")} />}
            columns={[
              {
                key: "document",
                header: tStock("table.document"),
                primary: true,
                cell: (move) => <span className="font-mono whitespace-nowrap">{move.documentNo}</span>,
              },
              { key: "date", header: tStock("table.date"), cell: (move) => format.dateTime(move.occurredAt) },
              {
                key: "kind",
                header: tStock("table.movement"),
                cell: (move) => tCommon(`movementKinds.${move.kind}` as never),
              },
              {
                key: "quantity",
                header: tStock("table.quantity"),
                align: "end",
                cell: (move) => (
                  <span className={move.quantity.startsWith("-") ? "text-danger" : "text-success"}>
                    {move.quantity.startsWith("-") ? "" : "+"}
                    {qty(move.quantity)}
                  </span>
                ),
              },
              { key: "balance", header: tStock("table.balance"), align: "end", cell: (move) => qty(move.balanceAfter) },
              {
                key: "warehouse",
                header: tStock("table.warehouse"),
                hideOnPhone: true,
                cell: (move) => move.warehouse.name,
              },
            ]}
          />
        ) : (
          <PageError error={moves.error} />
        )}
      </PartnerSection>

      {canEdit ? (
        <details className="border-border bg-surface rounded-xl border p-4 md:p-5">
          <summary className="cursor-pointer text-lg font-semibold">{t("editTitle")}</summary>
          <div className="mt-4 flex flex-col gap-6">
            <ItemForm item={it} etag={etag} suppliers={suppliers.data ?? []} />
            <div className="border-border flex flex-col items-start gap-2 border-t pt-4">
              <p className="text-muted text-sm">{t("archiveHint")}</p>
              <ItemStatusButton item={it} etag={etag} />
            </div>
          </div>
        </details>
      ) : null}
    </PartnerPage>
  );
}
