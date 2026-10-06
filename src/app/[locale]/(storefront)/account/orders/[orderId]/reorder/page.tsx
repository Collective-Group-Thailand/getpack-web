import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getReorder } from "@/features/customer/fulfilment/api.server";
import { ReorderView } from "@/features/customer/fulfilment/ReorderView";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { productNameOf, specLinesOf } from "@/features/customer/orders/summary";
import { Link } from "@/i18n/navigation";
import { rfqHref } from "@/features/customer/catalog/paths";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

type Params = { orderId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { orderId } = await params;
  const [t, detail] = await Promise.all([getTranslations("fulfilment.reorder"), getMyOrder(orderId).catch(() => null)]);
  return {
    title: detail ? t("titleFor", { code: detail.order.orderCode }) : t("title"),
    robots: { index: false, follow: false },
  };
}

/** Ordering the same again (F3 3.6, D-153). */
export default async function Page({ params }: { params: Promise<Params> }) {
  await requireCustomer();
  const { orderId } = await params;
  const [t, tCatalog, locale, detail, preview] = await Promise.all([
    getTranslations("fulfilment.reorder"),
    getTranslations("catalog"),
    getLocale(),
    getMyOrder(orderId),
    getReorder(orderId),
  ]);
  if (!detail) notFound();
  const { order } = detail;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline-offset-4 hover:underline">
          {t("back", { code: order.orderCode })}
        </Link>
        <h1 className="text-[2rem] leading-tight">{t("titleFor", { code: order.orderCode })}</h1>
        {preview ? (
          <p className="text-muted text-sm">{t("intro", { product: productNameOf(locale, order.summary) })}</p>
        ) : null}
      </header>
      {preview ? (
        <ReorderView
          initial={preview}
          specs={specLinesOf(locale, order.summary)}
          unit={tCatalog(`stock.units.${order.summary.unit}`)}
        />
      ) : (
        // Not priced instantly any more (D-043: the type or this configuration now needs a quote), or
        // not offered: never a dead end — the same product type as a quote request, pre-filled from
        // the product it was (U-F4).
        <Callout tone="info" title={t("notAllowed")}>
          <p className="text-sm">{t("notAllowedBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                href={`${rfqHref(order.summary.productTypeCode)}${order.summary.product ? `?from=${encodeURIComponent(order.summary.product.slug)}` : ""}`}
              >
                {t("requestQuote")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/account/messages">{t("askTeam")}</Link>
            </Button>
          </div>
        </Callout>
      )}
    </div>
  );
}
