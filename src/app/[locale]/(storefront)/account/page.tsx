import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { listMyOrders } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.home");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The account's front page (F3 3.4): what needs doing across orders, points, the latest orders. */
export default async function Page() {
  const me = await requireCustomer();
  const locale = await getLocale();
  const [t, tNav, format, active, points, names] = await Promise.all([
    getTranslations("account.home"),
    getTranslations("account.nav"),
    getFormat(),
    listMyOrders("active"),
    getPoints(),
    getProductTypeNames(locale),
  ]);
  const todo = active.filter((row) => row.actions.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("greeting", { name: me.displayName })}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>

      <section aria-labelledby="account-todo">
        <h2 id="account-todo" className="text-lg font-semibold">
          {t("todo")}
        </h2>
        {todo.length === 0 ? (
          <p className="text-muted mt-2 text-sm">{t("nothingToDo")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {todo.map(({ order, actions }) => (
              <li key={order.id} className="border-border flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <Link href={`/account/orders/${order.id}`} className="underline-offset-4 hover:underline">
                      {names[order.productTypeCode] ?? order.productTypeCode}
                    </Link>
                    <span className="text-muted ms-2 font-mono text-sm">{order.orderCode}</span>
                  </p>
                  <StatusChip map={ORDER_STATUS} value={order.status} />
                </div>
                <OrderActions
                  orderId={order.id}
                  orderCode={order.orderCode}
                  size="sm"
                  actions={actions.filter((action) => action.key !== "order.pay_instalment")}
                />
                {actions.some((action) => action.key === "order.pay_instalment") ? (
                  <Link
                    href={`/account/orders/${order.id}#instalments`}
                    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {t("payDue")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="account-points" className="border-border rounded-xl border p-4">
          <h2 id="account-points" className="font-semibold">
            {tNav("points")}
          </h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {t("points", { points: format.number(points.availablePoints) })}
          </p>
          <p className="text-muted text-sm">{t("pointsValue", { amount: format.thb(points.availableValue) })}</p>
          {/* CONTRACT-GAP store.loyalty — no next tier or threshold, so the tier stands without a progress bar. */}
          <p className="mt-3 text-sm">
            {t("tierNow", { tier: t(`tiers.${points.tier}`), spend: format.thb(points.spend12m) })}
          </p>
          <Button asChild variant="link" className="mt-2 px-0">
            <Link href="/account/points">{t("seePoints")}</Link>
          </Button>
        </section>
        <section aria-labelledby="account-links" className="border-border rounded-xl border p-4">
          <h2 id="account-links" className="font-semibold">
            {t("shortcuts")}
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {(["instalments", "quotes", "rfqs", "addresses"] as const).map((key) => (
              <li key={key}>
                <Link href={`/account/${key}`} className="text-primary underline-offset-4 hover:underline">
                  {tNav(key)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
