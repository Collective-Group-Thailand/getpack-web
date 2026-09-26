import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getTracking } from "@/features/customer/catalog/api.server";
import { OrderStages } from "@/features/customer/fulfilment/OrderStages";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";

type Params = { token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const [t, tracking] = await Promise.all([getTranslations("fulfilment.track"), getTracking(token).catch(() => null)]);
  // A tracking link is shared, not published: never indexed.
  return {
    title: tracking ? t("titleFor", { code: tracking.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/**
 * The public tracking page (F3 3.6): for whoever holds the link or the carton's QR — stages
 * promised against actual and each delivery's progress, with no name, address, amount or photo.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const [t, shipmentT, format, tracking] = await Promise.all([
    getTranslations("fulfilment.track"),
    getTranslations("fulfilment.shipment"),
    getFormat(),
    getTracking(token),
  ]);
  if (!tracking) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm">{t("eyebrow")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{tracking.orderCode}</h1>
          <StatusChip map={ORDER_STATUS} value={tracking.status} size="md" />
        </div>
        <p className="text-muted">
          {t("what", {
            product: tracking.productName,
            quantity: format.number(tracking.quantity),
            unit: tracking.unit,
          })}
        </p>
        {tracking.estimatedDeliveryDate ? (
          <p className="text-sm">{t("eta", { date: format.date(tracking.estimatedDeliveryDate) })}</p>
        ) : null}
      </header>

      <section aria-labelledby="track-stages">
        <h2 id="track-stages" className="sr-only">
          {t("stages")}
        </h2>
        <OrderStages stages={tracking.stages} />
      </section>

      {tracking.shipments.length > 0 ? (
        <section aria-labelledby="track-shipments" className="flex flex-col gap-3">
          <h2 id="track-shipments" className="text-lg font-semibold">
            {t("shipments")}
          </h2>
          {tracking.shipments.map((shipment) => (
            <article key={shipment.shipmentNo} className="border-border rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">
                  {t("shipmentTo", {
                    quantity: format.number(shipment.quantity),
                    unit: tracking.unit,
                    province: shipment.province,
                  })}
                </h3>
                <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
              </div>
              <p className="text-muted mt-1 text-xs">
                {shipmentT(shipment.trackingNo ? "metaTracking" : "meta", {
                  shipment: shipment.shipmentNo,
                  carrier: shipmentT(`carrier.${shipment.carrier}`),
                  cartons: format.number(shipment.cartons),
                  tracking: shipment.trackingNo ?? "",
                })}
              </p>
              {shipment.trackingUrl ? (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline underline-offset-4"
                >
                  {shipmentT("carrierPage")}
                </a>
              ) : null}
              <ol className="mt-3 flex flex-col gap-1 text-sm">
                {[...shipment.events].reverse().map((event) => (
                  <li key={`${event.at}-${event.status}`} className="flex flex-wrap gap-x-3">
                    <time dateTime={event.at} className="text-muted tabular-nums">
                      {format.dateTime(event.at)}
                    </time>
                    <span>{shipmentT(`eventStatus.${event.status}`)}</span>
                    {event.location ? <span className="text-muted">{event.location}</span> : null}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      ) : null}

      <p className="text-muted text-xs">
        {t("updated", { date: format.dateTime(tracking.updatedAt) })}{" "}
        <Link href="/account/orders" className="text-primary underline underline-offset-4">
          {t("owner")}
        </Link>
      </p>
    </div>
  );
}
