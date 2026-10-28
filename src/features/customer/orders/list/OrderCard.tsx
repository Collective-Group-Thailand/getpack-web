"use client";

import { useLocale, useTranslations } from "next-intl";

import { ARTWORK_STATUS, CUSTOMER_ORDER_STATUS, statusMeta } from "@/domain/status";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";

import { deliveryDatesOf, isPaymentOverdue, visibleActions } from "../order-state";
import { productNameOf } from "../summary";
import { type CardAction, OrderCardActions } from "./OrderCardActions";
import { StageTracker } from "./StageTracker";

type Order = Schemas["OrderDto"];

/**
 * The card's actions for the current step (account pack Phase 2 item 4): an unpaid order leads with paying — or
 * with "ตรวจราคาใหม่และชำระ" once overdue (D-436) — and offers "ส่งไฟล์งาน" only when the customer owns the
 * artwork step (D-438); a delivered order with an open claim shows the claim; otherwise what the API offers.
 * `inPayFrame`: the group's frame already carries the payment action, so the card does not repeat it.
 */
export function cardActionsOf(order: Order, inPayFrame = false): CardAction[] {
  const offered = visibleActions(order, order.nextActions).filter((action) => !action.disabledReason);
  const keys = offered.map((action) => action.key);
  const out: CardAction[] = [];
  if (order.customerStatus === "awaiting_payment" && !inPayFrame) {
    out.push(
      isPaymentOverdue(order) ? { key: "requote" } : { key: "pay", href: `/account/orders/${order.id}#payment` },
    );
  }
  if (order.customerStatus === "claim_in_review" && order.openClaims[0]) {
    out.push({ key: "view_claim", href: `/account/orders/${order.id}/claims/${order.openClaims[0].id}` });
  }
  for (const key of keys) if (key !== "order.pay_instalment") out.push({ key });
  return out;
}

/**
 * One order in the account list (account pack Phase 2 item 4): picture, product, code, quantity and date, the
 * customer status (D-437), the artwork state while it matters (D-438), the due / ETA line (D-439), the total, one
 * primary action and the six-stage tracker. The whole card opens the order (its title link covers the card; the
 * actions sit above it). Every word and figure is the API's.
 */
export function OrderCard({
  order,
  placedAt,
  inPayFrame = false,
}: {
  order: Order;
  placedAt: string;
  inPayFrame?: boolean;
}) {
  const t = useTranslations("myOrders.list");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const format = useFormat();
  const overdue = isPaymentOverdue(order);
  const name = productNameOf(locale, order.summary);
  const unit = tCatalog(`stock.units.${order.summary.unit}`);
  const outcome = order.toleranceOutcome;
  const tStatus = useTranslations("status");
  const artworkKey = statusMeta(ARTWORK_STATUS, order.artworkStatus).labelKey;
  const artworkLabel = tStatus.has(`customer.${artworkKey}`) ? tStatus(`customer.${artworkKey}`) : tStatus(artworkKey);

  const dueLine =
    order.customerStatus === "cancelled"
      ? null
      : deliveryDatesOf(order) === "after_payment"
        ? t("due.afterPayment")
        : order.customerStatus === "shipping" && order.estimatedDeliveryDate
          ? t.rich("due.eta", {
              date: format.date(order.estimatedDeliveryDate),
              b: (chunk) => <b className="text-fg font-semibold">{chunk}</b>,
            })
          : outcome && order.receipt.deliveredAt
            ? t.rich(outcome.creditAmount && outcome.creditAmount !== "0.00" ? "due.receivedCredit" : "due.received", {
                received: format.number(outcome.deliveredQuantity),
                ordered: format.number(outcome.orderedQuantity),
                credit: outcome.creditAmount ? format.thb(outcome.creditAmount) : "",
                b: (chunk) => <b className="text-fg font-semibold tabular-nums">{chunk}</b>,
              })
            : order.receipt.deliveredAt
              ? t("due.deliveredOn", { date: format.date(order.receipt.deliveredAt) })
              : order.promisedShipDate && order.customerStatus !== "completed"
                ? t.rich("due.shipBy", {
                    date: format.date(order.promisedShipDate),
                    b: (chunk) => <b className="text-fg font-semibold">{chunk}</b>,
                  })
                : null;

  return (
    <article
      aria-labelledby={`order-${order.id}`}
      className="border-border bg-surface hover:border-border-strong focus-within:border-border-strong relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-[18px] border p-3.5 transition-colors sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:p-[1.125rem]"
    >
      <ProductThumb
        family={productFamilyOf(order.summary.productTypeCode)}
        className="size-14 rounded-[14px] sm:size-[4.5rem]"
      />
      <div className="min-w-0">
        <h3 className="text-base leading-snug font-semibold">
          <Link
            id={`order-${order.id}`}
            href={`/account/orders/${order.id}`}
            className="focus-visible:ring-focus-ring rounded-sm outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[''] focus-visible:ring-2"
          >
            {name}
          </Link>
        </h3>
        <p className="text-muted mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8125rem]">
          <span className="text-fg/80 tabular-nums">{order.orderCode}</span>
          <span className="tabular-nums">{t("qty", { quantity: format.number(order.quantityOrdered), unit })}</span>
          <span>{t("placedOn", { date: format.date(placedAt) })}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
          {overdue ? (
            <Badge size="sm" tone="danger" icon="clock">
              {t("overdue")}
            </Badge>
          ) : null}
          {order.artworkOwner !== null && order.customerStatus !== "cancelled" ? (
            <span className="bg-bg-subtle text-muted rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {t("file", { status: artworkLabel })}
            </span>
          ) : null}
          {dueLine ? <span className="text-muted text-[0.78125rem]">{dueLine}</span> : null}
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:text-end">
        <span className="text-lg font-bold tabular-nums">{format.thb(order.totals.grossAmount)}</span>
        <OrderCardActions
          orderId={order.id}
          orderCode={order.orderCode}
          status={order.customerStatus}
          groupId={order.payment.groupId}
          actions={cardActionsOf(order, inPayFrame)}
        />
      </div>
      <StageTracker status={order.customerStatus} overdue={overdue} className="col-span-full mt-1 sm:col-[2/-1]" />
    </article>
  );
}
