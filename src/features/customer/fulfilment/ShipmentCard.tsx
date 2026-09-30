import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SHIPMENT_STATUS } from "@/domain/status";
import type { Schemas } from "@/lib/api/types";

type Shipment = Schemas["StoreShipmentDto"];

/**
 * One delivery (F3 3.6): where it went, how many of this order, the carrier's progress and — once
 * delivered — who received it. The recipient's name is the customer's own data, shown here and
 * never on the public tracking page.
 *
 * CONTRACT-GAP store.orders — the proof of delivery names its photos by file id only, so the card
 * says how many there are.
 */
export async function ShipmentCard({ shipment, orderCode }: { shipment: Shipment; orderCode: string }) {
  const [t, format] = await Promise.all([getTranslations("fulfilment.shipment"), getFormat()]);
  const item = shipment.items.find((entry) => entry.orderCode === orderCode) ?? shipment.items[0];
  return (
    <article aria-labelledby={`shipment-${shipment.id}`} className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`shipment-${shipment.id}`} className="font-medium">
          {t("toNoUnit", {
            quantity: format.number(item?.quantity ?? 0),
            name: shipment.destination.recipientName,
            postcode: shipment.destination.postcode,
          })}
        </h3>
        <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
      </div>
      <p className="text-muted mt-1 text-xs">
        {t(shipment.trackingNo ? "metaTracking" : "meta", {
          shipment: shipment.shipmentNo,
          carrier: t(`carrier.${shipment.carrier}`),
          cartons: format.number(shipment.cartonsCount),
          tracking: shipment.trackingNo ?? "",
        })}
      </p>
      {shipment.trackingUrl ? (
        <a
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-1 inline-block text-sm underline underline-offset-4"
        >
          {t("carrierPage")}
        </a>
      ) : null}
      {shipment.events.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="text-primary cursor-pointer">{t("events", { count: shipment.events.length })}</summary>
          <ol className="mt-2 flex flex-col gap-1">
            {[...shipment.events].reverse().map((event) => (
              <li key={`${event.occurredAt}-${event.status}`} className="flex flex-wrap gap-x-3">
                <time dateTime={event.occurredAt} className="text-muted tabular-nums">
                  {format.dateTime(event.occurredAt)}
                </time>
                <span>{t(`eventStatus.${event.status}`)}</span>
                {event.location ? <span className="text-muted">{event.location}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {shipment.proofOfDelivery ? (
        <div className="bg-surface-subtle mt-3 rounded-md p-3 text-sm">
          <p>
            {t("podNoUnit", {
              name: shipment.proofOfDelivery.receiverName,
              quantity: format.number(item?.deliveredQuantity ?? item?.quantity ?? 0),
              date: format.dateTime(shipment.proofOfDelivery.capturedAt),
            })}
          </p>
          {shipment.proofOfDelivery.photoFileIds.length > 0 ? (
            <p className="text-muted mt-1 text-xs">
              {t("podPhotos", { count: shipment.proofOfDelivery.photoFileIds.length })}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
