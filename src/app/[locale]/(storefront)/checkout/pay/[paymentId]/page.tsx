import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyPayment } from "@/features/customer/checkout/api.server";
import { PaymentPanel } from "@/features/customer/checkout/PaymentPanel";
import { listMyOrderGroups } from "@/features/customer/orders/api.server";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payment");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Paying one instalment (F3 3.3), laid out as the "Checkout" board's second half: the payment on
 * the left, and on the right what it pays for — the group's orders, by name and quantity, and what
 * happens once it is paid. The group is found among the customer's own (`store.orders.listGroups`);
 * when it is not (an older group, a page the list does not reach) the side card is left out.
 */
export default async function Page({ params }: { params: Promise<{ paymentId: string }> }) {
  await requireCustomer();
  const { paymentId } = await params;
  const [t, locale, format, payment] = await Promise.all([
    getTranslations("payment"),
    getLocale(),
    getFormat(),
    getMyPayment(paymentId),
  ]);
  if (!payment) notFound();
  const group = payment.groupId
    ? ((await listMyOrderGroups().catch(() => [])).find((candidate) => candidate.id === payment.groupId) ?? null)
    : null;

  return (
    <div className="max-w-content mx-auto px-5 py-8 md:px-8">
      <h1 className="text-title leading-tight">{t("title")}</h1>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <PaymentPanel initial={payment} />
        {group ? (
          <aside
            aria-labelledby="pay-for"
            className="border-border bg-surface rounded-card h-fit border px-6 py-5.5 lg:sticky lg:top-20"
          >
            <h2 id="pay-for" className="text-[15px] font-bold">
              {t("payingFor")}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2 text-sm leading-relaxed">
              {group.orders.map((order) => (
                <li key={order.id}>
                  <b className="block">{productNameOf(locale, order.summary)}</b>
                  <span className="text-muted">
                    {t("orderLine", { quantity: format.number(order.quantityOrdered), code: order.orderCode })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-border mt-3 flex justify-between border-t pt-3 text-[14.5px]">
              <span className="text-muted">{t("groupTotal")}</span>
              <b className="tabular-nums">{format.thb(group.totals.grossAmount)}</b>
            </p>
            <p className="bg-primary-subtle text-primary-subtle-fg mt-3 rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed">
              {t("afterPaying")}
            </p>
            {/* A customer who cannot pay now wants to know the order is kept and how to come back. */}
            <p className="text-muted mt-3 text-[13px] leading-relaxed">
              {t("payLater")}{" "}
              <Link href="/account/orders" className="text-primary underline-offset-4 hover:underline">
                {t("payLaterLink")}
              </Link>
              {group.expiresAt ? ` ${t("payLaterExpires", { date: format.dateTime(group.expiresAt) })}` : null}
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
