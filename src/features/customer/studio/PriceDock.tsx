"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { buildCalculateBody } from "@/features/customer/configurator/build";
import type { Configurator } from "@/features/customer/configurator/model";
import { useLivePrice } from "@/features/customer/configurator/pricing";
import { stateForDesign } from "./state";
import type { Persistence } from "@/features/designer/data/persistence";
import { canonicalJson, sameJson } from "@/features/designer/lib/json-patch";
import { useEditor } from "@/features/designer/store/editor";
import { formatDate, formatTHB } from "@/i18n/format";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Spinner } from "@/ui/components/Spinner";
import { cn } from "@/ui/lib/cn";

import { useStudioQuote } from "./pricing";
import { studioFieldsOf } from "./spec";

type Step = Schemas["QuoteStepDto"];

export interface PriceDockProps {
  configurator: Configurator | null;
  /** `studio` prices the saved version (signed in); `guest` prices the same configuration directly. */
  source: "studio" | "guest";
  persistence: Persistence;
  /** The flexo spot-colour limit (D-278), so the spec counts no more inks than flexo may print. */
  maxSpot: number | null;
  layout: "rail" | "bar";
  quantity: number | null;
  onQuantity: (quantity: number) => void;
  /** ⑤ — the dock's primary action. */
  onOrder: () => void;
  orderDisabled: boolean;
  /** Why the order button is off, said under it — a disabled button with no reason is a dead end. */
  orderDisabledReason?: string;
  /** No order button: the order step's own panel holds the one order action (no two buttons for one thing). */
  hideOrder?: boolean;
}

/**
 * The price dock (studio-spec §2): from ② onwards, the real price of exactly this design — per
 * piece, the quantity chip, the total including VAT, lead time and earliest delivery, and why the
 * price last changed — and the one primary action, สั่งผลิต. Every figure is the API's
 * (`store.studio.quote` for a saved design, `store.quotes.calculate` for a guest's); nothing is
 * computed here. A type quoted on request shows the request path and its response time instead,
 * never a price.
 */
