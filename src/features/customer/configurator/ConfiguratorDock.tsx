"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { PriceBreakTable, PriceSummary, type PriceRow } from "@/ui/components/PriceSummary";
import { QuoteDock } from "@/ui/components/QuoteDock";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon } from "@/ui/icons";

import type { PriceStep } from "./pricing";
import type { Configurator, ConfiguratorState } from "./state";
import type { QuoteAction, SavedQuote } from "./useQuoteActions";

export interface ConfiguratorDockProps {
  configurator: Configurator;
  state: ConfiguratorState;
  onSelectQuantity: (quantity: number) => void;
  /** Why no price can be asked for yet ("เลือกวัสดุ"), in the order the stepper asks. */
  missing: string[];
  steps: PriceStep[] | undefined;
  loading: boolean;
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
  onAction: (action: QuoteAction) => void;
  busy: QuoteAction | null;
  lastQuote: SavedQuote | null;
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
 * are not part of that calculation; the dock says they are applied on the quotation rather than
 * leaving them out silently, and shows the quotation's own figures once one is saved.
 */
export function ConfiguratorDock({
  configurator,
  state,
  onSelectQuantity,
  missing,
  steps,
  loading,
  pending,
  failed,
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
  const format = useFormat();
  const unit = configurator.unit;
  const step = steps?.find((candidate) => candidate.quantity === state.quantity);
  const priced = step?.instant ? step : null;
  const noPrice = step && !step.instant ? step : null;
  const ready = missing.length === 0;

  const status = !ready ? (
    <div>
      <p className="font-semibold">{t("notReady")}</p>
      <p className="text-muted text-sm">{t("stillNeeded", { items: missing.join(", ") })}</p>
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
    <div>
      <p className="font-semibold">{t("noInstantPrice")}</p>
      <p className="text-muted text-sm">{t(`reasons.${noPrice.reason ?? "no_price_path"}`)}</p>
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
    <Button block loading={busy === "cart"} onClick={() => onAction("cart")} iconStart="cart">
      {tActions("addToCart")}
    </Button>
  ) : (
    <Button block asChild variant={noPrice ? "primary" : "secondary"}>
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
      headline={priced ? t("perPiece", { price: format.thb(priced.unitPrice), unit }) : ""}
      subline={
        priced
          ? t("total", { total: format.thb(priced.grossAmount), quantity: format.number(priced.quantity), unit })
          : undefined
      }
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
            {lastQuote?.estimatedDeliveryDate ? (
              <li className="flex items-center gap-2">
                <Icon name="package-check" size={16} aria-hidden="true" />
                {t("receiveBy", { date: format.date(lastQuote.estimatedDeliveryDate) })}
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
          {state.mockupOption !== "none" || state.promoCode.trim() ? (
            <p className="text-muted mt-1 text-xs">{t("appliedOnQuote")}</p>
          ) : null}
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
          rows={steps.map((entry) => ({
            key: String(entry.quantity),
            quantity: format.number(entry.quantity),
            perPiece: format.thb(entry.unitPrice),
            total: format.thb(entry.grossAmount),
            selected: entry.quantity === state.quantity,
            unavailable: entry.instant ? undefined : t(`reasons.${entry.reason ?? "no_price_path"}`),
          }))}
          onSelect={(key) => onSelectQuantity(Number(key))}
          selectLabel={(row) => t("breaksSelect", { quantity: String(row.quantity), unit })}
          selectText={t("breaksChoose")}
          selectedText={t("breaksChosen")}
        />
      ) : null}

      {lastQuote?.promotion ? (
        <Callout tone={lastQuote.promotion.applied ? "success" : "warning"}>
          {lastQuote.promotion.applied
            ? t("promoApplied", {
                code: lastQuote.promotion.code,
                amount: format.thb(lastQuote.promotion.discountAmount),
              })
            : t("promoNotApplied", { code: lastQuote.promotion.code })}
          {lastQuote.promotion.capped ? ` ${t("promoCapped")}` : null}
        </Callout>
      ) : null}
    </QuoteDock>
  );
}
