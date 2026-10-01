import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { DispatchShipment, PodForm, RequestCarrier } from "@/features/partner/ship/actions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ shipmentId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerShip.detail"))("metaTitle") };
}

/**
 * One shipment: the recipient (D-142), its cartons and labels, dispatch with the factory's own
 * fleet or a request for Packio's carrier (D-013, D-114), and the proof of delivery the factory
 * must capture — photos, receiver, signature, delivered quantity — and the tolerance result.
 */
export default async function ShipmentPage({ params }: Props) {
  const { shipmentId } = await params;
  const t = await getTranslations("partnerShip.detail");
  const tTolerance = await getTranslations("partnerShip.tolerance");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/shipments/{shipmentId}", {
      path: { factoryId: context.factoryId, shipmentId },
    }),
  );
  const back = { href: "/ship", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const shipment = found.data;

  return (
    <PartnerPage
      title={shipment.shipmentNo}
      back={back}
      meta={<StatusChip map={SHIPMENT_STATUS} value={shipment.status} size="md" />}
      description={t("summary", {
        jobNo: shipment.job.jobNo,
        quantity: format.number(shipment.quantity),
        cartons: shipment.cartons,
      })}
    >
      {shipment.blockedByPayment ? (
        <Callout tone="warning" icon="hourglass" title={t("blockedTitle")}>
          {t("blockedBody")}
        </Callout>
      ) : null}
      {shipment.carrierRequested ? (
        <Callout tone="info" icon="route" title={t("carrierRequestedTitle")}>
          {t("carrierRequestedBody")}
        </Callout>
      ) : null}

      {shipment.nextActions.includes("dispatch") ? (
        <div className="flex flex-col gap-3">
          <Link
            href={`/ship/${shipment.id}/labels`}
            className="border-border-strong bg-surface hover:bg-surface-subtle inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border px-6 text-lg font-medium"
          >
            <Icon name="printer" size={24} />
            {t("printLabels", { count: shipment.cartons })}
          </Link>
          {!shipment.blockedByPayment ? (
            <DispatchShipment shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} />
          ) : null}
          {shipment.nextActions.includes("request_carrier") ? (
            <RequestCarrier shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} />
          ) : null}
        </div>
      ) : null}

      {shipment.nextActions.includes("capture_pod") ? (
        <PartnerSection title={t("podTitle")} description={t("podBody")}>
          <Card padding="lg">
            <PodForm shipmentId={shipment.id} quantity={shipment.quantity} />
          </Card>
        </PartnerSection>
      ) : null}

      {shipment.pod ? (
        <PartnerSection title={t("podDone")}>
          <Card padding="md" className="flex flex-col gap-2">
            <DescriptionList
              columns={1}
              items={[
                { term: t("receiver"), description: shipment.pod.receiverName },
                { term: t("delivered"), description: format.number(shipment.pod.deliveredQuantity) },
                { term: t("at"), description: format.dateTime(shipment.pod.capturedAt) },
                { term: t("review"), description: <StatusChip map={POD_REVIEW_STATUS} value={shipment.pod.review} /> },
              ]}
            />
            {shipment.pod.photos.length ? (
              <ul className="grid grid-cols-3 gap-2">
                {shipment.pod.photos.map((photo, index) =>
                  photo.thumbnailUrl ? (
                    <li key={photo.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL */}
                      <img
                        src={photo.thumbnailUrl}
                        alt={t("photoAlt", { n: index + 1 })}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </Card>
          {shipment.tolerance ? (
            <Callout
              tone={shipment.tolerance.outcome.endsWith("outside") ? "warning" : "success"}
              title={tTolerance(shipment.tolerance.outcome)}
            >
              {tTolerance("detail", {
                ordered: format.number(shipment.tolerance.ordered),
                delivered: format.number(shipment.tolerance.delivered),
                shortage: format.percent(shipment.tolerance.shortagePct),
                overage: format.percent(shipment.tolerance.overagePct),
              })}
            </Callout>
          ) : null}
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("recipient")} description={t("recipientNote")}>
        <Card padding="md">
          <p className="font-medium">{shipment.destination.recipientName}</p>
          <p>{addressLine({ ...shipment.destination, line1: shipment.destination.address })}</p>
          <a
            href={`tel:${shipment.destination.phone}`}
            className="text-primary inline-flex min-h-12 items-center underline"
          >
            {shipment.destination.phone}
          </a>
        </Card>
      </PartnerSection>

      <PartnerSection title={t("packing")}>
        <Card padding="md">
          <ul className="flex flex-col gap-1">
            {shipment.packingList.map((line, index) => (
              <li key={index} className="flex justify-between gap-2 tabular-nums">
                <span>{line.label}</span>
                <span>{format.number(line.quantity)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </PartnerSection>

      <PartnerSection title={t("events")}>
        <ol className="border-border flex flex-col gap-2 border-s-2 ps-4">
          {[...shipment.events].reverse().map((event, index) => (
            <li key={`${event.occurredAt}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{format.dateTime(event.occurredAt)}</span>
              <StatusChip map={SHIPMENT_STATUS} value={event.status} />
              {event.note ? <span>{event.note}</span> : null}
            </li>
          ))}
        </ol>
      </PartnerSection>
    </PartnerPage>
  );
}
