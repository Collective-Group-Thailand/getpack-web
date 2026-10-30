import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { listMyOrders } from "@/features/customer/orders/api.server";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { CUSTOMER_ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.orders");
  return { title: t("title") };
}

/** Order status in LINE (D-151). */
export default async function Page() {
  if (!(await liffCustomer())) return <LiffSignIn />;
  const locale = await getLocale();
  const [t, tCatalog, format, active, completed] = await Promise.all([
    getTranslations("liff.orders"),
    getTranslations("catalog"),
    getFormat(),
    listMyOrders("active"),
    listMyOrders("completed"),
  ]);
  const rows = [...active, ...completed.slice(0, 10)].map((row) => row.order);
  // Project D: every order as a card with its picture, name, code and quantity, its status under them, and the
  // whole card the touch target.
  return (
    <div className="flex flex-col gap-4">
      <LiffHeader title={t("title")} />
      {rows.length === 0 ? (
        <p className="border-border bg-surface rounded-card text-muted flex items-center gap-3 border p-4">
          <Icon name="package" size={18} aria-hidden="true" className="shrink-0" />
          {t("empty")}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {rows.map((order) => (
          <li key={order.id}>
            <Link
              href={`/liff/orders/${order.id}`}
              className="border-border bg-surface rounded-card focus-visible:ring-focus-ring flex min-h-20 items-center gap-3 border p-3.5 outline-none focus-visible:ring-2"
            >
              <ProductThumb family={productFamilyOf(order.productTypeCode)} className="size-14" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block font-semibold [overflow-wrap:break-word] break-keep">
                  {productNameOf(locale, order.summary)}
                </span>
                <span className="text-muted block text-xs tabular-nums">
                  {t("row", {
                    code: order.orderCode,
                    quantity: format.number(order.quantityOrdered),
                    unit: tCatalog(`stock.units.${order.summary.unit}`),
                  })}
                </span>
                <span className="mt-1.5 block">
                  <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
                </span>
              </span>
              <Icon name="chevron-right" size={18} aria-hidden="true" className="text-muted shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
