"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { quantityBand } from "@/features/customer/analytics/bands";
import { TrackOnView } from "@/features/customer/analytics/TrackOnView";
import { useDebounced } from "@/features/customer/configurator/pricing";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { toast } from "@/ui/components/Toast";

type Preview = Schemas["ReorderPreviewDto"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * One-click reorder (D-153): the same spec, re-priced by the API as the quantity changes
 * (`store.claims.previewReorder`), and whether the approved artwork carries over so no new proof
 * is needed. Confirming sends the preview's token, so the cart is not given a price other than the
 * one shown (409 `orders.reorder_repriced`), and goes straight to checkout, which places it like
 * any other order. Plates and die blocks the factory kept are not charged again, and the saving is
 * said in words (`toolingWaiver`, D-289).
 */
export function ReorderView({
  initial,
  specs,
  unit,
}: {
  initial: Preview;
  /** What was ordered, in words (the order's `summary`). */
  specs: { term: string; description: string }[];
  unit: string;
}) {
  const t = useTranslations("fulfilment.reorder");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = initial.orderId;
  const [text, setText] = useState(String(initial.quantity));
  const [reuseArtwork, setReuseArtwork] = useState(true);
  const { min, max } = initial.quantityLimits;
  const typed = /^\d+$/.test(text) ? Number(text) : null;
  const tooFew = typed !== null && min !== null && typed < min;
  const tooMany = typed !== null && max !== null && typed > max;
  const quantity = useDebounced(typed !== null && !tooFew && !tooMany ? typed : null, 400);
  const [busy, setBusy] = useState<"checkout" | "cart" | null>(null);
  const key = useRef(newKey());
  const asked = quantity ?? initial.quantity;

  const query = useQuery({
    queryKey: [...queryKeys.related("customer", "orders", orderId, "reorder"), asked, reuseArtwork],
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/orders/{orderId}/reorder", {
          params: { path: { orderId }, query: { quantity: asked, reuseArtwork } },
        })
      ).data!,
    initialData: asked === initial.quantity && reuseArtwork ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const preview = query.data ?? initial;
  const stale = query.isFetching || (typed !== null && typed !== preview.quantity);
  const error =
    typed === null
      ? t("errors.number")
      : tooFew
        ? t("errors.min", { min: format.number(min ?? 0) })
        : tooMany
          ? t("errors.max", { max: format.number(max ?? 0) })
          : undefined;

  async function reorder(then: "checkout" | "cart") {
    setBusy(then);
    try {
      await browserApi().POST("/v1/store/orders/{orderId}/actions/reorder", {
        params: { path: { orderId }, header: { "Idempotency-Key": key.current } },
        body: { quantity: preview.quantity, reuseArtwork, previewToken: preview.previewToken },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      // The reorder funnel (docs/ux/funnels.md): packio-api bands the quantity before storing it.
      track("reorder_added_to_cart", { quantity: preview.quantity, reason: then });
      router.push(then === "checkout" ? "/checkout" : "/cart");
    } catch (failure) {
      key.current = newKey();
      if (
        isApiError(failure) &&
        (failure.code === "orders.reorder_repriced" || failure.code === "orders.reorder_preview_expired")
      )
        await query.refetch();
      toast.error(isApiError(failure) ? failure.detail : t("failed"));
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <TrackOnView name="reorder_started" properties={{ quantityBand: quantityBand(initial.quantity) }} />
      <div className="flex min-w-0 flex-col gap-6">
        {specs.length > 0 ? (
          <section aria-labelledby="reorder-what">
            <h2 id="reorder-what" className="text-lg font-semibold">
              {t("what")}
            </h2>
            <DescriptionList className="mt-3" items={specs} />
          </section>
        ) : null}
        <Callout
          tone={preview.proofSkipped ? "success" : "warning"}
          title={reuseArtwork ? t("artworkReused") : t("artworkNew")}
        >
          {preview.proofSkipped ? t("proofSkippedNoVersion") : t("proofAgain")}
        </Callout>
        {preview.toolingWaiver ? (
          // D-289: the factory kept this specification's plates or die block — not charged again.
          <Callout
            tone="success"
            title={t("toolingWaived", { amount: format.thb(preview.toolingWaiver.waivedAmount) })}
          >
            {t("toolingWaivedBody", { count: preview.toolingWaiver.tooling.length })}
          </Callout>
        ) : null}
        <Checkbox
          checked={!reuseArtwork}
          onCheckedChange={(checked) => setReuseArtwork(checked !== true)}
          label={t("newArtwork")}
          description={t("newArtworkHint")}
        />
        <Field
          label={t("quantity", { unit })}
          hint={
            min !== null
              ? t("quantityHint", { original: format.number(preview.previousQuantity), min: format.number(min) })
              : t("quantityHintNoMin", { original: format.number(preview.previousQuantity) })
          }
          error={error}
        >
          <Input
            inputMode="numeric"
            value={text}
            onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ""))}
            className="max-w-48"
          />
        </Field>
      </div>

      <aside aria-labelledby="reorder-price" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <h2 id="reorder-price" className="text-lg font-semibold">
          {t("price")}
        </h2>
        <div aria-busy={stale} className={stale ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <PriceSummary
            rows={[
              {
                label: t("product", { quantity: format.number(preview.quantity), unit }),
                value: format.thb(preview.productAmount),
              },
              ...(preview.designFeeAmount !== "0.00"
                ? [{ label: t("designFee"), value: format.thb(preview.designFeeAmount) }]
                : []),
              ...(preview.toolingAmount !== null
                ? [{ label: t("tooling"), value: format.thb(preview.toolingAmount) }]
                : []),
              ...(preview.toolingWaiver
                ? [
                    {
                      label: t("toolingWaiver"),
                      value: t("toolingWaiverValue", { amount: format.thb(preview.toolingWaiver.waivedAmount) }),
                      tone: "muted" as const,
                    },
                  ]
                : []),
              {
                label: t("shipping"),
                value: preview.shippingAmount !== null ? format.thb(preview.shippingAmount) : t("shippingAtCheckout"),
                tone: preview.shippingAmount !== null ? ("default" as const) : ("muted" as const),
              },
              { label: t("vat"), value: format.thb(preview.vatAmount), tone: "muted" as const },
            ]}
            total={{
              label: t("total"),
              value: format.thb(preview.grossAmount),
              hint: t("perUnit", { price: format.thb(preview.unitPrice), unit }),
            }}
          />
        </div>
        {preview.leadTimeDays !== null && preview.earliestShipDate ? (
          <p className="text-muted text-xs">
            {t("lead", { days: preview.leadTimeDays, date: format.date(preview.earliestShipDate) })}
          </p>
        ) : null}
        {preview.earliestDeliveryDate ? (
          <p className="text-muted text-xs">{t("arrives", { date: format.date(preview.earliestDeliveryDate) })}</p>
        ) : null}
        <p className="text-muted text-xs">{t("holds", { date: format.dateTime(preview.previewExpiresAt) })}</p>
        <Button
          loading={busy === "checkout"}
          disabled={stale || Boolean(error) || busy !== null}
          onClick={() => void reorder("checkout")}
        >
          {t("checkout")}
        </Button>
        <Button
          variant="secondary"
          loading={busy === "cart"}
          disabled={stale || Boolean(error) || busy !== null}
          onClick={() => void reorder("cart")}
        >
          {t("toCart")}
        </Button>
      </aside>
    </div>
  );
}
