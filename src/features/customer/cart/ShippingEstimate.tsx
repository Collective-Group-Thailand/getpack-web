"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { isFreeShipping } from "@/features/shared/format/shipping";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";

import { useDebounced } from "../configurator/pricing";

export type ShippingEstimateResult = Schemas["CartShippingEstimateDto"];

/**
 * "ที่อยู่จัดส่งเลือกในขั้นถัดไป" (checkout redesign item 2): the cart no longer asks for an address; an optional
 * postcode gives an estimate of delivery for the whole cart (`store.cart.estimateShipping` — the same destination
 * shipping checkout prices, nothing saved) that the summary shows as an estimate. `cartVersion` re-asks after the
 * cart changed.
 */
export function ShippingEstimate({
  cartVersion,
  onEstimate,
}: {
  cartVersion: string;
  onEstimate: (estimate: ShippingEstimateResult | null) => void;
}) {
  const t = useTranslations("cart.ship");
  const tAddress = useTranslations("checkout.flow.address");
  const tShipping = useTranslations("common.shipping");
  const format = useFormat();
  const locale = useLocale();
  const id = useId();
  const [postcode, setPostcode] = useState("");
  const settled = useDebounced(postcode, 400);
  const valid = /^\d{5}$/.test(settled);
  const query = useQuery({
    queryKey: [...queryKeys.resource("customer", "cart-shipping-estimate"), settled, cartVersion],
    enabled: valid,
    queryFn: async ({ signal }) =>
      (
        await browserApi().POST("/v1/store/cart/actions/estimate-shipping", {
          body: { postcode: settled },
          signal,
        })
      ).data!,
    staleTime: 60_000,
  });
  const estimate = valid ? (query.data ?? null) : null;
  useEffect(() => onEstimate(estimate?.available ? estimate : null), [estimate, onEstimate]);
  const invalid = postcode.length === 5 && !/^\d{5}$/.test(postcode);

  return (
    <div className="flex gap-3 text-[13.5px]">
      <Icon name="truck" size={20} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-fg m-0 font-semibold">{t("title")}</p>
        <p className="text-muted m-0">{t("body")}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label htmlFor={id} className="sr-only">
            {t("postcode")}
          </label>
          <input
            id={id}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder={t("placeholder")}
            value={postcode}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-result`}
            onChange={(event) => setPostcode(event.target.value.replace(/\D/g, "").slice(0, 5))}
            className="border-border bg-surface focus-visible:border-primary focus-visible:ring-focus-ring h-9.5 w-36 rounded-lg border px-2.5 font-semibold tracking-wider tabular-nums outline-none focus-visible:ring-2"
          />
          <span id={`${id}-result`} className="text-muted text-[12.5px]" aria-live="polite">
            {invalid
              ? t("invalid")
              : valid && query.isFetching
                ? t("pending")
                : estimate
                  ? estimate.available && estimate.shippingGrossAmount
                    ? [
                        isFreeShipping(estimate.shippingGrossAmount)
                          ? tShipping("free")
                          : t("estimate", { amount: format.thb(estimate.shippingGrossAmount) }),
                        estimate.zone
                          ? tAddress("zone", { zone: locale === "en" ? estimate.zone.en : estimate.zone.th })
                          : null,
                        estimate.arrival
                          ? estimate.arrival.from === estimate.arrival.to
                            ? tAddress("arrivalOne", { date: format.date(estimate.arrival.from) })
                            : tAddress("arrival", {
                                from: format.date(estimate.arrival.from),
                                to: format.date(estimate.arrival.to),
                              })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : t("unavailable")
                  : null}
          </span>
        </div>
      </div>
    </div>
  );
}
