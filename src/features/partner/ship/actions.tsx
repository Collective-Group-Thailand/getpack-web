"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokNow, newReport, uploadPhotos, useFloorAction } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { SignaturePad } from "@/ui/components/SignaturePad";
import { toast } from "@/ui/components/Toast";

/** One `Idempotency-Key` per intent: minted on the first attempt, kept on a retry, dropped on success. */
function useIntentKey() {
  const current = useRef<string | null>(null);
  return {
    get: () => (current.current ??= newReport().idempotencyKey),
    done: () => {
      current.current = null;
    },
  };
}

/* ------------------------------------------------------------------------ new shipment */

/**
 * A draft trip to one destination of a finished job (D-110): the quantity it takes — all that is
 * left, or part of it for a split — its cartons, which become its labels when it is packed, and
 * its weight.
 */
export function CreateShipment({
  jobId,
  destination,
}: {
  jobId: string;
  destination: { id: string; recipientName: string; left: number };
}) {
  const t = useTranslations("partnerShip.create");
  const format = useFormat();
  const router = useRouter();
  const key = useIntentKey();
  const [quantity, setQuantity] = useState(String(destination.left));
  const [cartons, setCartons] = useState("1");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<{ quantity?: string; cartons?: string; weight?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    const boxes = Number(cartons);
    // The scale reads kilograms; the contract takes whole grams (a weight, not money).
    const grams = Math.round(Number(weight) * 1000);
    if (!Number.isInteger(qty) || qty < 1 || qty > destination.left)
      return setError({ quantity: t("quantityRange", { max: format.number(destination.left) }) });
    if (!Number.isInteger(boxes) || boxes < 1) return setError({ cartons: t("cartonsRange") });
    if (!Number.isFinite(grams) || grams < 1) return setError({ weight: t("weightRequired") });
    setError(null);
    setBusy(true);
    try {
      const created = (
        await browserApi().POST("/v1/partner/shipments", {
          params: { header: { "Idempotency-Key": key.get() } },
          body: {
            items: [{ jobId, destinationId: destination.id, quantity: qty }],
            cartonsCount: boxes,
            weightG: grams,
          },
        })
      ).data!;
      key.done();
      toast.success(t("created", { no: created.shipmentNo }));
      router.push(`/ship/${created.id}`);
    } catch (failure) {
      setError({
        quantity:
          isApiError(failure) && failure.errors[0] ? failure.errors[0].message : problemMessage(failure, t("failed")),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void create(event)} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-3 gap-2">
        <Field label={t("quantity")} error={error?.quantity}>
          <NumberInput
            inputSize="lg"
            inputMode="numeric"
            min={1}
            max={destination.left}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field label={t("cartons")} error={error?.cartons}>
          <NumberInput
            inputSize="lg"
            inputMode="numeric"
            min={1}
            value={cartons}
            onChange={(event) => setCartons(event.target.value)}
          />
        </Field>
        <Field label={t("weight")} error={error?.weight}>
          <NumberInput
            inputSize="lg"
            inputMode="decimal"
            min={0}
            unit={t("kg")}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" size="xl" iconStart="package" loading={busy}>
        {t("action", { name: destination.recipientName })}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------- ready / dispatch */

/** Packed: the API makes the carton labels and the packing list (`partner.shipments.markReady`). */
export function MarkReady({ shipmentId, shipmentNo }: { shipmentId: string; shipmentNo: string }) {
  const t = useTranslations("partnerShip.ready");
  const key = useIntentKey();
  const { run, busy } = useFloorAction();
  return (
    <BigActionButton
      title={t("action")}
      hint={t("hint", { no: shipmentNo })}
      icon="printer"
      loading={busy}
      onClick={async () => {
        const ok = await run(
          () =>
            browserApi().POST("/v1/partner/shipments/{shipmentId}/actions/ready", {
              params: { path: { shipmentId }, header: { "Idempotency-Key": key.get() } },
            }),
          t("done", { no: shipmentNo }),
        );
        if (ok) key.done();
      }}
    />
  );
}

/** The factory's own fleet leaves with it (D-013); the API holds it at the gate (B3.2, D-076). */
export function DispatchShipment({
  shipmentId,
  shipmentNo,
  blockedBy,
}: {
  shipmentId: string;
  shipmentNo: string;
  /** Why the API offers it disabled now (`disabledReason`), in words. */
  blockedBy?: string | null;
}) {
  const t = useTranslations("partnerShip.dispatch");
  const key = useIntentKey();
  const { run, busy } = useFloorAction();
  return (
    <BigActionButton
      title={t("action")}
      hint={blockedBy ?? t("hint", { no: shipmentNo })}
      icon="truck"
      loading={busy}
      disabled={Boolean(blockedBy)}
      onClick={async () => {
        const ok = await run(
          () =>
            browserApi().POST("/v1/partner/shipments/{shipmentId}/actions/dispatch", {
              params: { path: { shipmentId }, header: { "Idempotency-Key": key.get() } },
            }),
          t("done", { no: shipmentNo }),
        );
        if (ok) key.done();
      }}
    />
  );
}

/** The fleet cannot reach this address: the factory asks Packio for its fallback carrier (D-013, D-114). */
export function RequestCarrier({ shipmentId, shipmentNo }: { shipmentId: string; shipmentNo: string }) {
  const t = useTranslations("partnerShip.carrier");
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="xl" variant="secondary" iconStart="route" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body", { no: shipmentNo })}
        confirmLabel={t("confirm")}
        reason={{ label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          const ok = await run(
            () =>
              browserApi().POST("/v1/partner/shipments/{shipmentId}/actions/request-carrier", {
                params: { path: { shipmentId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason },
              }),
            t("done"),
          );
          if (!ok) throw new Error("not requested");
        }}
      />
    </>
  );
}

/** Cancelling a trip that has not left cannot be undone (`shipment.cancel`): the number is retyped. */
export function CancelShipment({ shipmentId, shipmentNo }: { shipmentId: string; shipmentNo: string }) {
  const t = useTranslations("partnerShip.cancel");
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" variant="ghost" iconStart="ban" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        title={t("title", { no: shipmentNo })}
        description={t("body", { no: shipmentNo })}
        confirmLabel={t("confirm")}
        confirmationPhrase={shipmentNo}
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          const ok = await run(
            () =>
              browserApi().POST("/v1/partner/shipments/{shipmentId}/actions/cancel", {
                params: { path: { shipmentId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason },
              }),
            t("done", { no: shipmentNo }),
          );
          if (!ok) throw new Error("not cancelled");
        }}
      />
    </>
  );
}

const TRANSIT = [
  "in_transit",
  "out_for_delivery",
  "failed",
  "returned",
] as const satisfies readonly Schemas["ShipmentTransitStatus"][];

/** The fleet's own steps on the road (`partner.shipments.updateStatus`): out for delivery, a failed attempt. */
export function UpdateTransit({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("partnerShip.transit");
  const tStatus = useTranslations("status");
  const key = useIntentKey();
  const { run, busy } = useFloorAction();
  const [status, setStatus] = useState<Schemas["ShipmentTransitStatus"]>("out_for_delivery");
  const [note, setNote] = useState("");
  const LABELS = {
    in_transit: "shipment.inTransit",
    out_for_delivery: "shipment.outForDelivery",
    failed: "shipment.failed",
    returned: "shipment.returned",
  } as const;
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await run(
          () =>
            browserApi().POST("/v1/partner/shipments/{shipmentId}/events", {
              params: { path: { shipmentId }, header: { "Idempotency-Key": key.get() } },
              body: { status, occurredAt: bangkokNow(), ...(note.trim() ? { note: note.trim() } : {}) },
            }),
          t("done"),
        );
        if (ok) {
          key.done();
          setNote("");
        }
      }}
    >
      <Field label={t("status")}>
        <Select
          value={status}
          onValueChange={setStatus}
          options={TRANSIT.map((value) => ({ value, label: tStatus(LABELS[value]) }))}
        />
      </Field>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" size="xl" variant="secondary" iconStart="route" loading={busy} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}

/* ----------------------------------------------------------------------------------- POD */

/**
 * Proof of delivery, required for the factory's own deliveries (D-013): photos of the goods at
 * the door, who received them, their signature (or typed name), and how many were delivered to
 * each destination on the trip — the quantity the tolerance is judged on (D-021, D-080). Photos
 * keep the time they were taken. Recording it cannot be undone (`shipment.record_pod`).
 */
export function PodForm({
  shipmentId,
  items,
}: {
  shipmentId: string;
  items: { destinationId: string; jobNo: string; quantity: number }[];
}) {
  const t = useTranslations("partnerShip.pod");
  const tCamera = useTranslations("partnerJobs.camera");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const key = useIntentKey();
  const { run, busy, errors } = useFloorAction();
  const [receiver, setReceiver] = useState("");
  const [delivered, setDelivered] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.destinationId, String(item.quantity)])),
  );
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const counts = items.map((item) => Number(delivered[item.destinationId]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (receiver.trim().length < 2) return void toast.error(t("receiverRequired"));
    if (counts.some((count) => !Number.isInteger(count) || count < 0)) return void toast.error(t("quantityInvalid"));
    if (!photos.length) return void toast.error(t("photoRequired"));
    if (!signature) return void toast.error(t("signatureRequired"));
    setUploading(true);
    let photoFileIds: string[];
    let signatureFileId: string;
    try {
      photoFileIds = await uploadPhotos(photos, factoryId);
      const file = new File([signature], "signature.png", { type: "image/png" });
      signatureFileId = (await uploadFile("partner", file, "evidence", { factoryId })).id;
    } catch (error) {
      setUploading(false);
      return void toast.error(problemMessage(error, t("uploadFailed")));
    }
    setUploading(false);
    const ok = await run(
      () =>
        browserApi().POST("/v1/partner/shipments/{shipmentId}/proof-of-delivery", {
          params: { path: { shipmentId }, header: { "Idempotency-Key": key.get() } },
          body: {
            receiverName: receiver.trim(),
            items: items.map((item, index) => ({
              destinationId: item.destinationId,
              deliveredQuantity: counts[index]!,
            })),
            // When the goods were handed over: the first photo's shutter time, or now.
            capturedAt: photos[0]?.capturedAt ?? bangkokNow(),
            photoFileIds,
            signatureFileId,
          },
        }),
      t("done"),
    );
    if (ok) key.done();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("photos")} hint={t("photosHint")} error={errors.photoFileIds}>
        <CameraCapture
          photos={photos}
          onChange={setPhotos}
          labels={{
            take: tCamera("take"),
            more: tCamera("more"),
            photo: (n) => tCamera("photo", { n }),
            remove: (n) => tCamera("remove", { n }),
            count: (value) => tCamera("count", { count: value }),
            processing: tCamera("processing"),
          }}
        />
      </Field>
      <Field label={t("receiver")} required requiredLabel={tCommon("state.required")} error={errors.receiverName}>
        <Input
          inputSize="lg"
          autoComplete="off"
          value={receiver}
          onChange={(event) => setReceiver(event.target.value)}
        />
      </Field>
      {items.map((item) => (
        <Field
          key={item.destinationId}
          label={items.length > 1 ? t("deliveredFor", { jobNo: item.jobNo }) : t("delivered")}
          hint={t("deliveredHint", { quantity: item.quantity })}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.items}
        >
          <NumberInput
            inputSize="lg"
            inputMode="numeric"
            min={0}
            value={delivered[item.destinationId] ?? ""}
            onChange={(event) => setDelivered({ ...delivered, [item.destinationId]: event.target.value })}
          />
        </Field>
      ))}
      <SignaturePad
        onChange={setSignature}
        labels={{
          label: t("signature"),
          hint: t("signatureHint"),
          clear: t("clear"),
          draw: t("draw"),
          type: t("typeName"),
          typedName: t("typedName"),
          mode: t("signatureMode"),
        }}
      />
      <BigActionButton
        type="submit"
        title={t("submit")}
        hint={t("submitHint")}
        icon="package-check"
        loading={busy || uploading}
      />
    </form>
  );
}

/* --------------------------------------------------------------------------------- print */

export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="xl" iconStart="printer" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
