import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { ConfirmReceipt } from "@/features/customer/fulfilment/ConfirmReceipt";
import { ShipmentCard } from "@/features/customer/fulfilment/ShipmentCard";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, order] = await Promise.all([getTranslations("fulfilment.receipt"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: order ? t("titleFor", { code: order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * Receiving an order (F3 3.6): each delivery with its proof, what the delivered quantity meant
 * (D-021, D-080), and confirming receipt (D-081) — or the date it completes by itself. A problem
 * goes to a claim within the window (D-082).
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, tolerance, format, order] = await Promise.all([
    getTranslations("fulfilment.receipt"),
    getTranslations("myOrders.tolerance"),
    getFormat(),
    getMyOrder(orderId),
  ]);
  if (!order) notFound();
  const canConfirm = order.nextActions.some((action) => action.key === "order.confirm_receipt");
  const canClaim = order.nextActions.some((action) => action.key === "order.open_claim");
  const outcome = order.toleranceOutcome;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: order.orderCode })}
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>

      {order.shipments.length === 0 ? (
        <Callout tone="info">{t("notShipped")}</Callout>
      ) : (
        <section aria-labelledby="receipt-shipments" className="flex flex-col gap-3">
          <h2 id="receipt-shipments" className="text-lg font-semibold">
            {t("shipments")}
          </h2>
          {order.shipments.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} unit={order.unit} />
          ))}
        </section>
      )}

      {outcome ? (
        <Callout
          tone={
            outcome.outcome === "outside_claim_opened" ? "warning" : outcome.outcome === "exact" ? "success" : "info"
          }
          title={t("quantityTitle")}
        >
          {tolerance(outcome.outcome, {
            ordered: format.number(outcome.orderedQuantity),
            delivered: format.number(outcome.deliveredQuantity),
            credit: format.thb(outcome.creditAmount),
          })}
          {outcome.creditAmount ? (
            <span className="mt-1 block">
              <Link href="/account/wallet" className="underline underline-offset-4">
                {t("creditLink")}
              </Link>
            </span>
          ) : null}
        </Callout>
      ) : null}

      {order.receipt?.confirmedAt ? (
        <Callout tone="success" title={t("confirmedTitle")}>
          {t("confirmed", { date: format.dateTime(order.receipt.confirmedAt) })}
        </Callout>
      ) : null}

      <div className="flex flex-col items-start gap-3">
        {canConfirm ? (
          <>
            {order.receipt?.autoCompleteAt ? (
              <p className="text-muted text-sm">{t("auto", { date: format.dateTime(order.receipt.autoCompleteAt) })}</p>
            ) : null}
            <ConfirmReceipt orderId={order.id} orderCode={order.orderCode} />
          </>
        ) : null}
        {canClaim && order.receipt?.claimWindowEndsAt ? (
          <p className="text-sm">
            {t("problem", { date: format.dateTime(order.receipt.claimWindowEndsAt) })}{" "}
            <Link href={`/account/orders/${order.id}/claim`} className="text-primary underline underline-offset-4">
              {t("openClaim")}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
