"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokNow, newReport, uploadPhotos, useFloorAction } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { SignaturePad } from "@/ui/components/SignaturePad";
import { toast } from "@/ui/components/Toast";

type Report = ReturnType<typeof newReport>;

function useReport() {
  const current = useRef<Report | null>(null);
  return {
    get: () => (current.current ??= newReport()),
    done: () => {
      current.current = null;
    },
  };
}

/* ------------------------------------------------------------------------ new shipment */

/**
 * A shipment for one destination of a finished job (D-110): the quantity it takes — all that is
 * left, or part of it for a split — and its cartons, which become its labels.
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
  const { factoryId, can } = useFactory();
  const router = useRouter();
  const report = useReport();
  const [quantity, setQuantity] = useState(String(destination.left));
  const [cartons, setCartons] = useState("1");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!can("factory_shipments.manage")) return null;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    const boxes = Number(cartons);
    if (!Number.isInteger(qty) || qty < 1 || qty > destination.left)
      return setError(t("quantityRange", { max: format.number(destination.left) }));
    if (!Number.isInteger(boxes) || boxes < 1) return setError(t("cartonsRange"));
    setError(null);
    setBusy(true);
    const next = report.get();
    try {
      const created = await browserRequests().call("POST /v1/partner/factories/{factoryId}/shipments", {
        path: { factoryId },
        body: {
          ...next.stamp,
          jobId,
          destinationId: destination.id,
          quantity: qty,
          cartons: boxes,
          ...(Number(weight) > 0 ? { weightG: Math.round(Number(weight) * 1000) } : {}),
        },
        idempotencyKey: next.idempotencyKey,
      });
      report.done();
      toast.success(t("created", { no: created.shipmentNo }));
      router.push(`/ship/${created.id}`);
    } catch (failure) {
      setError(
        isApiError(failure) && failure.errors[0] ? failure.errors[0].message : problemMessage(failure, t("failed")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void create(event)} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-3 gap-2">
        <Field label={t("quantity")} error={error ?? undefined}>
          <NumberInput
            inputSize="lg"
            inputMode="numeric"
            min={1}
            max={destination.left}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field label={t("cartons")}>
          <NumberInput
            inputSize="lg"
            inputMode="numeric"
            min={1}
            value={cartons}
            onChange={(event) => setCartons(event.target.value)}
          />
        </Field>
        <Field label={t("weight")}>
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

/* ------------------------------------------------------------------------------ dispatch */

export function DispatchShipment({ shipmentId, shipmentNo }: { shipmentId: string; shipmentNo: string }) {
  const t = useTranslations("partnerShip.dispatch");
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy } = useFloorAction();
  if (!can("factory_shipments.manage")) return null;
  return (
    <BigActionButton
      title={t("action")}
      hint={t("hint", { no: shipmentNo })}
      icon="truck"
      loading={busy}
      onClick={async () => {
        const next = report.get();
        const ok = await run(
          () =>
            browserRequests().call("POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/dispatch", {
              path: { factoryId, shipmentId },
              body: next.stamp,
              idempotencyKey: next.idempotencyKey,
            }),
          t("done", { no: shipmentNo }),
        );
        if (ok) report.done();
      }}
    />
  );
}

/** The fleet cannot reach this address: Packio books its fallback carrier (D-013, D-114). */
export function RequestCarrier({ shipmentId, shipmentNo }: { shipmentId: string; shipmentNo: string }) {
  const t = useTranslations("partnerShip.carrier");
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  if (!can("factory_shipments.manage")) return null;
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
        onConfirm={async ({ reason }) => {
          const next = report.get();
          const ok = await run(
            () =>
              browserRequests().call(
                "POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/request-carrier",
                {
                  path: { factoryId, shipmentId },
                  body: { ...next.stamp, reason },
                  idempotencyKey: next.idempotencyKey,
                },
              ),
            t("done"),
          );
          if (ok) report.done();
          else throw new Error("not requested");
        }}
      />
    </>
  );
}

/* ----------------------------------------------------------------------------------- POD */

/**
 * Proof of delivery, required for the factory's own deliveries (D-013): photos of the goods at
 * the door, who received them, their signature (or typed name), and how many were delivered —
 * the quantity the tolerance is judged on (D-021, D-080). Photos keep the time they were taken.
 */
export function PodForm({ shipmentId, quantity }: { shipmentId: string; quantity: number }) {
  const t = useTranslations("partnerShip.pod");
  const tCamera = useTranslations("partnerJobs.camera");
  const tCommon = useTranslations("common");
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy, errors } = useFloorAction();
  const [receiver, setReceiver] = useState("");
  const [delivered, setDelivered] = useState(String(quantity));
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  if (!can("factory_shipments.manage")) return null;
  const count = Number(delivered);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (receiver.trim().length < 2) return void toast.error(t("receiverRequired"));
    if (!Number.isInteger(count) || count < 0) return void toast.error(t("quantityInvalid"));
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
    const next = report.get();
    const ok = await run(
      () =>
        browserRequests().call("POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/pod", {
          path: { factoryId, shipmentId },
          body: {
            ...next.stamp,
            receiverName: receiver.trim(),
            deliveredQuantity: count,
            // When the goods were handed over: the first photo's shutter time, or now.
            capturedAt: photos[0]?.capturedAt ?? bangkokNow(),
            photoFileIds,
            signatureFileId,
          },
          idempotencyKey: next.idempotencyKey,
        }),
      t("done"),
    );
    if (ok) report.done();
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
      <Field
        label={t("delivered")}
        hint={t("deliveredHint", { quantity })}
        required
        requiredLabel={tCommon("state.required")}
        error={errors.deliveredQuantity}
      >
        <NumberInput
          inputSize="lg"
          inputMode="numeric"
          min={0}
          value={delivered}
          onChange={(event) => setDelivered(event.target.value)}
        />
      </Field>
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
