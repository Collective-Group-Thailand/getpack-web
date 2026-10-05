import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMyOrders, type OrderView } from "@/features/customer/orders/api.server";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { latestDocuments } from "@/features/customer/repeat/api.server";
import { productNameOf } from "@/features/customer/orders/summary";
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
 * (`store.orders.listGroups`), each with its product, its estimated delivery and what the customer
 * can do on it now (`nextActions`). Paying a group's instalment is on the order's page, linked from
 * the row.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; placed?: string }> }) {
  await requireCustomer();
  const { view: raw, placed } = await searchParams;
  const view = VIEWS.includes(raw as OrderView) ? (raw as OrderView) : "active";
  const [t, tCatalog, tHome, format, locale, rows, documents] = await Promise.all([
    getTranslations("myOrders"),
    getTranslations("catalog"),
    getTranslations("account.home"),
    getFormat(),
    getLocale(),
    listMyOrders(view),
    // The documents, one step away from the list (U5.1, T10); a failed read never hides the orders.
    latestDocuments(5).catch(() => []),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {placed ? (
        <Callout tone="success" live className="mt-4">
          {t("placed", { code: placed })}
        </Callout>
      ) : null}
      {documents.length > 0 ? (
        <section aria-labelledby="orders-documents" className="border-border mt-4 rounded-xl border p-4">
          <h2 id="orders-documents" className="font-medium">
            {tHome("documents")}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {tHome("documentRow", {
                    number: doc.docNumber,
                    date: format.date(doc.documentDate),
                    amount: format.thb(doc.grossAmount),
                  })}
                </span>
                <DocumentLink documentId={doc.id} number={doc.docNumber} />
              </li>
            ))}
          </ul>
        </section>
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
                        {productNameOf(locale, order.summary)}
                      </Link>
                    </h2>
                    <p className="text-muted font-mono text-sm">{order.orderCode}</p>
                    <p className="text-muted mt-1 text-sm">
                      {t("row", {
                        quantity: format.number(order.quantityOrdered),
                        unit: tCatalog(`stock.units.${order.summary.unit}`),
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
                    {order.estimatedDeliveryDate
                      ? ` · ${t("arrivesBy", { date: format.date(order.estimatedDeliveryDate) })}`
                      : null}
                  </p>
                ) : null}
                {actions.length > 0 ? (
                  <OrderActions orderId={order.id} orderCode={order.orderCode} size="sm" actions={actions} />
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
