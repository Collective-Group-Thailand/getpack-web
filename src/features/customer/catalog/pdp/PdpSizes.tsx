"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  optionPricesUnsupported,
  sizeKey,
  subscribeOptionPricesSupport,
} from "@/features/customer/configurator/option-prices";
import { patternOf } from "@/features/customer/configurator/state";
import { useFormat } from "@/features/shared/format/useFormat";
import { trackPdp } from "@/lib/analytics/pdp";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

import { pickSize } from "./model";
import { usePdp } from "./PdpProvider";

type Converted = Schemas["ConvertedDimensionsDto"];

/**
 * The outside size of every standard size, for the board chosen — the configurator's own conversion
 * (`store.specs.convertDimensions`: the pattern's construction and the board's caliper, D-182). One
 * cached call per size and board; nothing is added to a dimension here.
 */
function useOutsideSizes(): Map<string, Converted["sizes"]["external"]> {
  const { configurator, selection } = usePdp();
  const pattern = patternOf(configurator, selection);
  const materialId = selection.choices.material?.[0];
  const results = useQueries({
    queries: configurator.standardSizes.map((size) => {
      const body: Schemas["ConvertDimensionsDto"] = {
        productTypeCode: configurator.productTypeCode,
        basis: "internal",
        l: size.lengthMm,
        w: size.widthMm,
        d: size.heightMm,
        ...(pattern ? { patternId: pattern.id } : {}),
        ...(materialId ? { materialId } : {}),
      };
      return {
        queryKey: [...queryKeys.zone("customer"), "convert-dimensions", JSON.stringify(body)],
        queryFn: async ({ signal }: { signal: AbortSignal }) =>
          (await browserApi().POST("/v1/store/specs/actions/convert-dimensions", { body, signal })).data!,
        staleTime: Infinity,
        retry: false,
      };
    }),
  });
  return new Map(
    configurator.standardSizes.map((size, index) => [size.code, results[index]?.data?.sizes.external ?? null]),
  );
}

/**
 * "ขนาดทั้ง N เบอร์" (pdp redesign item 5): every standard size with its inside size, its outside size
 * from the configurator's board-thickness rule (labelled as a reference), a to-scale bar (length and
 * height against the largest), the unit price at the chosen quantity for the current board and print
 * (the configurator's batch prices) and "เลือกเบอร์นี้", which sets the buy box and returns to it.
 */
export function PdpSizesTable({ buyBoxId }: { buyBoxId: string }) {
  const t = useTranslations("catalog.pdp.sizes");
  const format = useFormat();
  const { configurator, selection, choose, optionPrices } = usePdp();
  const outside = useOutsideSizes();
  // An API without the batch endpoint: the column says nothing rather than loading for ever.
  const unsupported = useSyncExternalStore(subscribeOptionPricesSupport, optionPricesUnsupported, () => false);
  const sizes = configurator.standardSizes;
  const maxL = Math.max(...sizes.map((size) => size.lengthMm));
  const maxH = Math.max(...sizes.map((size) => size.heightMm));
  const mm = (value: number) => format.number(value);
  const dims = (l: number, w: number, h: number) => `${mm(l)} × ${mm(w)} × ${mm(h)}`;
  const head = "text-muted bg-bg-subtle px-3.5 py-3 text-start text-[0.78125rem] font-medium whitespace-nowrap";

  const pick = (code: string) => {
    trackPdp("pdp_size_table_pick", { product: configurator.slug, size: code });
    choose(pickSize(configurator, selection, code), { option: "size", value: code });
    const target = document.getElementById(buyBoxId);
    if (target) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
      target.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  return (
    <div
      className="border-border bg-surface rounded-card relative overflow-x-auto border"
      tabIndex={0}
      role="region"
      aria-label={t("caption")}
    >
      <table className="w-full min-w-[45rem] border-collapse text-sm tabular-nums">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={head}>
              {t("code")}
            </th>
            <th scope="col" className={head}>
              {t("inside")}
            </th>
            <th scope="col" className={head}>
              {t("outside")}
            </th>
            <th scope="col" className={head}>
              {t("scale")}
            </th>
            <th scope="col" className={cn(head, "text-end")}>
              {t("price", { qty: format.number(selection.quantity) })}
            </th>
            <th scope="col" className={head}>
              <span className="sr-only">{t("action")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {sizes.map((size) => {
            const on = size.code === selection.standardSizeCode;
            const external = outside.get(size.code);
            const price = optionPrices.price(sizeKey(size.code));
            return (
              <tr key={size.code} className={cn(on && "bg-primary-subtle")}>
                <th scope="row" className="text-primary px-3.5 py-2.5 text-start text-[0.9375rem] font-semibold">
                  {size.code}
                </th>
                <td className="px-3.5 py-2.5">{dims(size.lengthMm, size.widthMm, size.heightMm)}</td>
                <td className="text-muted px-3.5 py-2.5">
                  {external ? dims(external.l, external.w, external.d) : <span aria-hidden="true">—</span>}
                </td>
                <td className="px-3.5 py-2.5">
                  <svg width="120" height="34" viewBox="0 0 120 34" aria-hidden="true" className="block">
                    <rect
                      x="0"
                      y={34 - (size.heightMm / maxH) * 30}
                      width={Math.max(4, (size.lengthMm / maxL) * 118)}
                      height={(size.heightMm / maxH) * 30}
                      rx="2"
                      className={on ? "fill-primary" : "fill-primary/25"}
                    />
                  </svg>
                </td>
                <td className={cn("px-3.5 py-2.5 text-end", optionPrices.pending && "opacity-60")}>
                  {price?.unitPrice ? (
                    format.thb(price.unitPrice)
                  ) : price && !price.instant ? (
                    <span className="text-muted text-xs">{t("quote")}</span>
                  ) : optionPrices.available || unsupported ? (
                    <span aria-hidden="true">—</span>
                  ) : (
                    <span className="bg-bg-subtle inline-block h-3.5 w-14 animate-pulse rounded-sm align-middle" />
                  )}
                </td>
                <td className="px-3.5 py-2 text-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-pressed={on}
                    aria-label={on ? t("pickedLabel", { size: size.code }) : t("pickLabel", { size: size.code })}
                    onClick={() => (on ? undefined : pick(size.code))}
                  >
                    {on ? t("picked") : t("pick")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
