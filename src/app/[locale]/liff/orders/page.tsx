import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { listMyOrders } from "@/features/customer/orders/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.orders");
  return { title: t("title") };
}

/** Order status in LINE (D-151). */
export default async function Page() {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const [t, format, active, completed] = await Promise.all([
    getTranslations("liff.orders"),
    getFormat(),
    listMyOrders("active"),
    listMyOrders("completed"),
  ]);
  const rows = [...active.data, ...completed.data.slice(0, 10)];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {rows.length === 0 ? <p className="text-muted">{t("empty")}</p> : null}
      <ul className="flex flex-col gap-2">
        {rows.map((order) => (
          <li key={order.id}>
            <Link
              href={`/liff/orders/${order.id}`}
              className="border-border flex items-center justify-between gap-3 rounded-xl border p-4"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{order.product.name}</span>
                <span className="text-muted block text-xs">
                  {t("row", { code: order.orderCode, quantity: format.number(order.quantity), unit: order.unit })}
                </span>
              </span>
              <StatusChip map={ORDER_STATUS} value={order.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
