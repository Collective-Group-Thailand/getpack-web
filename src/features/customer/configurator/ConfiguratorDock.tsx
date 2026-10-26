"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useJustAdded } from "@/features/customer/cart/cart-events";
import { useFormat } from "@/features/shared/format/useFormat";
import { specLabelText } from "@/features/shared/spec-label";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { PriceBreakTable, PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { QuoteDock } from "@/ui/components/QuoteDock";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import type { Schemas } from "@/lib/api/types";

import type { PriceStep } from "./pricing";
import { mergeEqualTiers } from "./tiers";
import type { Configurator, ConfiguratorState } from "./state";
import type { KeptQuote, QuoteAction } from "./useQuoteActions";

export interface ConfiguratorDockProps {
  configurator: Configurator;
  state: ConfiguratorState;
  /** The sales unit in the reader's language. */
  unit: string;
  /** The API's gap to the target for the quantity on screen (D-247), when a target was given. */
  gap: Schemas["QuoteStepGapDto"] | null;
  onSelectQuantity: (quantity: number) => void;
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
  busy: QuoteAction | null;
  lastQuote: KeptQuote | null;
  /** Where to ask for a quote instead, with the configuration carried along. */
  rfqHref: string;
  /** The online designer, seeded with this box — `null` where it cannot draw the product. */
  designHref: string | null;
  /** "Ask CS" on LINE, with the configuration as the message — `null` without an account id. */
  lineHref: string | null;
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
  onSelectQuantity,
  missing,
  steps,
  specLabel,
  loading,
  pending,
  failed,
  refusal,
  onRetry,
  onAction,
  busy,
  lastQuote,
  rfqHref,
  designHref,
  lineHref,
}: ConfiguratorDockProps) {
  const t = useTranslations("configurator.dock");
  const tActions = useTranslations("configurator.actions");
  const justAdded = useJustAdded();
  const format = useFormat();
  const step = steps?.find((candidate) => candidate.quantity === state.quantity);
  const priced = step?.instant ? step : null;
  const noPrice = step && !step.instant ? step : null;
  const ready = missing.length === 0;
  const tierGroups = steps ? mergeEqualTiers(steps) : [];
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

  const rows: PriceRow[] = priced
    ? [
        {
          label: t("product", { quantity: format.number(priced.quantity), unit }),
          value: format.thb(priced.productAmount),
          hint: t("vatIncluded"),
        },
        ...(priced.designFeeAmount && priced.designFeeAmount !== "0.00"
          ? [{ label: t("designFee"), value: format.thb(priced.designFeeAmount), hint: t("oneOff") }]
          : []),
        ...(priced.structureDesignFeeAmount && priced.structureDesignFeeAmount !== "0.00"
          ? [{ label: t("structureFee"), value: format.thb(priced.structureDesignFeeAmount), hint: t("oneOff") }]
          : []),
        priced.shippingPending
          ? { label: t("shipping"), value: t("shippingPending"), tone: "muted" as const }
          : { label: t("shipping"), value: format.thb(priced.shippingAmount) },
        { label: t("vat"), value: format.thb(priced.vatAmount), tone: "muted" as const, hint: t("vatInTotal") },
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
      <Link href={rfqHref}>{tActions("requestQuote")}</Link>
    </Button>
  );

  const secondary = (
    <>
      {priced && designHref ? (
        <Button block variant="secondary" asChild iconStart="palette">
          <Link href={designHref}>{tActions("designNow")}</Link>
        </Button>
      ) : null}
      {priced ? (
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="ghost" iconStart="save" loading={busy === "save"} onClick={() => onAction("save")}>
            {tActions("save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconStart="link"
            loading={busy === "share"}
            onClick={() => onAction("share")}
          >
            {tActions("share")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconStart="download"
            loading={busy === "pdf"}
            onClick={() => onAction("pdf")}
          >
            {tActions("pdf")}
          </Button>
        </div>
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
          <a href={lineHref} target="_blank" rel="noopener noreferrer">
            {tActions("askCs")}
          </a>
        </Button>
      ) : null}
    </>
  );

  return (
    <QuoteDock
      title={t("title")}
      headline={
        priced ? (
          // A changed price is highlighted once, with why it changed (U5.7 §1): what the customer
          // changed, never a computed difference — the figures are the API's.
          <span className="flex flex-wrap items-center gap-2">
            <span key={priced.unitPrice ?? "none"} className={reason ? "pk-flash rounded-sm px-1" : undefined}>
              {t("perPiece", { price: format.thb(priced.unitPrice), unit })}
            </span>
            {reason ? (
              <Badge size="sm" tone="info" icon="info">
                {t(`changed.${reason}`)}
              </Badge>
            ) : null}
          </span>
        ) : (
          ""
        )
      }
      subline={
        priced
          ? t("total", { total: format.thb(priced.grossAmount), quantity: format.number(priced.quantity), unit })
          : undefined
      }
      basis={priced ? specLabelText(specLabel, format.locale) : null}
      status={status}
      primaryAction={primary}
      secondaryActions={secondary}
      detailsLabel={t("details")}
      closeLabel={t("close")}
    >
      {priced ? (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <PriceSummary
            aria-label={t("summary")}
            rows={rows}
            total={{ label: t("grandTotal"), value: format.thb(priced.grossAmount) }}
          />
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Icon name="clock" size={16} aria-hidden="true" />
              {t("leadTime", { days: priced.leadTimeDays ?? 0 })}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="truck" size={16} aria-hidden="true" />
              {t("shipBy", { date: format.date(priced.earliestShipDate) })}
            </li>
            {lastQuote?.option.earliestDeliveryDate ? (
              <li className="flex items-center gap-2">
                <Icon name="package-check" size={16} aria-hidden="true" />
                {t("receiveBy", { date: format.date(lastQuote.option.earliestDeliveryDate) })}
              </li>
            ) : null}
            {gap ? (
              <li className="flex items-start gap-2">
                <Icon name="flag" size={16} aria-hidden="true" className="mt-0.5" />
                {gap.meetsTarget ? t("targetMet") : t("targetAbove", { gap: format.thb(gap.gapPerUnit), unit })}
              </li>
            ) : null}
            {priced.toleranceShortagePct && priced.toleranceOveragePct ? (
              <li className="flex items-start gap-2">
                <Icon name="scale" size={16} aria-hidden="true" className="mt-0.5" />
                {t("tolerance", {
                  shortage: format.percent(priced.toleranceShortagePct, 1),
                  overage: format.percent(priced.toleranceOveragePct, 1),
                })}
              </li>
            ) : null}
          </ul>
          <p className="text-muted mt-3 text-xs">{t("validity", { days: configurator.quoteValidityDays })}</p>
          {state.promoCode.trim() ? <p className="text-muted mt-1 text-xs">{t("appliedOnQuote")}</p> : null}
        </div>
      ) : null}

      {steps && steps.length > 1 ? (
        <PriceBreakTable
          caption={t("breaksCaption")}
          headers={{
            quantity: t("breaksQuantity"),
            perPiece: t("breaksPerPiece"),
            total: t("breaksTotal"),
          }}
          rows={tierGroups.map((group) => {
            const { first, last } = group;
            const merged = group.steps.length > 1;
            const chosen = group.steps.find((entry) => entry.quantity === state.quantity);
            return {
              key: String(first.quantity),
              quantity: merged
                ? t("breaksRange", { from: format.number(first.quantity), to: format.number(last.quantity), unit })
                : format.number(first.quantity),
              perPiece: format.thb(first.unitPrice),
              // One row stands for several quantities, each with its own total: the chosen one's, else none.
              total: merged
                ? chosen
                  ? format.thb(chosen.grossAmount)
                  : t("breaksTotalVaries")
                : format.thb(first.grossAmount),
              selected: chosen !== undefined,
              unavailable: first.instant ? undefined : t(`reasons.${first.reason ?? "no_price_path"}`),
            };
          })}
          onSelect={(key) => {
            // A row of several quantities keeps the one already chosen inside it.
            const group = tierGroups.find((candidate) => String(candidate.first.quantity) === key);
            if (group && !group.steps.some((entry) => entry.quantity === state.quantity))
              onSelectQuantity(group.first.quantity);
          }}
          selectLabel={(row) => t("breaksSelect", { quantity: String(row.quantity), unit })}
          selectText={t("breaksChoose")}
          selectedText={t("breaksChosen")}
        />
      ) : null}
    </QuoteDock>
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
