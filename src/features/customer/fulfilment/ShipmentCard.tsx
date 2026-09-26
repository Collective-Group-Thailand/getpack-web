import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SHIPMENT_STATUS } from "@/domain/status";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";

type Shipment = ResponseOf<Requests, "GET /v1/store/orders/{orderId}">["shipments"][number];

/**
 * One delivery (F3 3.6): where it went, how many, the carrier's progress and — once delivered —
 * the proof of delivery with its photos. The recipient's name is the customer's own data, shown
 * here and never on the public tracking page.
 */
export async function ShipmentCard({ shipment, unit }: { shipment: Shipment; unit: string }) {
  const [t, format] = await Promise.all([getTranslations("fulfilment.shipment"), getFormat()]);
  return (
    <article aria-labelledby={`shipment-${shipment.id}`} className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`shipment-${shipment.id}`} className="font-medium">
          {t("to", {
            quantity: format.number(shipment.quantity),
            unit,
            name: shipment.destination.recipientName,
            province: shipment.destination.province,
          })}
        </h3>
        <StatusChip map={SHIPMENT_STATUS} value={shipment.status} />
      </div>
      <p className="text-muted mt-1 text-xs">
        {t(shipment.trackingNo ? "metaTracking" : "meta", {
          shipment: shipment.shipmentNo,
          carrier: t(`carrier.${shipment.carrier}`),
          cartons: format.number(shipment.cartons),
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
              <li key={`${event.at}-${event.status}`} className="flex flex-wrap gap-x-3">
                <time dateTime={event.at} className="text-muted tabular-nums">
                  {format.dateTime(event.at)}
                </time>
                <span>{t(`eventStatus.${event.status}`)}</span>
                {event.location ? <span className="text-muted">{event.location}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {shipment.pod ? (
        <div className="bg-surface-subtle mt-3 rounded-md p-3 text-sm">
          <p>
            {t("pod", {
              name: shipment.pod.receiverName,
              quantity: format.number(shipment.pod.deliveredQuantity),
              unit,
              date: format.dateTime(shipment.pod.capturedAt),
            })}
          </p>
          {shipment.pod.photos.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {shipment.pod.photos.map((photo) =>
                photo.thumbnailUrl || photo.url ? (
                  <li key={photo.id}>
                    <a href={photo.url ?? photo.thumbnailUrl!} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- delivery photo from the API */}
                      <img
                        src={photo.thumbnailUrl ?? photo.url!}
                        alt={t("podPhoto", { name: photo.originalName })}
                        className="size-20 rounded object-cover"
                      />
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
