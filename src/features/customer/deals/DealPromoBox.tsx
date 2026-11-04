"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { queryKeys } from "@/lib/api/query-keys";
import { browserApi } from "@/lib/api/browser";
import { cn } from "@/ui/lib/cn";

import { dealHref } from "./paths";

/**
 * The deal for this product, inside the price field (loyalty P1.5, STITCH-NOTES §c; prototype
 * `p15-pdp-ladder.html`): under a perforation, "มีโปร" with the offer and "ดูดีล", how to use it ("ใช้โค้ด BOX10 ใน
 * ตะกร้า"), and "ราคาหลังโปรโดยประมาณ" — the API's `estimatedTotal`, never computed here.
 * Rendered only when a public deal names this product type (the API's `?productTypeCode=` filter).
 *
 * The hint comes from `store.quotes.ladder`, which reads a saved quotation (the API has no ladder for an unsaved
 * calculation: the quantity rows already come from `store.quotes.calculate`). So the configurator passes the
 * quotation it kept this visit, asked for at the quantity in view only when that quantity is one of its options;
 * the PDP and an unsaved configuration show the deal without the hint.
 */
export function DealPromoBox({
  productTypeCode,
  quote = null,
  quantity,
  className,
}: {
  productTypeCode: string;
  /** The quotation kept this visit, for the ladder's deal hint; `anonymousId` is the configurator session's. */
  quote?: { id: string; quantities: readonly number[]; anonymousId?: string } | null;
  quantity: number;
  className?: string;
}) {
  const t = useTranslations("deals.pdp");
  const format = useFormat();
  const deals = useQuery({
    queryKey: queryKeys.list("customer", "deal", { productTypeCode }),
    queryFn: async () =>
      (await browserApi().GET("/v1/store/promotions", { params: { query: { productTypeCode } } })).data!,
    staleTime: 60_000,
  });
  const ladder = useQuery({
    queryKey: queryKeys.list("customer", "deal-ladder", { quoteId: quote?.id ?? null, quantity }),
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/quotes/{quoteId}/ladder", {
          params: { path: { quoteId: quote!.id }, query: { quantity, anonymousId: quote!.anonymousId } },
        })
      ).data!,
    // `?quantity` must be one of the quotation's options (else 422); a lapsed quotation answers 409 and hides the hint.
    enabled: Boolean(quote?.quantities.includes(quantity)) && (deals.data?.items.length ?? 0) > 0,
    retry: false,
    staleTime: 60_000,
  });

  const items = deals.data?.items ?? [];
  const deal = items[0];
  if (!deal) return null;
  const hint = ladder.data?.promoHint?.promotionId === deal.id ? ladder.data.promoHint : null;
  const b = (chunks: React.ReactNode) => <b className="text-fg font-semibold tracking-[0.05em]">{chunks}</b>;

  return (
    <section
      aria-label={t("aria")}
      className={cn(
        "border-border-strong/55 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-dashed px-4 pt-3.5 pb-4 text-sm md:px-5",
        className,
      )}
    >
      <span className="bg-primary text-primary-fg row-span-3 inline-flex h-5.5 items-center self-start rounded-md px-2 text-xs font-semibold">
        {t("label")}
      </span>
      <p className="text-primary-subtle-fg m-0 font-semibold">
        {hint?.text ?? deal.headline}
        <Link
          href={dealHref(deal)}
          className="text-primary ms-2 text-[0.84375rem] font-medium underline underline-offset-4"
        >
          {t("view")}
        </Link>
        {items.length > 1 ? (
          <Link
            href={`/deals?type=${encodeURIComponent(productTypeCode)}`}
            className="text-muted ms-2 text-[0.8125rem] font-normal underline underline-offset-4"
          >
            {t("more", { count: items.length - 1 })}
          </Link>
        ) : null}
      </p>
      <p className="text-muted m-0 text-[0.84375rem]">
        {deal.code ? t.rich("useCode", { code: deal.code, b }) : t("noCode")}
      </p>
      {hint?.estimatedTotal ? (
        <p className="border-border-strong/20 text-muted m-0 mt-1.5 flex items-baseline justify-between gap-3 border-t pt-2 text-[0.84375rem]">
          <span>{t("estimate")}</span>
          <b className="text-fg text-base font-semibold tabular-nums">{format.thb(hint.estimatedTotal)}</b>
        </p>
      ) : null}
    </section>
  );
}
