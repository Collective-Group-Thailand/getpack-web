"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { cn } from "@/ui/lib/cn";

import { deltaView, optionPricesUnsupported, subscribeOptionPricesSupport, type OptionPrice } from "./option-prices";

/**
 * The price slot of an option card: its box is always there (a fixed minimum height), so a figure
 * arriving, changing or going away never moves the page. While the next answer is on its way the
 * last figure stays, dimmed.
 */
export function PriceSlot({
  children,
  pending = false,
  unitPrice,
  className,
}: {
  children?: React.ReactNode;
  pending?: boolean;
  /** The option's unit price as the API sent it (a data attribute: the card may show only the change). */
  unitPrice?: string | null;
  className?: string;
}) {
  // An API without the batch endpoint never fills the slot: collapse it instead of leaving a blank band on every card.
  const unsupported = useSyncExternalStore(subscribeOptionPricesSupport, optionPricesUnsupported, () => false);
  const collapsed = unsupported && !children && !unitPrice;
  return (
    <span
      data-price-slot=""
      data-option-price={unitPrice ?? undefined}
      className={cn("block leading-5", !collapsed && "min-h-5", pending && "opacity-60", className)}
      aria-busy={pending || undefined}
    >
      {children}
    </span>
  );
}

/**
 * The words on an option card for its API price. All of them come from the batch answer as strings:
 * the sign of a change is the sign of the string, an amount is formatted and never computed.
 */
export function useOptionFigures() {
  const t = useTranslations("configurator.options");
  const format = useFormat();
  return {
    /** "฿17.26/ชิ้น" — nothing when the API sent no price, "ขอใบเสนอราคา" for a spec it does not price instantly. */
    unitPrice(price: OptionPrice | null, unit: string): string {
      if (!price) return "";
      if (price.unitPrice) return t("perPiece", { price: format.thb(price.unitPrice), unit });
      return price.instant || price.problem ? "" : t("quoteOnly");
    },
    /** "เลือกอยู่" · "ราคาปัจจุบัน" · "+฿0.86" · "−฿0.86" — nothing when it cannot be compared. */
    delta(price: OptionPrice | null, selected: boolean): string {
      if (selected) return t("selected");
      if (!price) return "";
      if (!price.instant && !price.problem) return t("quoteOnly");
      const view = deltaView(price.delta);
      if (!view) return "";
      if (view.kind === "same") return t("same");
      return `${view.kind === "up" ? "+" : "−"}${format.thb(view.amount)}`;
    },
  };
}
