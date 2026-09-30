import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { ConfirmReceipt } from "@/features/customer/fulfilment/ConfirmReceipt";
import { ShipmentCard } from "@/features/customer/fulfilment/ShipmentCard";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, detail] = await Promise.all([getTranslations("fulfilment.receipt"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: detail ? t("titleFor", { code: detail.order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * Receiving an order (F3 3.6): each delivery with its proof, and confirming receipt (D-081). A
 * problem goes to a claim within the window (D-082).
 *
 * CONTRACT-GAP store.receipt — the published order has no receipt block (when it was confirmed,
 * when it completes by itself, when the claim window ends) and no tolerance outcome (D-021, D-080),
 * so the page says what it can.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, detail] = await Promise.all([getTranslations("fulfilment.receipt"), getMyOrder(orderId)]);
  if (!detail) notFound();
  const { order } = detail;
  const canConfirm = detail.actions.some((action) => action.key === "order.confirm_receipt");
  const canClaim = detail.actions.some((action) => action.key === "order.open_claim");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: order.orderCode })}
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>
      {detail.shipments.length === 0 ? (
        <Callout tone="info">{t("notShipped")}</Callout>
      ) : (
        <section aria-labelledby="receipt-shipments" className="flex flex-col gap-3">
          <h2 id="receipt-shipments" className="text-lg font-semibold">
            {t("shipments")}
          </h2>
          {detail.shipments.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} orderCode={order.orderCode} />
          ))}
        </section>
      )}
      {order.status === "completed" ? (
        <Callout tone="success" title={t("confirmedTitle")}>
          {t("completedBody")}
        </Callout>
      ) : null}
      <div className="flex flex-col items-start gap-3">
        {canConfirm ? <ConfirmReceipt orderId={order.id} orderCode={order.orderCode} /> : null}
        {canClaim ? (
          <p className="text-sm">
            {t("problemNoDate")}{" "}
            <Link href={`/account/orders/${order.id}/claim`} className="text-primary underline underline-offset-4">
              {t("openClaim")}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
