import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMyOrders, type OrderView } from "@/features/customer/orders/api.server";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import {
  artworkNoteTextOf,
  deliveryDatesOf,
  isPaymentOverdue,
  visibleActions,
} from "@/features/customer/orders/order-state";
import { RequoteButton } from "@/features/customer/orders/RequoteButton";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { latestDocuments } from "@/features/customer/repeat/api.server";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ARTWORK_STATUS, CUSTOMER_ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
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

  const documentsSection =
    documents.length > 0 ? (
      <section aria-labelledby="orders-documents" className="mt-10">
        <h2 id="orders-documents" className="text-lg font-semibold">
          {tHome("documents")}
        </h2>
        <ul className="border-border bg-surface divide-border rounded-card mt-3 divide-y border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-surface-subtle text-muted grid size-10 shrink-0 place-items-center rounded-xl">
                  <Icon name="receipt" size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t(`documents.types.${doc.docType}`)}</p>
                  <p className="text-muted text-[13px]">
                    <span className="tabular-nums">{doc.docNumber}</span> · {format.date(doc.documentDate)} ·{" "}
                    <span className="tabular-nums">{format.thb(doc.grossAmount)}</span>
                  </p>
                </div>
              </div>
              <DocumentLink documentId={doc.id} number={doc.docNumber} />
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div>
      <h1 className="text-title leading-tight">{t("title")}</h1>
      {placed ? (
        <Callout tone="success" live className="mt-4">
          {t("placed", { code: placed })}
        </Callout>
      ) : null}
      <nav aria-label={t("viewsLabel")} className="mt-5">
        <ul className="border-border flex gap-1 border-b">
          {VIEWS.map((entry) => (
            <li key={entry}>
              <Link
                href={`/account/orders?view=${entry}`}
                aria-current={entry === view ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm",
                  entry === view
                    ? "border-primary text-fg font-semibold"
                    : "text-muted hover:text-fg border-transparent",
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
        <PortalTable
          className="mt-6"
          caption={t("table.caption")}
          columns={[
            { key: "order", label: t("table.order"), className: "md:min-w-[12rem]" },
            { key: "placed", label: t("table.placed") },
            { key: "status", label: t("table.status") },
            { key: "delivery", label: t("table.delivery"), className: "md:min-w-[7.5rem]" },
            { key: "total", label: t("table.total"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "actions", label: t("table.actions"), srOnly: true, className: "text-end" },
          ]}
          rows={rows.map(({ group, order, actions }) => {
            const inTransit = order.status !== "completed" && order.status !== "cancelled";
            const overdue = isPaymentOverdue(order);
            const visible = visibleActions(order, actions);
            return {
              id: order.id,
              phoneSubtitle: (
                <>
                  <span className="tabular-nums">{order.orderCode}</span> ·{" "}
                  {t("table.qty", {
                    quantity: format.number(order.quantityOrdered),
                    unit: tCatalog(`stock.units.${order.summary.unit}`),
                  })}
                </>
              ),
              cells: {
                order: (
                  <span className="flex items-start gap-3">
                    <ProductThumb
                      family={productFamilyOf(order.summary.productTypeCode)}
                      className="hidden size-11 shrink-0 rounded-lg lg:flex"
                    />
                    <span className="min-w-0">
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="text-fg block font-semibold underline-offset-4 hover:underline"
                      >
                        {productNameOf(locale, order.summary)}
                      </Link>
                      <span className="text-muted hidden text-xs font-normal md:block">
                        <span className="tabular-nums">{order.orderCode}</span> ·{" "}
                        {t("table.qty", {
                          quantity: format.number(order.quantityOrdered),
                          unit: tCatalog(`stock.units.${order.summary.unit}`),
                        })}
                      </span>
                    </span>
                  </span>
                ),
                placed: format.date(group.placedAt),
                status: (
                  <span className="flex flex-wrap justify-end gap-1 md:flex-col md:items-start md:justify-start">
                    <StatusChip map={CUSTOMER_ORDER_STATUS} value={order.customerStatus} />
                    {overdue ? (
                      <Badge size="sm" tone="danger" icon="clock">
                        {t("overdue")}
                      </Badge>
                    ) : null}
                    {order.artworkOwner !== null ? (
                      <StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} />
                    ) : null}
                    {artworkNoteTextOf(locale, order) ? (
                      <span className="text-muted w-full text-xs">{artworkNoteTextOf(locale, order)}</span>
                    ) : null}
                  </span>
                ),
                delivery:
                  inTransit && deliveryDatesOf(order) === "after_payment" ? (
                    // D-439: the plan made at placement may be in the past; the date follows payment.
                    <span className="text-muted">{t("table.afterPayment")}</span>
                  ) : inTransit && order.promisedShipDate ? (
                    <span className="block">
                      {format.date(order.promisedShipDate)}
                      {order.estimatedDeliveryDate ? (
                        <span className="text-muted block text-xs">
                          {t("arrivesBy", { date: format.date(order.estimatedDeliveryDate) })}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted">{t("table.noDate")}</span>
                  ),
                total: <span className="font-semibold">{format.thb(order.totals.grossAmount)}</span>,
                actions: (
                  <span className="flex flex-wrap justify-end gap-2 md:justify-end">
                    {overdue ? (
                      <RequoteButton
                        size="sm"
                        groupId={order.payment.groupId}
                        payHref={`/account/orders/${order.id}#instalments`}
                      />
                    ) : group.status === "waiting_payment" ? (
                      <Button asChild size="sm" iconStart="credit-card">
                        <Link href={`/account/orders/${order.id}#instalments`}>{t("payDue")}</Link>
                      </Button>
                    ) : null}
                    {visible.length > 0 ? (
                      <OrderActions orderId={order.id} orderCode={order.orderCode} size="sm" actions={visible} />
                    ) : null}
                    {group.status !== "waiting_payment" && visible.length === 0 ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/account/orders/${order.id}`}>
                          {t("table.view")}
                          <span className="sr-only"> {order.orderCode}</span>
                        </Link>
                      </Button>
                    ) : null}
                  </span>
                ),
              },
            };
          })}
        />
      )}

      {documentsSection}
    </div>
  );
}
