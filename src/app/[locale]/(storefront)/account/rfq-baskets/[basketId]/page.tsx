import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RFQ_BASKET_STATUS } from "@/domain/status";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getBasket } from "@/features/customer/rfq/basket/api.server";
import { BasketQuotes } from "@/features/customer/rfq/basket/BasketQuotes";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quoteRequests.basket");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** A sent RFQ basket (U5.4, D-301): each item's RFQ and its quote, accepted into the cart together. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ basketId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  await requireCustomer();
  const [{ basketId }, { submitted }] = await Promise.all([params, searchParams]);
  const [t, basket, format, locale] = await Promise.all([
    getTranslations("quoteRequests.basket"),
    getBasket(basketId),
    getFormat(),
    getLocale(),
  ]);
  if (!basket) notFound();
  if (basket.status === "draft") return redirect({ href: "/rfq/basket", locale });
  return (
    <div className="flex flex-col gap-6">
      <Link href="/account/rfqs" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{t("sentTitle", { code: basket.basketCode ?? "" })}</h1>
          <StatusChip map={RFQ_BASKET_STATUS} value={basket.status} size="md" />
        </div>
        <p className="text-muted text-sm">
          {basket.submittedAt ? t("sentAt", { at: format.dateTime(basket.submittedAt) }) : null}
          {basket.deliveryPostcode ? ` · ${t("deliverTo", { postcode: basket.deliveryPostcode })}` : ""}
        </p>
      </header>
      {submitted ? <Callout tone="success" title={t("submitted", { count: basket.items.length })} /> : null}
      <BasketQuotes basket={basket} />
    </div>
  );
}
