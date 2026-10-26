"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useJustAdded } from "@/features/customer/cart/cart-events";
import { useFormat } from "@/features/shared/format/useFormat";
import { specLabelText } from "@/features/shared/spec-label";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Meter } from "@/ui/components/Meter";
import { PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import type { Schemas } from "@/lib/api/types";

import type { PriceStep } from "./pricing";
import type { Configurator, ConfiguratorState } from "./state";
import type { KeptQuote, QuoteAction } from "./useQuoteActions";

export interface ConfiguratorDockProps {
  configurator: Configurator;
  state: ConfiguratorState;
  /** The sales unit in the reader's language. */
  unit: string;
  /** The API's gap to the target for the quantity on screen (D-247), when a target was given. */
  gap: Schemas["QuoteStepGapDto"] | null;
  /** Why no price can be asked for yet ("เลือกวัสดุ"), in the order the stepper asks. */
  missing: string[];
  steps: PriceStep[] | undefined;
  /** The spec the calculation priced, as the API words it (`QuoteCalculationDto.specLabel`, D-441). */
  specLabel?: Schemas["LocalisedLabelDto"] | null;
  loading: boolean;
  pending: boolean;
  failed: boolean;
  /** Why the API refused the print choice (`pricing.print_combination_invalid`), one line per side. */
  refusal?: string[] | null;
  onRetry: () => void;
  onAction: (action: QuoteAction) => void;
  /** A link of the summary followed (analytics): the quotation form, the Studio, the LINE chat. */
  onLink?: (link: "rfq" | "studio" | "line") => void;
  busy: QuoteAction | null;
  lastQuote: KeptQuote | null;
  /** Where to ask for a quote instead, with the configuration carried along. */
  rfqHref: string;
  /** The online designer, seeded with this box — `null` where it cannot draw the product. */
  designHref: string | null;
  /** "Ask CS" on LINE, with the configuration as the message — `null` without an account id. */
  lineHref: string | null;
  /** How many of the steps that need an answer the customer has given one (the chips' "done"). */
  completeness?: { done: number; total: number };
  /** Scrolls to the shipping step: the link in the shipping line and in the completeness row. */
  onGoToShipping?: () => void;
  /**
   * The area the postcode resolves to ("กรุงเทพมหานคร"), under the shipping line. The calculation names no
   * shipping zone, so this is the geo lookup's province (OPEN QUESTION in the C4 report).
   */
  shippingArea?: string | null;
  /** The discount code field, when the configurator offers one. */
  promo?: React.ReactNode;
}

/**
 * The instant quote (F3 3.2): per piece, what the total is made of, when it can ship, the
 * tolerance the factory works to (D-021), how long a saved price holds (D-051), the price per
 * quantity — and what to do next.
 *
 * Every figure is the API's (`store.quotes.calculate`). The mockup add-on and a promotion code
 * are not part of that calculation — the mockup is priced on the cart line and a code is applied
 * to the cart — and the dock says so rather than leaving them out silently.
 */
export function ConfiguratorDock({
  configurator,
  state,
  unit,
  gap,
  missing,
  steps,
  specLabel,
  loading,
  pending,
  failed,
  refusal,
  onRetry,
  onAction,
  onLink,
  busy,
  lastQuote,
  rfqHref,
  designHref,
  lineHref,
  completeness,
  onGoToShipping,
  shippingArea,
  promo,
}: ConfiguratorDockProps) {
  const t = useTranslations("configurator.dock");
  const tActions = useTranslations("configurator.actions");
  const justAdded = useJustAdded();
  const format = useFormat();
  const step = steps?.find((candidate) => candidate.quantity === state.quantity);
  const priced = step?.instant ? step : null;
  const noPrice = step && !step.instant ? step : null;
  const ready = missing.length === 0;
  const reason = usePriceChange(priced?.unitPrice ? { unitPrice: priced.unitPrice, quantity: priced.quantity } : null);

  // Quoted on request (`instant: false`, D-043): no price is asked for, the RFQ form is the way on.
  const status = !configurator.instant ? (
    <div>
      <p className="font-semibold">{t("notInstant")}</p>
      <p className="text-muted text-sm">{t("notInstantHint")}</p>
    </div>
  ) : !ready ? (
    <div>
      <p className="font-semibold">{t("notReady")}</p>
      <p className="text-muted text-sm">{t("stillNeeded", { items: missing.join(", ") })}</p>
    </div>
  ) : refusal && !priced ? (
    <div role="alert">
      <p className="font-semibold">{t("printRefused")}</p>
      <ul className="text-muted text-sm">
        {refusal.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  ) : failed && !priced ? (
    <div className="flex flex-col items-start gap-2">
      <p className="font-semibold">{t("failed")}</p>
      <Button size="sm" variant="secondary" iconStart="refresh" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  ) : loading && !step ? (
    <div className="flex flex-col gap-2" aria-busy="true">
      <span className="sr-only">{t("calculating")}</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-56" />
    </div>
  ) : noPrice ? (
    // The main price area itself becomes the quotation request for this quantity and spec; the
    // button below carries the configuration to the RFQ form (`rfqHref`, with the calculation).
    <div>
      <p className="font-semibold">{t("quoteForQuantity", { quantity: format.number(noPrice.quantity), unit })}</p>
      <p className="text-muted text-sm">{t(`reasons.${noPrice.reason ?? "no_price_path"}`)}</p>
      {specLabel ? (
        <p className="text-muted mt-1 text-xs leading-snug">{specLabelText(specLabel, format.locale)}</p>
      ) : null}
    </div>
  ) : undefined;

  const toShipping = (
    <button
      type="button"
      onClick={onGoToShipping}
      className="text-primary focus-visible:ring-focus-ring rounded-sm underline underline-offset-4 outline-none focus-visible:ring-2"
    >
      {t("shippingPending")}
    </button>
  );
  const rows: PriceRow[] = priced
    ? [
        {
          label: t("product", { quantity: format.number(priced.quantity), unit }),
          value: format.thb(priced.productAmount),
        },
        ...(priced.designFeeAmount && priced.designFeeAmount !== "0.00"
          ? [{ label: t("designFee"), value: format.thb(priced.designFeeAmount), hint: t("oneOff") }]
          : []),
        ...(priced.structureDesignFeeAmount && priced.structureDesignFeeAmount !== "0.00"
          ? [{ label: t("structureFee"), value: format.thb(priced.structureDesignFeeAmount), hint: t("oneOff") }]
          : []),
        priced.shippingPending
          ? { label: t("shipping"), value: onGoToShipping ? toShipping : t("shippingPending") }
          : {
              label: t("shipping"),
              value: format.thb(priced.shippingAmount),
              ...(shippingArea ? { hint: t("shippingTo", { area: shippingArea }) } : {}),
            },
        // The API's VAT amount exactly as sent: it is inside the total, never added to it (D-441).
        { label: t("vatLine"), value: format.thb(priced.vatAmount) },
      ]
    : [];

  const primary = priced ? (
    justAdded ? (
      // For a few seconds after an add, the same place takes the customer to the cart (round 2, B7).
      <Button block asChild variant="secondary" iconStart="check">
        <Link href="/cart">{tActions("goToCart")}</Link>
      </Button>
    ) : (
      <Button block loading={busy === "cart"} onClick={() => onAction("cart")} iconStart="cart">
        {tActions("addToCart")}
      </Button>
    )
  ) : (
    <Button block asChild variant={noPrice || !configurator.instant ? "primary" : "secondary"}>
      <Link href={rfqHref} onClick={() => onLink?.("rfq")}>
        {tActions("requestQuote")}
      </Link>
    </Button>
  );

  // The three ways to keep this price (prototype `.acts3`): a quotation held for its validity, a link, a PDF.
  const keepActions: { action: QuoteAction; icon: "save" | "link" | "download"; label: string }[] = [
    { action: "save", icon: "save", label: tActions("quote") },
    { action: "share", icon: "link", label: tActions("share") },
    { action: "pdf", icon: "download", label: tActions("pdf") },
  ];
  const secondary = (
    <>
      {priced ? (
        <div className="grid grid-cols-3 gap-1.5">
          {keepActions.map(({ action, icon, label }) => (
            <Button
              key={action}
              size="sm"
              variant="secondary"
              iconStart={icon}
              loading={busy === action}
              onClick={() => onAction(action)}
              className="h-auto min-h-16 flex-col gap-1 px-1 py-2.5 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      {priced && designHref ? (
        <Button block size="sm" variant="ghost" asChild iconStart="palette">
          <Link href={designHref} onClick={() => onLink?.("studio")}>
            {tActions("designNow")}
          </Link>
        </Button>
      ) : null}
      {priced ? (
        <Button
          block
          size="sm"
          variant="ghost"
          iconStart="package-check"
          loading={busy === "sample"}
          onClick={() => onAction("sample")}
        >
          {tActions("requestSample")}
        </Button>
      ) : null}
      {lineHref ? (
        <Button block size="sm" variant="ghost" asChild iconStart="chat">
          <a href={lineHref} target="_blank" rel="noopener noreferrer" onClick={() => onLink?.("line")}>
            {tActions("askCs")}
          </a>
        </Button>
      ) : null}
    </>
  );

  const headline = priced ? (
    // A changed price is highlighted once, with why it changed (U5.7 §1): what the customer
    // changed, never a computed difference — the figures are the API's.
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span key={priced.unitPrice ?? "none"} className={reason ? "pk-flash rounded-sm px-1" : undefined}>
        {t("perPiece", { price: format.thb(priced.unitPrice), unit })}
      </span>
      {reason ? (
        <Badge size="sm" tone="info" icon="info">
          {t(`changed.${reason}`)}
        </Badge>
      ) : null}
    </span>
  ) : null;
  const subline = priced
    ? t("total", { total: format.thb(priced.grossAmount), quantity: format.number(priced.quantity), unit })
    : null;
  const basis = priced ? specLabelText(specLabel, format.locale) : null;
  // Where the shipment is going decides which date is shown: the arrival once a postcode is known.
  const arrivalDate = priced?.earliestDeliveryDate ?? lastQuote?.option.earliestDeliveryDate ?? null;

  return (
    <>
      {/*
        The price summary (prototype `.sum`): beside the steps from 1100 px, sticky under the storefront
        header so the total and the button stay in view while every step is scrolled; below that it is
        the last block of the single column, and the bar underneath carries the price and the action.
      */}
      <aside
        aria-label={t("title")}
        className="flex flex-col gap-3 min-[1100px]:sticky min-[1100px]:top-[calc(var(--site-sticky-top)+1rem)] min-[1100px]:max-h-[calc(100dvh-var(--site-sticky-top)-2rem)] min-[1100px]:self-start min-[1100px]:overflow-y-auto"
      >
        <div className="border-border bg-surface rounded-card shadow-card flex flex-col gap-3.5 border p-5 sm:p-[1.375rem]">
          <h2 className="text-muted m-0 text-sm font-normal">{t("title")}</h2>
          <div aria-live="polite" aria-atomic="true">
            {status ?? (
              <>
                <p className="serif m-0 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-4xl leading-none tabular-nums">
                  <span
                    key={priced?.unitPrice ?? "none"}
                    data-unit-price=""
                    className={reason ? "pk-flash rounded-sm px-1" : undefined}
                  >
                    {format.thb(priced?.unitPrice)}
                  </span>
                  <small className="text-muted font-sans text-[0.9375rem] font-medium tracking-normal">
                    {t("perUnit", { unit })}
                  </small>
                  {reason ? (
                    <Badge size="sm" tone="info" icon="info" className="ms-1 self-center">
                      {t(`changed.${reason}`)}
                    </Badge>
                  ) : null}
                </p>
                {subline ? <p className="text-muted mt-2 mb-0 text-sm tabular-nums">{subline}</p> : null}
                {basis ? <p className="text-muted mt-1 mb-0 text-xs leading-snug">{basis}</p> : null}
              </>
            )}
          </div>
          {priced ? (
            <div
              className={pending ? "flex flex-col gap-3.5 opacity-60 transition-opacity" : "flex flex-col gap-3.5"}
              aria-busy={pending || undefined}
            >
              <PriceSummary
                aria-label={t("summary")}
                rows={rows}
                total={{
                  label: priced.shippingPending ? t("totalNoShipping") : t("grandTotal"),
                  value: format.thb(priced.grossAmount),
                }}
                className="border-border border-t pt-3"
              />
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {arrivalDate || priced.earliestShipDate ? (
                  <li className="flex items-start gap-2">
                    <Icon name="truck" size={16} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                    {arrivalDate
                      ? t("receiveBy", { date: format.date(arrivalDate) })
                      : t("shipBy", { date: format.date(priced.earliestShipDate) })}
                  </li>
                ) : null}
                {priced.leadTimeDays != null ? (
                  <li className="flex items-start gap-2">
                    <Icon name="clock" size={16} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                    {t("leadTime", { days: priced.leadTimeDays })}
                  </li>
                ) : null}
                {priced.toleranceShortagePct && priced.toleranceOveragePct ? (
                  <li className="flex items-start gap-2">
                    <Icon name="scale" size={16} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                    {t("toleranceLine", {
                      shortage: format.percent(priced.toleranceShortagePct, 1),
                      overage: format.percent(priced.toleranceOveragePct, 1),
                    })}
                  </li>
                ) : null}
                {gap ? (
                  <li className="flex items-start gap-2">
                    <Icon name="flag" size={16} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                    {gap.meetsTarget ? t("targetMet") : t("targetAbove", { gap: format.thb(gap.gapPerUnit), unit })}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            {primary}
            {secondary}
          </div>
          {priced ? (
            <p className="text-muted m-0 text-xs">
              {t("retention", { days: configurator.quoteValidityDays })}
              {state.promoCode.trim() ? ` · ${t("appliedOnQuote")}` : ""}
            </p>
          ) : null}
        </div>

        {completeness || promo ? (
          <div className="border-border bg-surface rounded-card flex flex-col gap-2.5 border px-4.5 py-4">
            {completeness ? (
              <div className="flex items-center gap-2.5 text-sm">
                <span className="shrink-0 tabular-nums">
                  {t("completeness", { done: completeness.done, total: completeness.total })}
                </span>
                <Meter
                  className="flex-1"
                  label={t("completenessLabel")}
                  value={completeness.total > 0 ? (completeness.done / completeness.total) * 100 : 0}
                  valueText={t("completeness", { done: completeness.done, total: completeness.total })}
                  tone={completeness.done >= completeness.total ? "success" : "primary"}
                />
                {onGoToShipping && priced?.shippingPending ? (
                  <button
                    type="button"
                    onClick={onGoToShipping}
                    className="text-primary focus-visible:ring-focus-ring shrink-0 rounded-sm text-xs underline underline-offset-4 outline-none focus-visible:ring-2"
                  >
                    {t("addPostcode")}
                  </button>
                ) : null}
              </div>
            ) : null}
            {promo}
          </div>
        ) : null}
      </aside>

      {/*
        The phone / tablet bar (prototype `.mbar2`): price per piece, quantity and total, and the one
        action. It sits above the storefront's bottom nav (`--mobile-tab-h`; none from md up), and the
        LINE button lifts over it (`LineFloat` reads `data-quote-bar`).
      */}
      <div
        data-quote-bar
        className="border-border bg-surface z-sticky shadow-overlay fixed inset-x-0 bottom-(--mobile-tab-h) border-t px-4 py-2.5 min-[1100px]:hidden md:bottom-0 print:hidden"
      >
        <div className="mx-auto flex min-h-12 max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
            {priced ? (
              <>
                <p className="m-0 truncate text-lg leading-tight font-semibold tabular-nums">{headline}</p>
                <p className="text-muted m-0 truncate text-xs tabular-nums">{subline}</p>
              </>
            ) : (
              <div className="text-sm [&_p]:m-0 [&_p]:leading-snug [&_ul]:hidden">{status}</div>
            )}
          </div>
          <div className="shrink-0">{primary}</div>
        </div>
      </div>
    </>
  );
}

/**
 * Why the per-piece price just changed: the quantity, or the specification (anything else the
 * customer chose). `null` until the first change, so a page that opens with a price is calm.
 */
function usePriceChange(current: { unitPrice: string; quantity: number } | null): "quantity" | "spec" | null {
  const previous = useRef(current);
  const [reason, setReason] = useState<"quantity" | "spec" | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = current;
    if (!before || !current || before.unitPrice === current.unitPrice) return;
    // Derived from what the API sent, after it arrived.
    setReason(before.quantity !== current.quantity ? "quantity" : "spec");
  }, [current?.unitPrice, current?.quantity]); // eslint-disable-line react-hooks/exhaustive-deps
  return reason;
}
