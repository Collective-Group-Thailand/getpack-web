import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
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
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";

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

  // Project D: the greeting, the points as a tinted card that opens their page, what to do now as cards whose
  // top opens the order and whose buttons fill the width, and the two other places as big tiles.
  return (
    <div className="flex flex-col gap-5">
      <LiffHeader title={t("hello", { name: me.displayName ?? "" })} />
      <Link
        href="/liff/points"
        className="bg-primary-subtle text-primary-subtle-fg rounded-card focus-visible:ring-focus-ring flex min-h-16 items-center gap-3 p-4 outline-none focus-visible:ring-2"
      >
        <span
          aria-hidden="true"
          className="bg-surface text-primary grid size-10 shrink-0 place-items-center rounded-lg"
        >
          <Icon name="star" size={20} />
        </span>
        <span className="min-w-0 flex-1 font-medium">{t("points")}</span>
        <span className="text-2xl font-semibold tabular-nums">{format.number(points.availablePoints)}</span>
        <Icon name="chevron-right" size={18} aria-hidden="true" />
      </Link>
      <section aria-labelledby="liff-todo" className="flex flex-col gap-3">
        <h2 id="liff-todo" className="flex items-center gap-2 text-lg font-semibold">
          {t("todo")}
          {todo.length > 0 ? (
            <span className="bg-primary text-primary-fg grid size-6 place-items-center rounded-full text-xs tabular-nums">
              {todo.length}
            </span>
          ) : null}
        </h2>
        {todo.length === 0 ? (
          <p className="border-border bg-surface rounded-card text-muted flex items-center gap-3 border p-4 text-sm">
            <Icon name="check" size={18} aria-hidden="true" className="text-primary shrink-0" />
            {t("nothing")}
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {todo.map(({ order, actions }) => (
            <li key={order.id} className="border-border bg-surface rounded-card overflow-hidden border">
              <Link
                href={`/liff/orders/${order.id}`}
                className="focus-visible:ring-focus-ring flex min-h-16 items-center gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <ProductThumb family={productFamilyOf(order.productTypeCode)} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold [overflow-wrap:break-word] break-keep">
                    {names[order.productTypeCode] ?? order.productTypeCode}
                  </span>
                  <span className="text-muted block text-xs tabular-nums">{order.orderCode}</span>
                  <span className="mt-1 block">
                    <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
                  </span>
                </span>
                <Icon name="chevron-right" size={18} aria-hidden="true" className="text-muted shrink-0" />
              </Link>
              <div className="border-border border-t p-3 [&_a]:min-h-12 [&_a]:w-full [&_button]:min-h-12 [&_button]:w-full [&>div]:flex-col [&>div]:items-stretch">
                <OrderActions
                  orderId={order.id}
                  orderCode={order.orderCode}
                  actions={actions.slice(0, 2)}
                  size="md"
                  surface="liff"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <nav className="grid grid-cols-2 gap-3" aria-label={t("title")}>
        {(
          [
            { href: "/liff/orders", icon: "package", label: t("allOrders") },
            { href: "/liff/chat", icon: "chat", label: t("chat") },
          ] as const
        ).map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="border-border bg-surface rounded-card focus-visible:ring-focus-ring flex min-h-20 flex-col items-start justify-between gap-2 border p-4 text-sm font-semibold outline-none focus-visible:ring-2"
          >
            <span aria-hidden="true" className="bg-surface-subtle text-muted grid size-9 place-items-center rounded-lg">
              <Icon name={tile.icon} size={18} />
            </span>
            {tile.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
