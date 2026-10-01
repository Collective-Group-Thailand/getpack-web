import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OrderStages } from "@/features/customer/fulfilment/OrderStages";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { pick } from "@/features/customer/catalog/localize";
import { getMyOrder } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.order");
  return { title: t("title") };
}

/** One order in LINE (D-151): its stages, what to do next, and the site for everything else. */
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const { orderId } = await params;
  const locale = await getLocale();
  const [t, tCatalog, format, detail] = await Promise.all([
    getTranslations("liff.order"),
    getTranslations("catalog"),
    getFormat(),
    getMyOrder(orderId),
  ]);
  if (!detail) notFound();
  const { order } = detail;
  const next = detail.instalments.find((instalment) => instalment.payable);
  const due = next
    ? {
        id: next.id,
        groupId: next.groupId,
        label: pick(locale, next.labelTh, next.labelEn),
        grossAmount: next.openAmount,
        activePaymentId: next.activePaymentId,
      }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/liff/orders" className="text-primary text-sm">
        {t("back")}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{productNameOf(locale, order.summary)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted font-mono text-sm">{order.orderCode}</span>
          <StatusChip map={ORDER_STATUS} value={order.status} />
        </div>
      </header>
      {detail.actions.length > 0 || due ? (
        <OrderActions
          orderId={order.id}
          orderCode={order.orderCode}
          actions={detail.actions}
          payable={due}
          surface="liff"
        />
      ) : null}
      <section aria-labelledby="liff-stages">
        <h2 id="liff-stages" className="sr-only">
          {t("stages")}
        </h2>
        {detail.progress ? <OrderStages steps={detail.progress.steps} /> : null}
      </section>
      <DescriptionList
        items={[
          {
            term: t("quantity"),
            description: `${format.number(order.quantityOrdered)} ${tCatalog(`stock.units.${order.summary.unit}`)}`,
          },
          { term: t("total"), description: format.thb(order.totals.grossAmount) },
          ...(order.promisedShipDate ? [{ term: t("shipBy"), description: format.date(order.promisedShipDate) }] : []),
          ...(order.estimatedDeliveryDate
            ? [{ term: t("eta"), description: format.date(order.estimatedDeliveryDate) }]
            : []),
        ]}
      />
      <Link href={`/account/orders/${order.id}`} className="text-primary text-sm underline underline-offset-4">
        {t("full")}
      </Link>
    </div>
  );
}
