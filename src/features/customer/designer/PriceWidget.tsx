"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { buildCalculateBody } from "@/features/customer/configurator/build";
import { groupsOf, isProcessInk, type Configurator } from "@/features/customer/configurator/model";
import { useLivePrice } from "@/features/customer/configurator/pricing";
import { initialState, NO_DIMS, type ConfiguratorState } from "@/features/customer/configurator/state";
import { insideSize } from "@/features/designer/document";
import { useEditor } from "@/features/designer/store/editor";
import type { DesignContent, DesignSpec } from "@/features/designer/types";
import { formatTHB } from "@/i18n/format";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Select } from "@/ui/components/Select";
import { Spinner } from "@/ui/components/Spinner";

/**
 * What the artwork needs printed, read from the design (F4 C.4): nothing when the sheet is
 * blank, one colour per distinct flat colour, full colour (4) once there is a photo or more than
 * three colours. Front only — the designer draws the outside.
 */
export function inferPrint(content: DesignContent): { printed: boolean; colours: number } {
  const colours = new Set<string>();
  let photo = false;
  for (const el of content.elements) {
    if (el.type === "image") photo = true;
    else if (el.type === "text") colours.add(el.fill.toLowerCase());
    else if (el.type === "code") {
      colours.add(el.fill.toLowerCase());
      colours.add(el.background.toLowerCase());
    } else {
      colours.add(el.fill.toLowerCase());
      if (el.strokeWidth > 0) colours.add(el.stroke.toLowerCase());
    }
  }
  if (content.pattern.kind === "solid") colours.add(content.pattern.color.toLowerCase());
  else if (content.pattern.kind !== "none")
    colours.add(content.pattern.color.toLowerCase()).add(content.pattern.background.toLowerCase());
  colours.delete("#ffffff");
  const printed = photo || colours.size > 0;
  return { printed, colours: photo || colours.size > 3 ? 4 : colours.size };
}

/**
 * The configurator's state for this design: its pattern, inside size and material, the front
 * colours that cover the artwork's — the process ink for full colour, else as many of the
 * product's inks as the artwork has colours — and the quantity chosen here. Everything else stays
 * at the product's defaults. Pure, for tests.
 */
export function stateForDesign(
  configurator: Configurator,
  spec: DesignSpec,
  content: DesignContent,
  quantity: number,
): ConfiguratorState {
  const base = initialState(configurator);
  const size = insideSize(spec);
  const choices = { ...base.choices };
  const groups = groupsOf(configurator);
  const material = groups.find((g) => g.kind === "material")?.options.find((o) => o.id === spec.materialId);
  if (material) choices.material = [material.id];
  const inks = groups.find((g) => g.kind === "print_front")?.options ?? [];
  if (inks.length > 0) {
    const need = inferPrint(content);
    const process = inks.find(isProcessInk);
    choices.print_front = !need.printed
      ? []
      : need.colours >= 4 && process
        ? [process.id]
        : inks
            .filter((ink) => !isProcessInk(ink))
            .slice(0, need.colours)
            .map((ink) => ink.id);
    if (need.printed && choices.print_front.length === 0 && process) choices.print_front = [process.id];
  }
  const pattern = configurator.patterns.find((p) => p.id === spec.patternId) ?? configurator.patterns[0];
  return {
    ...base,
    patternId: pattern?.id ?? null,
    sizeMode: "custom",
    standardSizeCode: null,
    dims: { ...NO_DIMS, l: size.length || null, w: size.width || null, d: size.height || null },
    // The designer draws the inside of the box (F4).
    basis: "internal",
    choices,
    quantities: [quantity],
    quantity,
    designOption: configurator.design.options.includes("online_designer") ? "online_designer" : base.designOption,
  };
}

/**
 * The live price in the designer's top bar (F4 C.4): the product's published calculation
 * (`store.quotes.calculate`) for this design's size, material and inferred print, at the
 * quantity chosen here. The API prices; this only formats what it returns.
 */
export function PriceWidget({ productSlug }: { productSlug: string }) {
  const t = useTranslations("designer.price");
  const locale = useLocale() as "th" | "en";
  const spec = useEditor((s) => s.spec);
  const content = useEditor((s) => s.content);

  const configurator = useQuery({
    queryKey: [...queryKeys.zone("customer"), "configurator", productSlug, locale],
    queryFn: async () => {
      const { data } = await browserApi().GET("/v1/store/catalog/products/{slug}/configurator", {
        params: { path: { slug: productSlug } },
      });
      return data!;
    },
    staleTime: 5 * 60_000,
  });
  const [quantity, setQuantity] = useState<number | null>(null);
  const qty = quantity ?? configurator.data?.quantity.default ?? null;

  // A product quoted on request (`instant: false`) is never priced here.
  const body =
    configurator.data?.instant && spec && qty
      ? buildCalculateBody(configurator.data, stateForDesign(configurator.data, spec, content, qty))
      : null;
  const price = useLivePrice(body);
  const step = price.data?.steps[0];

  if (!configurator.data) return configurator.isError ? null : <Spinner size={16} label={t("loading")} />;
  if (!configurator.data.instant)
    return (
      <div className="flex items-center gap-2 text-xs" aria-live="polite">
        <span>{t("onRequest")}</span>
      </div>
    );

  // No quantity suggested by the API: nothing to choose from here, so nothing is priced.
  if (configurator.data.quantity.presets.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs" aria-live="polite">
      <Select
        aria-label={t("quantity")}
        value={String(qty)}
        onValueChange={(value) => setQuantity(Number(value))}
        options={configurator.data.quantity.presets.map((preset) => ({
          value: String(preset),
          label: t("pieces", { count: preset }),
        }))}
        className="h-8 w-28"
      />
      {step?.grossAmount && step.unitPrice ? (
        <span className="tabular-nums">
          <b className="text-sm font-semibold">{formatTHB(step.grossAmount, locale)}</b>{" "}
          <span className="hidden lg:inline">{t("perPiece", { price: formatTHB(step.unitPrice, locale) })}</span>
        </span>
      ) : step && !step.instant ? (
        <span>{t("onRequest")}</span>
      ) : price.isError ? (
        <span>{t("failed")}</span>
      ) : null}
      {price.pending ? <Spinner size={16} label={t("updating")} /> : null}
    </div>
  );
}
