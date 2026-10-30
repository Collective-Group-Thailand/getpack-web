import { getLocale, getTranslations } from "next-intl/server";

import { formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import type { SampleOrder } from "./samples.server";

const STEPS = ["buyer", "approver", "accountant"] as const;
const SKELETON = "bg-border-strong rounded-thumb block h-2";

/**
 * The hero's picture of a company order (hero redesign 2026-10-30): one purchase order with its lines priced by the
 * store pricing path — real catalogue products at real quantities and amounts (`pricedSamples`, GLOBAL-RULES §5),
 * the CSV import and PO chips, and the approval path below it. No company, branch, PO number or total is shown
 * (GLOBAL-RULES §3: no sample data; a total would be arithmetic on money, which the storefront never does). Without
 * priced products the lines are neutral placeholder bars.
 */
export async function OrderIllustration({ orders, creditTerms }: { orders: SampleOrder[]; creditTerms: string }) {
  const [t, locale] = await Promise.all([getTranslations("business.landing.order"), getLocale() as Promise<Locale>]);
  const rows = orders.slice(0, 3);

  return (
    <figure
      role="img"
      aria-label={t("label")}
      className="bg-bg-subtle rounded-panel relative px-4 pt-5 pb-4 sm:px-8 sm:pt-9 sm:pb-8 xl:pr-12 xl:pb-28 xl:pl-14"
    >
      {/* Before → now */}
      <p className="border-border bg-surface text-muted inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border px-3.5 py-1.5 text-[13px]">
        <s className="decoration-instant">{t("before")}</s>
        <Icon name="arrow-right" size={14} aria-hidden="true" className="text-fg shrink-0" />
        <b className="text-primary font-semibold">{t("now")}</b>
      </p>

      {/* The purchase order */}
      <div className="border-border bg-surface rounded-panel shadow-panel mt-4 max-w-[30rem] overflow-hidden text-[13.5px]">
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5">
          <div>
            <span className="text-muted block text-xs">{t("title")}</span>
            <b className="mt-0.5 block text-[15px] font-semibold">{t("po")}</b>
          </div>
          <span className="bg-bg-subtle text-muted rounded-control inline-flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <Icon name="spreadsheet" size={13} aria-hidden="true" />
            {rows.length > 0 ? t("csv", { count: formatNumber(rows.length, locale) }) : t("csvNoCount")}
          </span>
        </div>

        <ul className="px-4 sm:px-5">
          {rows.length > 0
            ? rows.map((order) => (
                <li
                  key={order.key}
                  className="border-border grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b py-3 last:border-b-0"
                >
                  <span className="truncate">{order.name}</span>
                  <span className="text-muted tabular-nums">×{formatNumber(order.quantity, locale)}</span>
                  <span className="font-semibold tabular-nums">{formatTHB(order.amount, locale, { decimals: 0 })}</span>
                </li>
              ))
            : [0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="border-border flex items-center gap-3 border-b py-3.5 last:border-b-0"
                  aria-hidden="true"
                >
                  <span className={`${SKELETON} w-1/2`} />
                  <span className={`${SKELETON} ml-auto w-10 opacity-60`} />
                  <span className={`${SKELETON} w-14`} />
                </li>
              ))}
        </ul>
        <p className="text-muted border-border border-t border-dashed px-4 py-2.5 text-xs sm:px-5">{t("priced")}</p>

        {/* The approval path */}
        <div className="bg-bg-subtle/60 border-border border-t px-4 pt-4 pb-4 sm:px-5">
          <ol className="relative grid grid-cols-3">
            <span
              aria-hidden="true"
              className="bg-border-strong absolute top-[13px] right-[16.67%] left-[16.67%] h-0.5"
            />
            <span aria-hidden="true" className="bg-primary absolute top-[13px] left-[16.67%] h-0.5 w-1/3" />
            {STEPS.map((step, index) => (
              <li key={step} className="relative flex flex-col items-center gap-2 text-center">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full",
                    index === 0 && "bg-primary text-primary-fg",
                    index === 1 && "border-primary bg-surface border-2",
                    index === 2 && "border-border-strong bg-surface border-2",
                  )}
                >
                  {index === 0 ? <Icon name="check" size={14} aria-hidden="true" /> : null}
                  {index === 1 ? <span className="bg-primary size-2 rounded-full" /> : null}
                </span>
                <span
                  className={cn("text-xs font-semibold", index === 1 && "text-primary", index === 2 && "text-muted")}
                >
                  {t(`steps.${step}`)}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted mt-3 text-center text-xs">{t("path")}</p>
        </div>
      </div>

      {/* Floating notes — only where there is room beside the card */}
      <div className="bg-surface border-border rounded-card shadow-panel absolute right-8 bottom-4 hidden max-w-[16rem] border p-3.5 text-[12.5px] xl:block">
        <span className="flex items-center gap-2 font-semibold">
          <span className="bg-primary-subtle text-primary rounded-control grid size-7 place-items-center">
            <Icon name="receipt" size={15} aria-hidden="true" />
          </span>
          {t("invoice.title")}
        </span>
        <p className="text-muted mt-1.5">{t("invoice.body")}</p>
      </div>
      <div className="bg-fg text-fg-inverse rounded-card absolute top-7 right-6 hidden items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] xl:flex">
        <Icon name="calendar" size={15} aria-hidden="true" className="opacity-80" />
        <span>
          <span className="block text-[11px] opacity-70">{t("pay")}</span>
          <b className="font-semibold">{t("credit", { terms: creditTerms })}</b>
        </span>
      </div>

      <figcaption className="text-muted mt-3 text-[11.5px] sm:absolute sm:bottom-3 sm:left-8 sm:mt-0 xl:left-14">
        {t("caption")}
      </figcaption>
    </figure>
  );
}
