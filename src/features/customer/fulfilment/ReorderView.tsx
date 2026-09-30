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
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PriceSummary } from "@/ui/components/PriceSummary";
import { toast } from "@/ui/components/Toast";

type Preview = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/reorder">;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * One-click reorder (D-153): the same spec and artwork, re-priced by the API as the quantity
 * changes, with the one-off costs it waives shown as waived and why. Confirming puts it in the
 * cart as a quotation and goes straight to checkout, which places it like any other order.
 */
export function ReorderView({ initial }: { initial: Preview }) {
  const t = useTranslations("fulfilment.reorder");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = initial.source.orderId;
  const [text, setText] = useState(String(initial.quantity));
  const typed = /^\d+$/.test(text) ? Number(text) : null;
  const tooFew = typed !== null && typed < initial.minQuantity;
  const tooMany = typed !== null && initial.maxQuantity !== null && typed > initial.maxQuantity;
  const quantity = useDebounced(typed !== null && !tooFew && !tooMany ? typed : null, 400);
  const [busy, setBusy] = useState<"checkout" | "cart" | null>(null);
  const key = useRef(newKey());

  const query = useQuery({
    queryKey: [...queryKeys.related("customer", "orders", orderId, "reorder"), quantity ?? initial.quantity],
    queryFn: () =>
      browserRequests().call("GET /v1/store/orders/{orderId}/reorder", {
        path: { orderId },
        query: { quantity: quantity ?? initial.quantity },
      }),
    initialData: quantity === null || quantity === initial.quantity ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const preview = query.data ?? initial;
  const stale = query.isFetching || (typed !== null && typed !== preview.quantity);
  const error =
    typed === null
      ? t("errors.number")
      : tooFew
        ? t("errors.min", { min: format.number(initial.minQuantity) })
        : tooMany
          ? t("errors.max", { max: format.number(initial.maxQuantity ?? 0) })
          : undefined;

  async function reorder(then: "checkout" | "cart") {
    setBusy(then);
    try {
      // `store.claims.reorder` adds the line straight to the cart; the preview it answered with is
      // not bound to it (CONTRACT-GAP store.reorder: no preview token), so the price shown is the
      // one the cart will re-check.
      await browserApi().POST("/v1/store/orders/{orderId}/actions/reorder", {
        params: { path: { orderId }, header: { "Idempotency-Key": key.current } },
        body: { quantity: preview.quantity, reuseArtwork: preview.artwork.reused },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.resource("customer", "cart") });
      // The reorder funnel (docs/ux/funnels.md): the band, never the quantity; where it went next.
      track("reorder_added_to_cart", { quantityBand: quantityBand(preview.quantity), reason: then });
      router.push(then === "checkout" ? "/checkout" : "/cart");
    } catch (failure) {
      key.current = newKey();
      if (isApiError(failure) && failure.code === "reorder.repriced") await query.refetch();
      toast.error(isApiError(failure) ? failure.detail : t("failed"));
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <TrackOnView name="reorder_started" properties={{ quantityBand: quantityBand(initial.quantity) }} />
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="reorder-what">
          <h2 id="reorder-what" className="text-lg font-semibold">
            {t("what")}
          </h2>
          <DescriptionList
            className="mt-3"
            items={preview.specs.map((spec) => ({ term: spec.label, description: spec.value }))}
          />
        </section>
        <Callout
          tone={preview.artwork.reused ? "success" : "warning"}
          title={preview.artwork.reused ? t("artworkReused") : t("artworkNew")}
        >
          {preview.artwork.reused
            ? preview.artwork.proofSkipped
              ? t("proofSkipped", { version: preview.artwork.approvedProofVersion ?? 1 })
              : t("proofAgain")
            : preview.artwork.note}
        </Callout>
        <Field
          label={t("quantity", { unit: preview.unit })}
          hint={t("quantityHint", {
            original: format.number(preview.source.quantity),
            min: format.number(preview.minQuantity),
          })}
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
              ...preview.lines.map((line) => ({
                label: line.description,
                value: line.waivedReason ? t("waived") : format.thb(line.grossAmount),
                hint: line.waivedReason ?? undefined,
                tone: line.waivedReason ? ("discount" as const) : ("default" as const),
              })),
              { label: t("vat"), value: format.thb(preview.vatAmount), tone: "muted" as const },
            ]}
            total={{
              label: t("total"),
              value: format.thb(preview.grossAmount),
              hint: t("perUnit", { price: format.thb(preview.unitPrice), unit: preview.unit }),
            }}
          />
        </div>
        {preview.priceChanged ? (
          <p className="text-muted text-xs">
            {t("priceChanged", { before: format.thb(preview.source.unitPrice), code: preview.source.orderCode })}
          </p>
        ) : null}
        <p className="text-muted text-xs">
          {t("lead", { days: preview.leadTimeDays, date: format.date(preview.earliestShipDate) })}
        </p>
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