export function PriceDock({
  configurator,
  source,
  persistence,
  maxSpot,
  layout,
  quantity,
  onQuantity,
  onOrder,
  orderDisabled,
  orderDisabledReason,
  hideOrder = false,
}: PriceDockProps) {
  const t = useTranslations("studio.dock");
  const locale = useLocale() as "th" | "en";
  const spec = useEditor((s) => s.spec);
  const content = useEditor((s) => s.content);
  const qty = quantity ?? configurator?.quantity.default ?? null;
  const { savedBox, serverId, state: saveState } = persistence;

  // The version on the server must hold this box before the studio can price it: once the
  // product's configurator is known, a design whose saved spec differs is saved (then priced).
  const fields = configurator && source === "studio" ? studioFieldsOf(configurator, spec, content, maxSpot) : null;
  const behind = !!fields && !sameJson(fields, savedBox.box);
  const fieldsKey = fields ? canonicalJson(fields) : null;
  const tried = useRef<string | null>(null);
  const { save } = persistence;
  useEffect(() => {
    if (!behind || !serverId() || saveState !== "saved" || tried.current === fieldsKey) return;
    tried.current = fieldsKey;
    void save("autosave");
  }, [behind, fieldsKey, saveState, serverId, save]);

  const studio = useStudioQuote({
    designId: source === "studio" ? serverId() : null,
    versionNo: savedBox.versionNo,
    box: behind ? null : savedBox.box,
    quantity: qty,
  });
  const guestBody =
    source === "guest" && configurator?.instant && spec && qty
      ? buildCalculateBody(configurator, stateForDesign(configurator, spec, content, qty, maxSpot))
      : null;
  const guest = useLivePrice(guestBody);

  const rfq = !!configurator && (!configurator.instant || studio.data?.mode === "rfq");
  const sla = useQuery({
    queryKey: [...queryKeys.zone("customer"), "rfq-form", configurator?.productTypeCode],
    queryFn: async () => {
      const { data } = await browserApi().GET("/v1/store/rfq-forms/{productTypeCode}", {
        params: { path: { productTypeCode: configurator!.productTypeCode } },
      });
      return data!.slaTargetHours ?? null;
    },
    enabled: rfq,
    staleTime: 10 * 60_000,
  });

  const calculation = source === "studio" ? studio.data?.calculation : guest.data;
  const step: Step | undefined = calculation?.steps.find((s) => s.quantity === qty) ?? calculation?.steps[0];
  const pending = (source === "studio" ? studio.pending || behind : guest.pending) && !rfq;
  const failed = source === "studio" ? studio.isError : guest.isError;
  const change = studio.data?.changes.find((c) => c.quantity === qty);
  const reasons = studio.data?.reasons ?? [];

  // The API's suggested quantities when it has some; otherwise any quantity in its range.
  const quantityChip = !configurator ? null : configurator.quantity.presets.length > 0 && qty ? (
    <SearchableSelect
      aria-label={t("quantity")}
      value={String(qty)}
      onValueChange={(value) => onQuantity(Number(value))}
      options={configurator.quantity.presets.map((preset) => ({
        value: String(preset),
        label: t("pieces", { count: preset }),
      }))}
      className={layout === "bar" ? "h-9 w-28" : "w-full"}
    />
  ) : (
    <QuantityField
      label={t("quantity")}
      value={qty}
      min={configurator.quantity.min}
      max={configurator.quantity.max}
      onCommit={onQuantity}
      className={layout === "bar" ? "w-28" : "w-full"}
    />
  );

  const orderButton = hideOrder ? null : (
    <div className={cn("flex flex-col gap-1.5", layout === "rail" && "w-full")}>
      <Button onClick={onOrder} disabled={orderDisabled} className={layout === "rail" ? "w-full" : undefined}>
        {rfq ? t("requestQuote") : t("order")}
      </Button>
      {orderDisabled && orderDisabledReason && layout === "rail" ? (
        <p className="text-muted text-xs" role="status">
          {orderDisabledReason}
        </p>
      ) : null}
    </div>
  );

  const priceText = rfq ? (
    <p className="text-sm">
      <span className="font-semibold">{t("onRequest")}</span>
      {sla.data ? <span className="text-muted block text-xs">{t("sla", { hours: sla.data })}</span> : null}
    </p>
  ) : step?.unitPrice && step.grossAmount ? (
    <p className="tabular-nums">
      <span className={cn("font-semibold", layout === "rail" ? "text-2xl" : "text-lg")}>
        {formatTHB(step.unitPrice, locale)}
      </span>
      <span className="text-muted text-sm">{t("perPiece")}</span>
      <span className="block text-sm">{t("total", { amount: formatTHB(step.grossAmount, locale) })}</span>
    </p>
  ) : step && !step.instant ? (
    <p className="text-sm font-semibold">{t("onRequest")}</p>
  ) : failed ? (
    <p className="text-danger text-sm">{t("failed")}</p>
  ) : !configurator || !spec ? (
    <p className="text-muted text-sm">{t("needsBox")}</p>
  ) : !qty ? (
    <p className="text-muted text-sm">{t("needsQuantity")}</p>
  ) : (
    <p className="text-muted text-sm">{t("calculating")}</p>
  );

  const why =
    !rfq && (reasons.length > 0 || change) ? (
      <p className="text-muted text-xs" role="status">
        {change
          ? t("changedFromTo", {
              from: formatTHB(change.previousUnitPrice, locale),
              to: formatTHB(change.unitPrice, locale),
            })
          : t("changed")}{" "}
        {reasons.length > 0
          ? t("because", { reasons: reasons.map((reason) => t(`reasons.${reason}`)).join(", ") })
          : null}
      </p>
    ) : null;

  const lead =
    !rfq && step?.leadTimeDays ? (
      <p className="text-xs">
        {t("leadTime", { days: step.leadTimeDays })}
        {step.earliestDeliveryDate
          ? ` · ${t("delivery", { date: formatDate(step.earliestDeliveryDate, locale) })}`
          : null}
      </p>
    ) : null;

  if (layout === "bar")
    return (
      <section aria-label={t("label")} aria-live="polite" data-coach="studio-price" className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {priceText}
          {pending ? <Spinner size={14} label={t("updating")} /> : null}
        </div>
        {quantityChip}
        {orderButton}
      </section>
    );

  return (
    <section aria-label={t("label")} data-coach="studio-price" className="flex flex-col gap-3">
      <h2 className="font-semibold">{t("title")}</h2>
      {quantityChip}
      <div aria-live="polite" className="flex flex-col gap-1">
        {priceText}
        {lead}
        {why}
        {pending ? (
          <p className="text-muted flex items-center gap-2 text-xs">
            <Spinner size={14} label={t("updating")} /> {t("updating")}
          </p>
        ) : null}
      </div>
      {!rfq ? <p className="text-muted text-xs">{t("vatIncluded")}</p> : null}
      {orderButton}
    </section>
  );
}

/** A typed quantity, committed when it is a whole number in the product's range. */
function QuantityField({
  label,
  value,
  min,
  max,
  onCommit,
  className,
}: {
  label: string;
  value: number | null;
  min: number | null;
  max: number | null;
  onCommit: (quantity: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <Input
      type="number"
      inputMode="numeric"
      aria-label={label}
      placeholder={label}
      min={min ?? 1}
      max={max ?? undefined}
      value={text}
      className={className}
      onChange={(event) => {
        setText(event.target.value);
        const n = Number(event.target.value);
        if (Number.isInteger(n) && n >= (min ?? 1) && (max === null || n <= max)) onCommit(n);
      }}
    />
  );
}
