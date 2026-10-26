import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { listMyOrders } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { visibleActions } from "@/features/customer/orders/order-state";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CUSTOMER_ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.home");
  return { title: t("title") };
}

/** LIFF home (D-151): what needs doing on the active orders, the points, and a way to talk to CS. */
export default async function Page() {
  const me = await liffCustomer();
  if (!me) return <LiffSignIn />;
  const locale = await getLocale();
  const [t, format, orders, points, names] = await Promise.all([
    getTranslations("liff.home"),
    getFormat(),
    listMyOrders("active"),
    getPoints(),
    getProductTypeNames(locale),
  ]);
  const todo = orders
    .map((row) => ({ ...row, actions: visibleActions(row.order, row.actions) }))
    .filter((row) => row.actions.length > 0)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{t("hello", { name: me.displayName ?? "" })}</h1>
      <Link
        href="/liff/points"
        className="bg-primary-subtle text-primary-subtle-fg flex items-center justify-between rounded-xl p-4"
      >
        <span>{t("points")}</span>
        <span className="text-xl font-bold tabular-nums">{format.number(points.availablePoints)}</span>
      </Link>
      <section aria-labelledby="liff-todo" className="flex flex-col gap-3">
        <h2 id="liff-todo" className="font-semibold">
          {t("todo")}
        </h2>
        {todo.length === 0 ? <p className="text-muted text-sm">{t("nothing")}</p> : null}
        <ul className="flex flex-col gap-3">
          {todo.map(({ order, actions }) => (
            <li key={order.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/liff/orders/${order.id}`} className="min-w-0">
                  <span className="block font-medium">{names[order.productTypeCode] ?? order.productTypeCode}</span>
                  <span className="text-muted block text-xs tabular-nums">{order.orderCode}</span>
                </Link>
                <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
              </div>
              <OrderActions
                orderId={order.id}
                orderCode={order.orderCode}
                actions={actions.slice(0, 2)}
                size="sm"
                surface="liff"
              />
            </li>
          ))}
        </ul>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="secondary" iconStart="package">
          <Link href="/liff/orders">{t("allOrders")}</Link>
        </Button>
        <Button asChild variant="secondary" iconStart="chat">
          <Link href="/liff/chat">{t("chat")}</Link>
        </Button>
      </div>
    </div>
  );
}
