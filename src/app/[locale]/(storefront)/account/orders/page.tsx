import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import {
  getOrderTabCounts,
  listOrderPage,
  type OrderTab,
  type OrderTabCounts,
} from "@/features/customer/orders/api.server";
import { ExportOrdersLink } from "@/features/customer/orders/list/ExportOrdersLink";
import { OrderCard } from "@/features/customer/orders/list/OrderCard";
import { OrdersToolbar } from "@/features/customer/orders/list/OrdersToolbar";
import { PayGroupFrame } from "@/features/customer/orders/list/PayGroupFrame";
import { TodoStrip } from "@/features/customer/orders/list/TodoStrip";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkPagination } from "@/ui/components/LinkPagination";

const TABS: OrderTab[] = ["active", "todo", "in_production", "shipping", "completed", "cancelled"];
const PER_PAGE = 20;
/** The search text the list sends (a code, a PO number or part of a product name; D-453). */
const Q_MAX = 100;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myOrders.list");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The customer's orders (account pack Phase 2): what needs doing now, then the orders by tab — with counts — and a
 * search, newest group first, each order a card with its status, its next action and the six-stage tracker; orders
 * paid together sit in one frame. Tabs, search and counts are the API's (`store.orders.listGroups?tab=&q=`,
 * `store.orders.tabCounts`, D-453); nothing here derives a status or computes money.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string; q?: string; page?: string; placed?: string }>;
}) {
  await requireCustomer();
  const search = await searchParams;
  // `view=` was the old list's filter (active / completed / cancelled): read as the tab of the same name.
  const tab = TABS.find((candidate) => candidate === (search.tab ?? search.view)) ?? "active";
  const q = (search.q ?? "").trim().slice(0, Q_MAX);
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const [t, counts, list, active] = await Promise.all([
    getTranslations("myOrders.list"),
    getOrderTabCounts().catch((): OrderTabCounts | null => null),
    listOrderPage(tab, q, page, PER_PAGE),
    // The "ต้องทำตอนนี้" strip reads every active order, whatever the tab shows.
    tab === "active" && !q && page === 1
      ? null
      : listOrderPage("active", "", 1, 100)
          .then(({ groups }) => groups)
          .catch(() => []),
  ]);
  const activeOrders = (active ?? list.groups).flatMap((group) => group.orders);
  const orderCount = list.groups.reduce((sum, group) => sum + group.orders.length, 0);
  const pages = Math.max(1, Math.ceil(list.total / PER_PAGE));
  const hrefFor = (next: number) => {
    const params = new URLSearchParams();
    if (tab !== "active") params.set("tab", tab);
    if (q) params.set("q", q);
    if (next > 1) params.set("page", String(next));
    const query = params.toString();
    return query ? `/account/orders?${query}` : "/account/orders";
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-muted mt-1.5">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportOrdersLink tab={tab} q={q} />
          <Button asChild iconStart="plus">
            <Link href="/products">{t("newOrder")}</Link>
          </Button>
        </div>
      </header>

      {search.placed ? (
        <Callout tone="success" live>
          {t("placed", { code: search.placed })}
        </Callout>
      ) : null}

      <TodoStrip orders={activeOrders} />

      <OrdersToolbar
        tab={tab}
        q={q}
        results={orderCount}
        tabs={TABS.map((key) => ({ key, label: t(`tabs.${key}`), count: counts ? counts[key] : null }))}
      />

      {list.groups.length === 0 ? (
        <EmptyState
          icon={q ? "search" : "package"}
          title={q ? t("emptySearch", { q }) : t(`empty.${tab}`)}
          description={q ? undefined : t("emptyBody")}
          action={
            q ? (
              <Button asChild variant="secondary">
                <Link href={tab === "active" ? "/account/orders" : `/account/orders?tab=${tab}`}>
                  {t("searchClear")}
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/products">{t("browse")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {list.groups.map((group) => {
            const first = group.orders[0]!;
            const framed = group.status === "waiting_payment" && first.payment.groupOrderCount > 1;
            const cards = group.orders.map((order) => (
              <OrderCard key={order.id} order={order} placedAt={group.placedAt} inPayFrame={framed} />
            ));
            return framed ? (
              <PayGroupFrame key={group.id} payment={first.payment} firstOrderId={first.id}>
                {cards}
              </PayGroupFrame>
            ) : (
              cards
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <LinkPagination
          page={Math.min(page, pages)}
          pages={pages}
          hrefFor={hrefFor}
          linkAs={Link}
          labels={{
            nav: t("pagination.nav"),
            previous: t("pagination.previous"),
            next: t("pagination.next"),
            page: (n) => t("pagination.page", { page: n }),
          }}
        />
      ) : null}
    </div>
  );
}
