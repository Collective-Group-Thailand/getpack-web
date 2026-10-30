import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OrderStages } from "@/features/customer/fulfilment/OrderStages";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { pick } from "@/features/customer/catalog/localize";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { artworkNoteTextOf, visibleActions } from "@/features/customer/orders/order-state";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ARTWORK_STATUS, CUSTOMER_ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.order");
  return { title: t("title") };
}

/** One order in LINE (D-151): its stages, what to do next, and the site for everything else. */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { orderId } = await params;
  const locale = await getLocale();
  const [t, tCatalog, format, detail] = await Promise.all([
    getTranslations("liff.order"),
    getTranslations("catalog"),
    getFormat(),
    getMyOrder(orderId),
  ]);
  if (!detail) notFound();
  const { order } = detail;
  const actions = visibleActions(order, detail.actions);
  // D-436: past the deadline the price is checked again first, on the site — LINE does not pay it.
  const overdue = order.payment.overdue;
  const next = overdue ? undefined : detail.instalments.find((instalment) => instalment.payable);
  const due = next
    ? {
        id: next.id,
        groupId: next.groupId,
        label: pick(locale, next.labelTh, next.labelEn),
        grossAmount: next.openAmount,
        activePaymentId: next.activePaymentId,
      }
    : null;

  // The bar holds at most two buttons (the payment counts as one); any further action sits in the page.
  const barCount = due ? 1 : 2;
  const facts = [
    {
      term: t("quantity"),
      description: `${format.number(order.quantityOrdered)} ${tCatalog(`stock.units.${order.summary.unit}`)}`,
    },
    { term: t("total"), description: format.thb(order.totals.grossAmount), price: true },
    ...(order.deliveryDateBasis === "after_payment"
      ? [{ term: t("shipBy"), description: t("afterPayment") }]
      : [
          ...(order.promisedShipDate ? [{ term: t("shipBy"), description: format.date(order.promisedShipDate) }] : []),
          ...(order.estimatedDeliveryDate
            ? [{ term: t("eta"), description: format.date(order.estimatedDeliveryDate) }]
            : []),
        ]),
  ];

  // Project D: the order's facts as a 2×2 card, its stages in a card, and what to do now in the sticky bar above
  // the tabs — the thumb's reach in LINE — with the full order on the web as the last, quiet way on.
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader back={{ href: "/liff/orders", label: t("back") }} title={productNameOf(locale, order.summary)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted text-sm tabular-nums">{order.orderCode}</span>
          <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
          {order.artworkOwner !== null ? <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} /> : null}
        </div>
        {artworkNoteTextOf(locale, order) ? (
          <p className="text-muted text-sm">{artworkNoteTextOf(locale, order)}</p>
        ) : null}
      </LiffHeader>
      {overdue ? (
        <Callout tone="warning" role="status">
          {t("overdue")}
        </Callout>
      ) : null}
      <dl className="border-border bg-surface rounded-card grid grid-cols-2 gap-x-4 gap-y-3 border p-4">
        {facts.map((fact) => (
          <div key={fact.term} className="min-w-0">
            <dt className="text-muted text-xs">{fact.term}</dt>
            <dd className={cn("font-semibold tabular-nums", "price" in fact && fact.price && "text-primary")}>
              {fact.description}
            </dd>
          </div>
        ))}
      </dl>
      {detail.progress && detail.progress.steps.length > 0 ? (
        <section aria-labelledby="liff-stages" className="border-border bg-surface rounded-card border p-4">
          <h2 id="liff-stages" className="mb-3 font-semibold">
            {t("stages")}
          </h2>
          <OrderStages steps={detail.progress.steps} />
        </section>
      ) : null}
      {actions.length > barCount ? (
        <div className="[&_a]:min-h-12 [&_a]:w-full [&_button]:min-h-12 [&_button]:w-full [&>div]:flex-col [&>div]:items-stretch">
          <OrderActions
            orderId={order.id}
            orderCode={order.orderCode}
            actions={actions.slice(barCount)}
            size="md"
            surface="liff"
          />
        </div>
      ) : null}
      <Button asChild variant="secondary" size="lg" iconEnd="external">
        <Link href={`/account/orders/${order.id}`}>{t("full")}</Link>
      </Button>
      {actions.length > 0 || due ? (
        <MobileActionBar className="[&_a]:min-h-12 [&_button]:min-h-12 [&>div]:flex-col [&>div]:items-stretch">
          <OrderActions
            orderId={order.id}
            orderCode={order.orderCode}
            actions={actions.slice(0, barCount)}
            payable={due}
            size="md"
            surface="liff"
          />
        </MobileActionBar>
      ) : null}
    </div>
  );
}
