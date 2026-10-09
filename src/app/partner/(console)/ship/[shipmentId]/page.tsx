import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { SHIPMENT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { addressLine } from "@/features/partner/address";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import {
  CancelShipment,
  DispatchShipment,
  MarkReady,
  PodForm,
  RequestCarrier,
  UpdateTransit,
} from "@/features/partner/ship/actions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ shipmentId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerShip.detail"))("metaTitle") };
}

const linkClass =
  "border-border-strong bg-surface hover:bg-surface-subtle inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-lg border px-5 font-medium md:min-h-10 md:px-4 md:text-sm";

/**
 * One trip (`partner.shipments.get`): the recipient (D-142), its cartons, labels and packing list
 * once packed, dispatch with the factory's own fleet or a request for Packio's carrier (D-013,
 * D-114), the road's own steps, and the proof of delivery the factory must capture — photos,
 * receiver, signature, delivered pieces per destination — with the order's tolerance result once
 * all of it is delivered. What the factory may do is the trip's own `nextActions`.
 *
 * CONTRACT-GAP partner.shipments — the partner's trip does not say whether Packio accepted its
 * POD (the review state is the desk's, D-229), so the screen does not show it.
 */
export default async function ShipmentPage({ params }: Props) {
  const { shipmentId } = await params;
  const [t, tTolerance, tProblems, format, locale] = await Promise.all([
    getTranslations("partnerShip.detail"),
    getTranslations("partnerShip.tolerance"),
    getTranslations("problems"),
    getFormat(),
    getLocale(),
  ]);
  await factoryContext();
  const { contract } = await partnerServerApis();
  const found = await attempt(
    async () => (await contract.GET("/v1/partner/shipments/{shipmentId}", { params: { path: { shipmentId } } })).data!,
  );
  const back = { href: "/ship", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const shipment = found.data;
  const download = async (fileId: string | null) =>
    fileId
      ? (
          await attempt(
            async () =>
              (await contract.GET("/v1/partner/files/{fileId}/download", { params: { path: { fileId } } })).data!.url,
          )
        ).data
      : null;
  const pod = shipment.proofOfDelivery;
  const [labelsUrl, packingUrl, photoUrls] = await Promise.all([
    download(shipment.labelFileId),
    download(shipment.packingListFileId),
    Promise.all((pod?.photoFileIds ?? []).map(download)),
  ]);
  const action = (key: string) => shipment.nextActions.find((item) => item.key === key);
  const reason = (key: string | null | undefined) => (key ? (tProblems.has(key) ? tProblems(key) : key) : null);
  const pieces = shipment.items.reduce((total, item) => total + item.quantity, 0);
  const jobNos = [...new Set(shipment.items.map((item) => item.jobNo))].join(", ");
  const outcome = shipment.items.find((item) => item.toleranceOutcome)?.toleranceOutcome ?? null;
  const dispatch = action("shipment.dispatch");

  return (
    <PartnerPage
      title={shipment.shipmentNo}
      back={back}
      meta={<StatusChip map={SHIPMENT_STATUS} value={shipment.status} size="md" />}
      description={t("summary", { jobNo: jobNos, quantity: format.number(pieces), cartons: shipment.cartonsCount })}
    >
      {shipment.blockedByPayment ? (
        <Callout tone="warning" icon="hourglass" title={t("blockedTitle")}>
          {t("blockedBody")}
        </Callout>
      ) : null}
      {shipment.carrierRequest ? (
        <Callout tone="info" icon="route" title={t("carrierRequestedTitle")}>
          {t("carrierRequestedBody", {
            reason: shipment.carrierRequest.reason,
            at: format.dateTime(shipment.carrierRequest.requestedAt),
          })}
        </Callout>
      ) : null}

      {action("shipment.mark_ready") ? <MarkReady shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} /> : null}
      {/* What to do with a packed trip, in the order it is done on the dock: label the cartons, then send. */}
      {shipment.cartons.length || labelsUrl || packingUrl ? (
        <PartnerSection title={t("steps.label")} description={t("steps.labelBody")}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {shipment.cartons.length ? (
              <Link href={`/ship/${shipment.id}/labels`} className={linkClass}>
                <Icon name="printer" size={18} />
                {t("printLabels", { count: shipment.cartons.length })}
              </Link>
            ) : null}
            {labelsUrl || packingUrl ? (
              <div className="flex flex-wrap gap-x-4">
                {labelsUrl ? (
                  <a
                    href={labelsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex min-h-12 items-center underline"
                  >
                    {t("labelsPdf")}
                  </a>
                ) : null}
                {packingUrl ? (
                  <a
                    href={packingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex min-h-12 items-center underline"
                  >
                    {t("packingPdf")}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </PartnerSection>
      ) : null}
      {dispatch || action("shipment.request_carrier") ? (
        <PartnerSection title={t("steps.send")} description={t("steps.sendBody")}>
          <div className="flex flex-col gap-3">
            {dispatch ? (
              <DispatchShipment
                shipmentId={shipment.id}
                shipmentNo={shipment.shipmentNo}
                blockedBy={reason(dispatch.disabledReason)}
              />
            ) : null}
            {action("shipment.request_carrier") ? (
              <RequestCarrier shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} />
            ) : null}
          </div>
        </PartnerSection>
      ) : null}
      {action("shipment.cancel") ? <CancelShipment shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} /> : null}

      {action("shipment.update_status") ? (
        <PartnerSection title={t("transitTitle")}>
          <Card padding="md">
            <UpdateTransit shipmentId={shipment.id} />
          </Card>
        </PartnerSection>
      ) : null}

      {/* The POD is the hand-over at the destination: offered once the truck has left, not while
          the trip still waits at the gate (the API also allows it at `ready`). */}
      {action("shipment.record_pod") &&
      !action("shipment.record_pod")?.disabledReason &&
      shipment.status !== "ready" &&
      shipment.status !== "draft" ? (
        <PartnerSection title={t("podTitle")} description={t("podBody")}>
          <Card padding="md">
            <PodForm
              shipmentId={shipment.id}
              items={shipment.items.map((item) => ({
                destinationId: item.destinationId,
                jobNo: item.jobNo,
                quantity: item.quantity,
              }))}
            />
          </Card>
        </PartnerSection>
      ) : null}

      {pod ? (
        <PartnerSection title={t("podDone")}>
          <Card padding="md" className="flex flex-col gap-2">
            <DescriptionList
              columns={1}
              items={[
                { term: t("receiver"), description: pod.receiverName },
                { term: t("delivered"), description: format.number(pod.deliveredQuantity) },
                { term: t("at"), description: format.dateTime(pod.capturedAt) },
              ]}
            />
            {photoUrls.some(Boolean) ? (
              <ul className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, index) =>
                  url ? (
                    <li key={pod.photoFileIds[index]}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL */}
                      <img
                        src={url}
                        alt={t("photoAlt", { n: index + 1 })}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </Card>
          {outcome ? (
            <Callout tone={outcome.endsWith("outside") ? "warning" : "success"} title={tTolerance(outcome)}>
              {tTolerance("detail")}
            </Callout>
          ) : null}
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("recipient")} description={t("recipientNote")}>
        <Card padding="md">
          <p className="font-medium">{shipment.destination.recipientName}</p>
          <p>
            {addressLine({
              ...shipment.destination,
              province: locale === "en" ? shipment.destination.province.nameEn : shipment.destination.province.nameTh,
            })}
          </p>
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
            {shipment.items.map((item) => (
              <li key={`${item.jobId}-${item.destinationId}`} className="flex justify-between gap-2 tabular-nums">
                <span>
                  <span className="font-mono">{item.jobNo}</span>
                  <span className="text-muted"> · {item.orderCode}</span>
                </span>
                <span>
                  {item.deliveredQuantity !== null
                    ? t("itemDelivered", {
                        delivered: format.number(item.deliveredQuantity),
                        quantity: format.number(item.quantity),
                      })
                    : t("itemPieces", { quantity: format.number(item.quantity) })}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-2 text-sm">
            {t("weight", { kg: format.number(shipment.weightG / 1000), cartons: shipment.cartonsCount })}
          </p>
        </Card>
      </PartnerSection>

      {shipment.events.length ? (
        <PartnerSection title={t("events")}>
          <ol className="border-border flex flex-col gap-2 border-s-2 ps-4">
            {[...shipment.events].reverse().map((event, index) => (
              <li key={`${event.occurredAt}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">{format.dateTime(event.occurredAt)}</span>
                <StatusChip map={SHIPMENT_STATUS} value={event.status} />
                {event.location ? <span className="text-muted">{event.location}</span> : null}
                {event.note ? <span>{event.note}</span> : null}
              </li>
            ))}
          </ol>
        </PartnerSection>
      ) : null}
    </PartnerPage>
  );
}
