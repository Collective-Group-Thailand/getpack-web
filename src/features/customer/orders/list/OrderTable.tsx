"use client";

import { useLocale, useTranslations } from "next-intl";

import { CUSTOMER_ORDER_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";

import { isPaymentOverdue } from "../order-state";
import { productNameOf } from "../summary";
import { cardActionsOf } from "./OrderCard";
import { OrderCardActions } from "./OrderCardActions";
import { PayGroupHeader } from "./PayGroupFrame";

type Order = Schemas["OrderDto"];

export interface OrderTableGroup {
  id: string;
  placedAt: string;
  /** Orders paid together and still unpaid: the group's own line (amount, deadline, one pay) heads its rows. */
  framed: boolean;
  orders: Order[];
}

/**
 * The orders as one table on a wide screen (Project B): order code and date, the product with its picture, the
 * customer status (D-437), the total, and the step's actions — the same ones the card offers (`cardActionsOf`).
 * Orders paid together sit under their group's line. Phones keep the cards (`OrderCard`); the page draws both and
 * shows one by width.
 */
export function OrderTable({ groups, className }: { groups: OrderTableGroup[]; className?: string }) {
  const t = useTranslations("myOrders.list");
  const tDetail = useTranslations("myOrders.detail");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const format = useFormat();
  const head = "text-muted px-4 py-3 text-start text-[0.8125rem] font-medium";
  return (
    <div className={className}>
      <div className="border-border bg-surface rounded-panel overflow-hidden border">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{t("title")}</caption>
          {/* The product takes the room it needs for a one-line name; status, total and the actions fit theirs. */}
          <colgroup>
            <col className="w-[46%]" />
            <col className="w-[19%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
          </colgroup>
          <thead className="bg-surface-subtle border-border border-b">
            <tr>
              <th scope="col" className={head}>
                {t("exportColumns.product")}
              </th>
              <th scope="col" className={head}>
                {t("exportColumns.status")}
              </th>
              <th scope="col" className={`${head} text-end`}>
                {t("exportColumns.total")}
              </th>
              <th scope="col" className={`${head} text-end`}>
                <span className="sr-only">{tDetail("todo")}</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => {
            const first = group.orders[0]!;
            return (
              <tbody key={group.id} className="divide-border border-border divide-y border-b last:border-b-0">
                {group.framed ? (
                  <tr className="bg-surface-subtle">
                    <td colSpan={4} className="px-2.5 py-1.5">
                      <PayGroupHeader payment={first.payment} firstOrderId={first.id} />
                    </td>
                  </tr>
                ) : null}
                {group.orders.map((order) => {
                  const name = productNameOf(locale, order.summary);
                  const unit = tCatalog(`stock.units.${order.summary.unit}`);
                  const overdue = isPaymentOverdue(order);
                  return (
                    <tr key={order.id} className="group hover:bg-surface-subtle relative align-middle">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3.5">
                          <ProductThumb
                            family={productFamilyOf(order.summary.productTypeCode)}
                            className="size-12 rounded-lg"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/account/orders/${order.id}`}
                              className="focus-visible:ring-focus-ring line-clamp-2 rounded-sm font-semibold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2"
                            >
                              {name}
                            </Link>
                            <p className="text-muted mt-0.5 flex flex-wrap gap-x-3 text-[0.78125rem] tabular-nums">
                              <span className="text-fg/80">{order.orderCode}</span>
                              <span>{t("qty", { quantity: format.number(order.quantityOrdered), unit })}</span>
                              <span>{t("placedOn", { date: format.date(group.placedAt) })}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
                          {overdue ? (
                            <Badge size="sm" tone="danger" icon="clock">
                              {t("overdue")}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="text-primary px-4 py-3.5 text-end font-semibold whitespace-nowrap tabular-nums">
                        {format.thb(order.totals.grossAmount)}
                      </td>
                      <td className="px-4 py-3.5">
                        <OrderCardActions
                          orderId={order.id}
                          orderCode={order.orderCode}
                          status={order.customerStatus}
                          groupId={order.payment.groupId}
                          actions={cardActionsOf(order, group.framed)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
