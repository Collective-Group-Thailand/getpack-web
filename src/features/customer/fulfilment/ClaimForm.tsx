"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { PhotoPicker, type PickedPhoto } from "./PhotoPicker";

type Form = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/claim-form">;
type ClaimType = Form["types"][number];
type Resolution = Form["resolutions"][number];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Filing a claim (D-082): what went wrong, on which delivery and how many, what the customer
 * wants — and photos of the product **and** of the shipping carton, both required. The window and
 * the options are the API's; errors are listed at the top and next to each field (WCAG 3.3.1).
 */
export function ClaimForm({ orderId, orderCode, form }: { orderId: string; orderCode: string; form: Form }) {
  const t = useTranslations("fulfilment.claim");
  const types = useTranslations("myOrders.claimTypes");
  const format = useFormat();
  const router = useRouter();
  const [type, setType] = useState<ClaimType | undefined>();
  const [shipmentId, setShipmentId] = useState(form.shipments[0]?.id);
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState<Resolution | undefined>();
  const [product, setProduct] = useState<PickedPhoto[]>([]);
  const [carton, setCarton] = useState<PickedPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  const uploaded = (photos: PickedPhoto[]) => photos.filter((photo) => photo.fileId).map((photo) => photo.fileId!);
  const uploading = [...product, ...carton].some((photo) => !photo.fileId && !photo.failed);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!type) found.type = t("errors.type");
    if (description.trim().length < 10) found.description = t("errors.description");
    if (!resolution) found.resolution = t("errors.resolution");
    if (quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1)) found.quantity = t("errors.quantity");
    if (uploaded(product).length < form.evidence.minProductPhotos)
      found.product = t("errors.product", { min: form.evidence.minProductPhotos });
    if (uploaded(carton).length < form.evidence.minCartonPhotos)
      found.carton = t("errors.carton", { min: form.evidence.minCartonPhotos });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById("claim-errors")?.focus();
      return;
    }
    setBusy(true);
    try {
      const claim = await browserRequests().call("POST /v1/store/orders/{orderId}/claims", {
        path: { orderId },
        body: {
          type: type!,
          ...(shipmentId ? { shipmentId } : {}),
          ...(quantity ? { affectedQuantity: Number(quantity) } : {}),
          description: description.trim(),
          requestedResolution: resolution!,
          productPhotoFileIds: uploaded(product),
          cartonPhotoFileIds: uploaded(carton),
        },
        idempotencyKey: key.current,
      });
      toast.success(t("sent", { claim: claim.claimNo }));
      router.push(`/account/orders/${orderId}/claims/${claim.id}`);
    } catch (error) {
      key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  }

  if (!form.open)
    return (
      <Callout tone="neutral" title={t("closedTitle")}>
        {t("closed", { date: format.dateTime(form.windowEndsAt) })}
      </Callout>
    );

  const messages = Object.values(errors);

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-2xl flex-col gap-6">
      <Callout tone="info">{t("window", { code: orderCode, date: format.dateTime(form.windowEndsAt) })}</Callout>
      {messages.length > 0 ? (
        <div id="claim-errors" tabIndex={-1} role="alert" className="outline-none">
          <Callout tone="danger" title={t("errors.title", { count: messages.length })}>
            <ul className="list-disc ps-5">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}

      <Field label={t("type")} required requiredLabel={t("required")} error={errors.type}>
        <RadioCards
          columns={3}
          value={type}
          onValueChange={setType}
          options={form.types.map((value) => ({ value, label: types(value) }))}
        />
      </Field>

      {form.shipments.length > 1 ? (
        <Field label={t("shipment")}>
          <Select
            value={shipmentId}
            onValueChange={setShipmentId}
            options={form.shipments.map((shipment) => ({
              value: shipment.id,
              label: t("shipmentOption", { shipment: shipment.shipmentNo, province: shipment.province }),
            }))}
          />
        </Field>
      ) : null}

      <Field label={t("quantity")} hint={t("quantityHint")} error={errors.quantity}>
        <Input
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="max-w-40"
        />
      </Field>

      <Field
        label={t("description")}
        hint={t("descriptionHint")}
        required
        requiredLabel={t("required")}
        error={errors.description}
      >
        <Textarea
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t("productPhotos")} <span className="text-muted font-normal">{t("required")}</span>
        </legend>
        <p id="claim-product-hint" className="text-muted text-xs">
          {errors.product ? <span className="text-danger">{errors.product}</span> : t("productHint")}
        </p>
        <PhotoPicker
          id="claim-product"
          accept={form.evidence.accept}
          maxBytes={form.evidence.maxBytes}
          max={form.evidence.maxPhotos}
          photos={product}
          onChange={setProduct}
          invalid={Boolean(errors.product)}
          describedBy="claim-product-hint"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t("cartonPhotos")} <span className="text-muted font-normal">{t("required")}</span>
        </legend>
        <p id="claim-carton-hint" className="text-muted text-xs">
          {errors.carton ? <span className="text-danger">{errors.carton}</span> : t("cartonHint")}
        </p>
        <PhotoPicker
          id="claim-carton"
          accept={form.evidence.accept}
          maxBytes={form.evidence.maxBytes}
          max={form.evidence.maxPhotos}
          photos={carton}
          onChange={setCarton}
          invalid={Boolean(errors.carton)}
          describedBy="claim-carton-hint"
        />
      </fieldset>

      <Field label={t("resolution")} required requiredLabel={t("required")} error={errors.resolution}>
        <RadioCards
          columns={2}
          value={resolution}
          onValueChange={setResolution}
          options={form.resolutions.map((value) => ({
            value,
            label: t(`resolutions.${value}`),
            description: t(`resolutionHints.${value}`),
          }))}
        />
      </Field>

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" loading={busy} disabled={uploading}>
          {t("submit")}
        </Button>
        {uploading ? <p className="text-muted text-xs">{t("waitUploads")}</p> : null}
      </div>
    </form>
  );
}
