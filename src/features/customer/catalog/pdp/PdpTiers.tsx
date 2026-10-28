"use client";

import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { specLabelText } from "@/features/shared/spec-label";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { pickQuantity } from "./model";
import { usePdp } from "./PdpProvider";

/** The spec the tiers are for, in the API's one string (D-441) — the tiers section's lede. */
export function PdpTiersLede() {
  const t = useTranslations("catalog.pdp.tiers");
  const locale = useLocale();
  const { price } = usePdp();
  const label = specLabelText(price.data?.specLabel, locale);
  return label ? <>{t("lede", { spec: label })}</> : null;
}

/**
 * "ราคาตามจำนวน" (pdp redesign item 6): the selection's price at every tier the configurator offers —
 * unit price and total as the API sent them, the chosen quantity highlighted, a bar whose length is the
 * unit price against the smallest tier's (from the API's own `savingPercent`, no money arithmetic) — and
 * "อ่านราคาอย่างไร": VAT, the quote's price lock, the quantity tolerance and the guarantee.
 */
export function PdpTiers({ guaranteeHref }: { guaranteeHref: string }) {
  const t = useTranslations("catalog.pdp.tiers");
  const tUnits = useTranslations("catalog.stock.units");
  const format = useFormat();
  const { configurator, selection, steps, current, price, choose } = usePdp();
  const unit = tUnits(configurator.unit);
  const shortage = current?.toleranceShortagePct ?? null;
  const overage = current?.toleranceOveragePct ?? null;
  const b = (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>;
  const head = "text-muted px-3.5 pb-2.5 text-[0.78125rem] font-medium";
  const rows = selection.quantities;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="border-border bg-surface rounded-card border p-5">
        <table
          aria-busy={price.pending || undefined}
          className={cn("w-full border-collapse text-[0.9375rem] tabular-nums", price.pending && "opacity-70")}
        >
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(head, "text-start")}>
                {t("quantity")}
              </th>
              <th scope="col" className={cn(head, "text-end")}>
                {t("unit")}
              </th>
              <th scope="col" className={cn(head, "text-end")}>
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((quantity) => {
              const step = steps.find((entry) => entry.quantity === quantity) ?? null;
              const on = quantity === selection.quantity;
              return (
                <tr key={quantity} className={cn("border-border border-t", on && "bg-primary-subtle font-semibold")}>
                  <th scope="row" className="px-3.5 py-3 text-start font-[inherit]">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        choose(pickQuantity(selection, quantity), { option: "quantity", value: String(quantity) })
                      }
                      className="focus-visible:ring-focus-ring rounded-sm text-start outline-none focus-visible:ring-2"
                    >
                      {t("quantityCell", { qty: format.number(quantity), unit })}
                    </button>
                  </th>
                  <td className="px-3.5 py-3 text-end">
                    {step?.instant && step.unitPrice ? (
                      <span className="inline-flex items-center justify-end gap-2.5">
                        <span
                          aria-hidden="true"
                          className="bg-primary/70 hidden h-1.5 rounded-sm sm:inline-block"
                          style={{ width: `${Math.round((100 - (step.savingPercent ?? 0)) * 0.8)}px` }}
                        />
                        {format.thb(step.unitPrice)}
                      </span>
                    ) : step ? (
                      <span className="text-muted text-xs">{t("quote")}</span>
                    ) : (
                      <span className="bg-bg-subtle inline-block h-3.5 w-14 animate-pulse rounded-sm align-middle" />
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-end">
                    {step?.instant && step.grossAmount ? format.thb(step.grossAmount) : step ? "—" : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-border bg-surface rounded-card border p-5">
        <h3 className="m-0 mb-3 text-[1.0625rem] font-semibold">{t("howTitle")}</h3>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[0.84375rem]">
          <li className="flex items-start gap-2.5">
            <Icon name="check" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>{t.rich("how.vat", { b })}</span>
          </li>
          {configurator.quoteValidityDays ? (
            <li className="flex items-start gap-2.5">
              <Icon name="save" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
              <span>{t.rich("how.lock", { days: configurator.quoteValidityDays, b })}</span>
            </li>
          ) : null}
          {shortage ? (
            <li className="flex items-start gap-2.5">
              <Icon name="scale" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
              <span>
                {overage === shortage || !overage
                  ? t.rich("how.tolerance", { pct: format.percent(shortage), b })
                  : t.rich("how.toleranceSplit", { short: format.percent(shortage), over: format.percent(overage), b })}
              </span>
            </li>
          ) : null}
          <li className="flex items-start gap-2.5">
            <Icon name="shield" size={18} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
            <span>
              {t.rich("how.guarantee", {
                link: (chunks) => (
                  <Link href={guaranteeHref} className="text-primary underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
