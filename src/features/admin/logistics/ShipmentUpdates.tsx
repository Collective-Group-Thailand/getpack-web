"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SignaturePad } from "@/ui/components/SignaturePad";

import { adminBrowserApis, FormDialog, FormError } from "../console";
import type { Shipment } from "./resources";

type Transit = Schemas["ShipmentTransitStatus"];
const TRANSIT = ["in_transit", "out_for_delivery", "failed", "returned"] as const satisfies readonly Transit[];

/** `YYYY-MM-DDTHH:mm` typed in Bangkok as an instant. */
const bangkok = (local: string) => (local ? `${local}:00+07:00` : undefined);

/**
 * Staff correcting a trip's transit status for any carrier (`admin.shipments.updateStatus`,
 * D-013, D-114): recorded as a staff event. Delivered is not a status here — it takes a POD.
 */
export function StatusDialog({
  shipment,
  idempotencyKey,
  onClose,
  onDone,
}: {
  shipment: Shipment;
  idempotencyKey: string;
  onClose: () => void;
  onDone: (updated: Shipment, etag: string | null) => void;
}) {
  const t = useTranslations("logistics.shipment.statusUpdate");
  const tStatus = useTranslations("logistics.shipment.transit");
  const [status, setStatus] = useState<Transit>(shipment.status === "in_transit" ? "out_for_delivery" : "in_transit");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [at, setAt] = useState("");
  return (
    <FormDialog
      title={t("title", { no: shipment.shipmentNo })}
      description={t("intro")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if ((status === "failed" || status === "returned") && note.trim().length < 3)
          throw new FormError(t("noteRequired"));
        const { data, response } = await adminBrowserApis().contract.POST("/v1/admin/shipments/{shipmentId}/events", {
          params: {
            path: { shipmentId: shipment.id },
            header: { "Idempotency-Key": idempotencyKey },
          },
          body: {
            status,
            ...(location.trim() ? { location: location.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(at ? { occurredAt: bangkok(at) } : {}),
          },
        });
        onDone(data!, response.headers.get("ETag"));
      }}
    >
      <Field label={t("status")} required>
        <NativeSelect
          value={status}
          onValueChange={setStatus}
          options={TRANSIT.map((s) => ({ value: s, label: tStatus(s) }))}
        />
      </Field>
      <Field label={t("location")}>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label={t("occurredAt")} hint={t("occurredAtHint")}>
        <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label={t("note")} required={status === "failed" || status === "returned"}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

/**
 * Recording a proof of delivery on the factory's or carrier's behalf (`admin.shipments.recordPod`,
 * D-013): who received it, the pieces accepted per destination (never more than shipped), photos
 * and — for the factory's own fleet — a signature; a carrier delivery may cite the carrier's POD.
 * It delivers the trip and, with the order's last trip, reconciles the order (D-021, D-080).
 */
export function PodDialog({
  shipment,
  idempotencyKey,
  onClose,
  onDone,
}: {
  shipment: Shipment;
  idempotencyKey: string;
  onClose: () => void;
  onDone: (updated: Shipment, etag: string | null) => void;
}) {
  const t = useTranslations("logistics.shipment.podRecord");
  const tSign = useTranslations("logistics.shipment.podRecord.signature");
  const format = useFormat();
  const fleet = shipment.carrier === "factory_fleet";
  const [receiver, setReceiver] = useState("");
  const [delivered, setDelivered] = useState<Record<string, string>>(() =>
    Object.fromEntries(shipment.items.map((item) => [item.destinationId, String(item.quantity)])),
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [carrierRef, setCarrierRef] = useState("");
  const [note, setNote] = useState("");
  return (
    <FormDialog
      size="lg"
      title={t("title", { no: shipment.shipmentNo })}
      description={fleet ? t("introFleet") : t("introCarrier")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (receiver.trim().length < 2) throw new FormError(t("receiverRequired"));
        const items = shipment.items.map((item) => ({
          destinationId: item.destinationId,
          deliveredQuantity: Math.trunc(Number(delivered[item.destinationId])),
        }));
        if (
          items.some(
            (item, i) => !(item.deliveredQuantity >= 0) || item.deliveredQuantity > shipment.items[i]!.quantity,
          )
        )
          throw new FormError(t("quantityInvalid"));
        if (fleet && (photos.length === 0 || !signature)) throw new FormError(t("fleetEvidence"));
        if (!fleet && photos.length === 0 && !carrierRef.trim()) throw new FormError(t("carrierEvidence"));
        const photoFileIds = await Promise.all(
          photos.map(async (file) => (await uploadFile("admin", file, "evidence")).id),
        );
        const signatureFileId = signature
          ? (await uploadFile("admin", new File([signature], "signature.png", { type: "image/png" }), "evidence")).id
          : undefined;
        const { data, response } = await adminBrowserApis().contract.POST(
          "/v1/admin/shipments/{shipmentId}/proof-of-delivery",
          {
            params: {
              path: { shipmentId: shipment.id },
              header: { "Idempotency-Key": idempotencyKey },
            },
            body: {
              receiverName: receiver.trim(),
              items,
              ...(photoFileIds.length ? { photoFileIds } : {}),
              ...(signatureFileId ? { signatureFileId } : {}),
              ...(carrierRef.trim() ? { carrierPodRef: carrierRef.trim() } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          },
        );
        onDone(data!, response.headers.get("ETag"));
      }}
    >
      <Field label={t("receiver")} required>
        <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
      </Field>
      {shipment.items.map((item) => (
        <Field
          key={item.destinationId}
          label={t("deliveredFor", { job: item.jobNo, order: item.orderCode })}
          hint={t("deliveredHint", { quantity: format.number(item.quantity) })}
          required
        >
          <NumberInput
            min={0}
            max={item.quantity}
            inputMode="numeric"
            value={delivered[item.destinationId] ?? ""}
            onChange={(e) => setDelivered({ ...delivered, [item.destinationId]: e.target.value })}
          />
        </Field>
      ))}
      <Field label={t("photos")} hint={t("photosHint", { count: photos.length })} required={fleet}>
        <FileDropzone
          multiple
          accept="image/*"
          maxBytes={15 * 1024 * 1024}
          onFiles={(files) => setPhotos([...photos, ...files].slice(0, 10))}
          labels={{
            prompt: t("drop"),
            browse: t("browse"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
      </Field>
      {photos.length ? (
        <ul className="text-muted flex flex-wrap gap-2 text-xs">
          {photos.map((file, i) => (
            <li key={`${file.name}-${i}`} className="border-border rounded-md border px-2 py-0.5">
              {file.name}
              <button
                type="button"
                className="text-danger ms-1"
                aria-label={t("removePhoto", { name: file.name })}
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <SignaturePad
        onChange={setSignature}
        labels={{
          label: fleet ? tSign("labelRequired") : tSign("label"),
          hint: tSign("hint"),
          clear: tSign("clear"),
          draw: tSign("draw"),
          type: tSign("type"),
          typedName: tSign("typedName"),
          mode: tSign("mode"),
        }}
      />
      {!fleet ? (
        <Field label={t("carrierRef")} hint={t("carrierRefHint")}>
          <Input className="tabular-nums" value={carrierRef} onChange={(e) => setCarrierRef(e.target.value)} />
        </Field>
      ) : null}
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
