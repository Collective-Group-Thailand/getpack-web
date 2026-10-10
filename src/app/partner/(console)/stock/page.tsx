import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ReorderTable } from "@/features/partner/erp/ReorderTable";
import { formatQty } from "@/features/partner/erp/format";
import { ActionTiles, Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.stock"))("title") };
}

const VIEWS = ["items", "low", "movements"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * The factory's stock (Packio Factory ERP E1, D-316 – D-327): what is on hand and what it is worth,
 * what to buy now, and every movement — with the day's stock tasks as big tiles. Factory-private (D-317).
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "items";
  const page = pageOf(query.page);
  const [t, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerErp.stock"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const factoryId = context.factoryId;
  const path = { factoryId };
  const q = query.q?.trim() || undefined;

  const [overview, items, reorder, movements] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/stock/overview", { params: { path } })).data!,
    ),
    view === "items"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/items", {
                params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
              })
            ).data!,
        )
      : null,
    view === "low" && canAt(context, "factory_procurement.read")
      ? attempt(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/erp/stock/reorder", { params: { path } })).data!,
        )
      : null,
    view === "movements"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/stock/movements", {
                params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
              })
            ).data!,
        )
      : null,
  ]);

  const unit = (code: string) => tCommon(`units.${code}` as never);
  const qty = (value: string, code: string) => tCommon("inUnit", { qty: formatQty(value, locale), unit: unit(code) });
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/stock${queryOf({ view: next === "items" ? undefined : next, ...extra })}`;
  const pagination = {
    nav: tCommon("pagination.nav"),
    previous: tCommon("pagination.previous"),
    next: tCommon("pagination.next"),
    page: (n: number) => tCommon("pagination.page", { n }),
  };
  const canMove = canAt(context, "factory_inventory.manage");
  const canAdjust = canAt(context, "factory_inventory.adjust");

  const tiles = [
    ...(canMove
      ? [
          {
            key: "receive",
            href: "/stock/receive",
            icon: "package-check" as const,
            title: t("actions.receive"),
            hint: t("actions.receiveHint"),
            primary: true,
          },
          {
            key: "issue",
            href: "/stock/issue",
            icon: "package" as const,
            title: t("actions.issue"),
            hint: t("actions.issueHint"),
          },
        ]
      : []),
    ...(canAdjust
      ? [
          {
            key: "count",
            href: "/stock/count",
            icon: "checklist" as const,
            title: t("actions.count"),
            hint: t("actions.countHint"),
          },
        ]
      : []),
    ...(canMove
      ? [
          {
            key: "transfer",
            href: "/stock/transfer",
            icon: "route" as const,
            title: t("actions.transfer"),
            hint: t("actions.transferHint"),
          },
        ]
      : []),
  ];

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canMove ? (
          <Button asChild size="lg" variant="secondary" iconStart="plus">
            <Link href="/stock/items/new">{t("actions.newItem")}</Link>
          </Button>
        ) : undefined
      }
    >
      <Callout tone="info" icon="lock">
        {t("privacy")}
      </Callout>
      {overview.data ? (
        <StatStrip
          label={t("title")}
          items={[
            {
              key: "items",
              label: t("stats.items"),
              value: format.number(overview.data.items),
              ...(overview.data.negative
                ? { hint: t("stats.negative", { n: overview.data.negative }), tone: "danger" as const }
                : {}),
            },
            {
              key: "low",
              label: t("stats.low"),
              value: format.number(overview.data.low),
              href: href("low"),
              ...(overview.data.low ? { tone: "warning" as const } : {}),
            },
            { key: "value", label: t("stats.value"), value: format.thb(overview.data.value) },
            {
              key: "orders",
              label: t("stats.openOrders"),
              value: format.number(overview.data.openPurchaseOrders),
              href: "/purchasing",
              ...(overview.data.latePurchaseOrders
                ? { hint: t("stats.late", { n: overview.data.latePurchaseOrders }), tone: "danger" as const }
                : {}),
            },
          ]}
        />
      ) : (
        <PageError error={overview.error} />
      )}
      {tiles.length ? <ActionTiles label={t("actions.label")} items={tiles} /> : null}

      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({
          key,
          href: href(key),
          label: t(`views.${key}`),
          ...(key === "low" && overview.data ? { count: overview.data.low } : {}),
        }))}
      />

      {view === "items" && items ? (
        <>
          <SearchBar
            id="stock-q"
            action="/stock"
            q={q}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            button={tCommon("search")}
          />
          {items.data ? (
            <>
              <PartnerTable
                caption={t("views.items")}
                rows={items.data.data}
                rowKey={(item) => item.id}
                rowHref={(item) => `/stock/items/${item.id}`}
                rowTone={(item) =>
                  item.stock.onHand.startsWith("-") ? "danger" : item.stock.low ? "warning" : undefined
                }
                empty={<EmptyState icon="warehouse" title={t("emptyItems")} description={t("emptyItemsBody")} />}
                columns={[
                  {
                    key: "name",
                    header: t("table.name"),
                    primary: true,
                    cell: (item) => (
                      <span className="flex flex-col">
                        <span>{item.name}</span>
                        <span className="text-muted font-mono text-sm">{item.sku}</span>
                      </span>
                    ),
                  },
                  {
                    key: "kind",
                    header: t("table.kind"),
                    hideOnPhone: true,
                    cell: (item) => tCommon(`itemKinds.${item.kind}` as never),
                  },
                  {
                    key: "onHand",
                    header: t("table.onHand"),
                    align: "end",
                    cell: (item) => qty(item.stock.onHand, item.baseUnit),
                  },
                  {
                    key: "onOrder",
                    header: t("table.onOrder"),
                    align: "end",
                    hideOnPhone: true,
                    cell: (item) => (item.stock.onOrder === "0.000" ? "—" : qty(item.stock.onOrder, item.baseUnit)),
                  },
                  {
                    key: "value",
                    header: t("table.value"),
                    align: "end",
                    hideOnPhone: true,
                    cell: (item) => format.thb(item.stock.value),
                  },
                  {
                    key: "state",
                    header: t("table.state"),
                    cell: (item) =>
                      item.stock.onHand.startsWith("-") ? (
                        <Badge tone="danger">{tCommon("negative")}</Badge>
                      ) : item.stock.low ? (
                        <Badge tone="warning">{tCommon("low")}</Badge>
                      ) : (
                        <span className="text-muted text-sm">{t("ok")}</span>
                      ),
                  },
                ]}
              />
              <Pager
                page={page}
                perPage={PER_PAGE}
                total={items.data.meta.total}
                hrefFor={(n) => href("items", { q, page: n > 1 ? n : undefined })}
                labels={pagination}
              />
            </>
          ) : (
            <PageError error={items.error} />
          )}
        </>
      ) : null}

      {view === "low" ? (
        reorder?.data ? (
          reorder.data.length ? (
            <ReorderTable rows={reorder.data} canDraft={canAt(context, "factory_procurement.manage")} locale={locale} />
          ) : (
            <EmptyState icon="package-check" title={t("emptyLow")} description={t("emptyLowBody")} />
          )
        ) : reorder ? (
          <PageError error={reorder.error} />
        ) : (
          <EmptyState icon="lock" title={t("emptyLow")} />
        )
      ) : null}

      {view === "movements" && movements ? (
        <>
          <SearchBar
            id="moves-q"
            action="/stock"
            hidden={{ view: "movements" }}
            q={q}
            label={t("searchLabel")}
            placeholder={t("searchMovesPlaceholder")}
            button={tCommon("search")}
          />
          {movements.data ? (
            <>
              <PartnerTable
                caption={t("views.movements")}
                rows={movements.data.data}
                rowKey={(move) => move.id}
                rowHref={(move) =>
                  move.sourceType === "goods_receipt"
                    ? `/purchasing/receipts/${move.sourceId}`
                    : move.sourceType === "production_order"
                      ? `/planning/orders/${move.sourceId}`
                      : move.sourceType === "maintenance_order"
                        ? `/maintenance/${move.sourceId}`
                        : `/stock/items/${move.item.id}`
                }
                empty={<EmptyState icon="history" title={t("emptyMoves")} />}
                columns={[
                  {
                    key: "document",
                    header: t("table.document"),
                    primary: true,
                    cell: (move) => <span className="font-mono whitespace-nowrap">{move.documentNo}</span>,
                  },
                  {
                    key: "date",
                    header: t("table.date"),
                    className: "whitespace-nowrap",
                    cell: (move) => format.dateTime(move.occurredAt),
                  },
                  {
                    key: "kind",
                    header: t("table.movement"),
                    cell: (move) => tCommon(`movementKinds.${move.kind}` as never),
                  },
                  {
                    key: "item",
                    header: t("table.name"),
                    cell: (move) => (
                      <span className="flex flex-col">
                        <span>{move.item.name}</span>
                        <span className="text-muted text-sm">
                          {move.warehouse.name}
                          {move.lotNo ? ` · ${move.lotNo}` : ""}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "quantity",
                    header: t("table.quantity"),
                    align: "end",
                    cell: (move) => (
                      <span className={move.quantity.startsWith("-") ? "text-danger" : "text-success"}>
                        {move.quantity.startsWith("-") ? "" : "+"}
                        {qty(move.quantity, move.item.baseUnit)}
                      </span>
                    ),
                  },
                  {
                    key: "balance",
                    header: t("table.balance"),
                    align: "end",
                    hideOnPhone: true,
                    cell: (move) => qty(move.balanceAfter, move.item.baseUnit),
                  },
                  { key: "by", header: t("table.by"), hideOnPhone: true, cell: (move) => move.by },
                ]}
              />
              <Pager
                page={page}
                perPage={PER_PAGE}
                total={movements.data.meta.total}
                hrefFor={(n) => href("movements", { q, page: n > 1 ? n : undefined })}
                labels={pagination}
              />
            </>
          ) : (
            <PageError error={movements.error} />
          )}
        </>
      ) : null}
    </PartnerPage>
  );
}
