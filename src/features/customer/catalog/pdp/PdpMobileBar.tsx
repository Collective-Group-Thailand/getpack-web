"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackPdp } from "@/lib/analytics/pdp";
import { Button } from "@/ui/components/Button";

import { usePdp } from "./PdpProvider";

/**
 * The phone's buy bar (pdp redesign item 1, prototype `.mbar`): the unit price, quantity · size · total
 * and "ปรับแต่งต่อ". It sits on the storefront's bottom nav (`--mobile-tab-h`), the LINE button lifts over
 * it (`LineFloat` reads `data-pdp-bar`), and the page leaves room for it, so it never covers either.
 */
export function PdpMobileBar() {
  const t = useTranslations("catalog.pdp");
  const tUnits = useTranslations("catalog.stock.units");
  const format = useFormat();
  const { configurator, selection, current, configureLink, price } = usePdp();
  const unit = tUnits(configurator.unit);
  return (
    <div
      data-pdp-bar
      className="border-border bg-surface z-sticky shadow-overlay fixed inset-x-0 bottom-(--mobile-tab-h) border-t px-4 py-2.5 md:hidden print:hidden"
    >
      <div className="flex min-h-11 items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight" aria-live="polite" aria-atomic="true">
          {current?.unitPrice ? (
            <>
              <p className={price.pending ? "m-0 opacity-60" : "m-0"}>
                <b className="text-xl font-semibold tabular-nums">{format.thb(current.unitPrice)}</b>
                <span className="text-sm">{t("price.perUnit", { unit })}</span>
              </p>
              <p className="text-muted m-0 truncate text-xs tabular-nums">
                {[
                  t("bar.quantity", { qty: format.number(selection.quantity), unit }),
                  selection.standardSizeCode ? t("bar.size", { size: selection.standardSizeCode }) : null,
                  current.grossAmount ? t("price.total", { total: format.thb(current.grossAmount) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </>
          ) : (
            <p className="text-muted m-0 text-sm">{t("bar.noPrice")}</p>
          )}
        </div>
        <Button asChild className="shrink-0">
          <Link
            href={configureLink}
            onClick={() => trackPdp("pdp_cta", { product: configurator.slug, cta: "configure_bar" })}
          >
            {t("cta.configureShort")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
