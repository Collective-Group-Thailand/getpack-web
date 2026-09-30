import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypes } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { listMyOrders, type OrderView } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ARTWORK_STATUS, ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const VIEWS: OrderView[] = ["active", "completed", "cancelled"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myOrders");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The customer's orders by where they stand (F3 3.4), group by group as the API lists them
 * (`store.orders.listGroups`), each with what the customer can do on it now.
 *
 * CONTRACT-GAP store.orders / entity.next-actions — a listed order names its product type only and
 * carries no actions: they come from `listMyOrders`, and paying (a group's instalment) is on the
 * order's page, linked from the row.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; placed?: string }> }) {
  await requireCustomer();
  const { view: raw, placed } = await searchParams;
  const view = VIEWS.includes(raw as OrderView) ? (raw as OrderView) : "active";
  const [t, format, locale, rows, types] = await Promise.all([
    getTranslations("myOrders"),
    getFormat(),
    getLocale(),
    listMyOrders(view),
    getProductTypes(),
  ]);
  const typeName = (code: string) => {
    const type = types.find((candidate) => candidate.code === code);
    return type ? pick(locale, type.nameTh, type.nameEn) : code;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {placed ? (
        <Callout tone="success" live className="mt-4">
          {t("placed", { code: placed })}
        </Callout>
      ) : null}
      <nav aria-label={t("viewsLabel")} className="mt-4">
        <ul className="border-border flex gap-1 border-b">
          {VIEWS.map((entry) => (
            <li key={entry}>
              <Link
                href={`/account/orders?view=${entry}`}
                aria-current={entry === view ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm",
                  entry === view ? "border-primary text-fg font-medium" : "text-muted hover:text-fg border-transparent",
                )}
              >
                {t(`views.${entry}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="package"
          title={t(`empty.${view}`)}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map(({ group, order, actions }) => (
            <li key={order.id} className="border-border rounded-2xl border p-4">
              <article aria-labelledby={`order-${order.id}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={`order-${order.id}`} className="font-semibold">
                      <Link href={`/account/orders/${order.id}`} className="underline-offset-4 hover:underline">
                        {typeName(order.productTypeCode)}
                      </Link>
                    </h2>
                    <p className="text-muted font-mono text-sm">{order.orderCode}</p>
                    <p className="text-muted mt-1 text-sm">
                      {t("rowNoUnit", {
                        quantity: format.number(order.quantityOrdered),
                        date: format.date(group.placedAt),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-semibold tabular-nums">{format.thb(order.totals.grossAmount)}</p>
                    <div className="flex flex-wrap justify-end gap-1">
                      <StatusChip map={ORDER_STATUS} value={order.status} />
                      <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} />
                    </div>
                  </div>
                </div>
                {order.promisedShipDate && order.status !== "completed" && order.status !== "cancelled" ? (
                  <p className="text-muted flex items-center gap-2 text-sm">
                    <Icon name="truck" size={16} aria-hidden="true" />
                    {t("shipBy", { date: format.date(order.promisedShipDate) })}
                  </p>
                ) : null}
                {actions.some((action) => action.key !== "order.pay_instalment") ? (
                  <OrderActions
                    orderId={order.id}
                    orderCode={order.orderCode}
                    size="sm"
                    actions={actions.filter((action) => action.key !== "order.pay_instalment")}
                  />
                ) : null}
                {group.status === "waiting_payment" ? (
                  <p className="text-sm">
                    <Link
                      href={`/account/orders/${order.id}#instalments`}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      {t("payDue")}
                    </Link>
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
