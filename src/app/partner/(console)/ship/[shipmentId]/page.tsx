import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { SHIPMENT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import {
  ActionPanel,
  PageError,
  PartnerDetail,
  PartnerPage,
  PartnerSection,
  PartnerStats,
} from "@/features/partner/frame";
import {
  CancelShipment,
  DispatchShipment,
  MarkReady,
  PodForm,
  RequestCarrier,
  UpdateTransit,
} from "@/features/partner/ship/actions";
import { PhotoGrid, ViewFile } from "@/features/partner/viewer";
import { placeOf, shipmentCodeOf } from "@/features/partner/ship/destination";
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
  "border-border-strong bg-surface hover:bg-surface-subtle inline-flex min-h-11 md:min-h-10 items-center justify-center gap-2 self-start rounded-lg border px-5 font-medium md:min-h-10 md:px-4";

/**
 * One trip (`partner.shipments.get`): the recipient (D-142), its cartons, labels and packing list
 * once packed, dispatch with the factory's own fleet or a request for getpack's carrier (D-013,
 * D-114), the road's own steps, and the proof of delivery the factory must capture — photos,
 * receiver, signature, delivered pieces per destination — with the order's tolerance result once
 * all of it is delivered. What the factory may do is the trip's own `nextActions`.
 *
 * CONTRACT-GAP partner.shipments — the partner's trip does not say whether getpack accepted its
 * POD (the review state is the desk's, D-229), so the screen does not show it.
 */
export default async function ShipmentPage({ params }: Props) {
  const { shipmentId } = await params;
  const [t, tDest, tTolerance, tProblems, format, locale, tList] = await Promise.all([
    getTranslations("partnerShip.detail"),
    getTranslations("partnerShip.destination"),
    getTranslations("partnerShip.tolerance"),
    getTranslations("problems"),
    getFormat(),
    getLocale(),
    getTranslations("partnerShip.list.table"),
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

  const podOpen =
    action("shipment.record_pod") &&
    !action("shipment.record_pod")?.disabledReason &&
    shipment.status !== "ready" &&
    shipment.status !== "draft";
  const place = [
    shipmentCodeOf(shipment),
    placeOf(
      locale === "en" ? shipment.destination.province.nameEn : shipment.destination.province.nameTh,
      shipment.destination,
    ),
  ]
    .filter(Boolean)
    .join(" · ");

  // The dock's steps in the order they are done — label the cartons, send, report the road, hand over —
  // in the panel that stays beside the trip (first on a phone).
  const aside = (
    <>
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
      {shipment.cartons.length || labelsUrl || packingUrl ? (
        <ActionPanel id="step-label" tone="neutral" title={t("steps.label")} description={t("steps.labelBody")}>
          {shipment.cartons.length ? (
            <Link href={`/ship/${shipment.id}/labels`} className={linkClass}>
              <Icon name="printer" size={18} aria-hidden="true" />
              {t("printLabels", { count: shipment.cartons.length })}
            </Link>
          ) : null}
          {labelsUrl || packingUrl ? (
            <div className="flex flex-wrap gap-x-4">
              {labelsUrl ? (
                <ViewFile src={labelsUrl} title={t("labelsPdf")}>
                  {t("labelsPdf")}
                </ViewFile>
              ) : null}
              {packingUrl ? (
                <ViewFile src={packingUrl} title={t("packingPdf")}>
                  {t("packingPdf")}
                </ViewFile>
              ) : null}
            </div>
          ) : null}
        </ActionPanel>
      ) : null}
      {dispatch || action("shipment.request_carrier") ? (
        <ActionPanel id="step-send" tone="neutral" title={t("steps.send")} description={t("steps.sendBody")}>
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
        </ActionPanel>
      ) : null}
      {action("shipment.update_status") ? (
        <ActionPanel id="transit" tone="neutral" title={t("transitTitle")}>
          <UpdateTransit shipmentId={shipment.id} />
        </ActionPanel>
      ) : null}
      {/* The POD is the hand-over at the destination: offered once the truck has left, not while
          the trip still waits at the gate (the API also allows it at `ready`). */}
      {podOpen ? (
        <ActionPanel id="pod" tone="neutral" title={t("podTitle")} description={t("podBody")}>
          <PodForm
            shipmentId={shipment.id}
            items={shipment.items.map((item) => ({
              destinationId: item.destinationId,
              jobNo: item.jobNo,
              quantity: item.quantity,
            }))}
          />
        </ActionPanel>
      ) : null}
      {/* P4-01: the province and the postcode's first digits only — getpack keeps the recipient. */}
      <section
        aria-labelledby="recipient"
        className="border-border bg-surface rounded-card flex flex-col gap-1 border p-4"
      >
        <h2 id="recipient" className="text-muted text-sm font-medium">
          {t("recipient")}
        </h2>
        <p className="font-semibold">{place}</p>
        <p className="text-muted text-sm">{tDest("confidential")}</p>
      </section>
      {/* Destructive, so apart from the dock's steps and last. */}
      {action("shipment.cancel") ? (
        <div className="border-border border-t pt-4">
          <CancelShipment shipmentId={shipment.id} shipmentNo={shipment.shipmentNo} />
        </div>
      ) : null}
    </>
  );

  return (
    <PartnerPage
      wide
      title={shipment.shipmentNo}
      back={back}
      status={<StatusChip map={SHIPMENT_STATUS} value={shipment.status} size="md" />}
      description={t("summary", { jobNo: jobNos, quantity: format.number(pieces), cartons: shipment.cartonsCount })}
    >
      <PartnerStats
        label={t("metaTitle")}
        items={[
          { key: "pieces", icon: "box", label: tList("pieces"), value: format.number(pieces) },
          { key: "cartons", icon: "package", label: tList("cartons"), value: format.number(shipment.cartonsCount) },
          { key: "to", icon: "map-pin", label: tList("to"), value: <span className="text-lg">{place}</span> },
        ]}
      />
      <PartnerDetail aside={aside}>
        {pod ? (
          <PartnerSection id="pod-done" title={t("podDone")}>
            <Card padding="md" className="flex flex-col gap-2">
              <DescriptionList
                columns={1}
                items={[
                  // A carrier's POD may come without a receiver's name (the API types still say string).
                  { term: t("receiver"), description: (pod.receiverName as string | null) || "—" },
                  { term: t("delivered"), description: format.number(pod.deliveredQuantity) },
                  { term: t("at"), description: format.dateTime(pod.capturedAt) },
                ]}
              />
              {photoUrls.some(Boolean) ? (
                <PhotoGrid
                  items={photoUrls.flatMap((url, index) =>
                    url ? [{ src: url, title: t("photoAlt", { n: index + 1 }) }] : [],
                  )}
                />
              ) : null}
            </Card>
            {outcome ? (
              <Callout tone={outcome.endsWith("outside") ? "warning" : "success"} title={tTolerance(outcome)}>
                {tTolerance("detail")}
              </Callout>
            ) : null}
          </PartnerSection>
        ) : null}

        <PartnerSection title={t("packing")}>
          <Card padding="md">
            <ul className="flex flex-col gap-1">
              {shipment.items.map((item) => (
                <li key={`${item.jobId}-${item.destinationId}`} className="flex justify-between gap-2 tabular-nums">
                  <span>
                    <span className="tabular-nums">{item.jobNo}</span>
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
      </PartnerDetail>
    </PartnerPage>
  );
}
