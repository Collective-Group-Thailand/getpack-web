import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RFQ_BASKET_STATUS } from "@/domain/status";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getBasket } from "@/features/customer/rfq/basket/api.server";
import { BasketQuotes } from "@/features/customer/rfq/basket/BasketQuotes";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { redirect } from "@/i18n/navigation";
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
  const meta = [
    basket.submittedAt ? t("sentAt", { at: format.dateTime(basket.submittedAt) }) : null,
    basket.deliveryPostcode ? t("deliverTo", { postcode: basket.deliveryPostcode }) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader
        back={{ href: "/account/rfqs", label: t("back") }}
        title={t("sentTitle", { code: basket.basketCode ?? "" })}
        status={<StatusChip map={RFQ_BASKET_STATUS} value={basket.status} size="md" />}
        lede={meta.length > 0 ? meta.join(" · ") : undefined}
      />
      {submitted ? <Callout tone="success" title={t("submitted", { count: basket.items.length })} /> : null}
      <BasketQuotes basket={basket} />
    </div>
  );
}
