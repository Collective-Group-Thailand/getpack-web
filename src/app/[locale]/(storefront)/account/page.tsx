import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getDefaults, getLaunchpad, getPoints } from "@/features/customer/account/api.server";
import { LaunchpadPanel } from "@/features/customer/account/Launchpad";
import { getApprovals, getMyCompany } from "@/features/customer/business/api.server";
import { DocumentLink } from "@/features/customer/orders/DocumentLink";
import { latestDocuments } from "@/features/customer/repeat/api.server";
import { listMyRfqs } from "@/features/customer/rfq/api.server";
import { Stat } from "@/ui/components/Stat";
import { TierProgress } from "@/features/customer/account/TierProgress";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMyOrders } from "@/features/customer/orders/api.server";
import { OrderActions } from "@/features/customer/orders/OrderActions";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { ORDER_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.home");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The account's front page (F3 3.4), a personal launchpad since U5.1 (D-297): the recommended next
 * step, the designs to continue and what to order again lead; then where things stand, what needs
 * doing, documents and points.
 */
export default async function Page() {
  const me = await requireCustomer();
  const locale = await getLocale();
  const [t, tNav, tOrders, format, active, points, rfqs, launchpad, defaults, documents] = await Promise.all([
    getTranslations("account.home"),
    getTranslations("account.nav"),
    getTranslations("myOrders"),
    getFormat(),
    listMyOrders("active"),
    getPoints(),
    // The dashboard's other reads never take the page down with them.
    listMyRfqs().catch(() => []),
    getLaunchpad().catch(() => null),
    getDefaults().catch(() => null),
    latestDocuments(5).catch(() => []),
  ]);
  // A company approver's queue leads (round 2, B2): "nothing to do" was said over an order the
  // company was waiting on them for.
  const company = await getMyCompany().catch(() => null);
  const forMe = company?.can.approveOrders ? ((await getApprovals(company.id, "pending").catch(() => null)) ?? []) : [];
  // Where things stand, by the API's own statuses (U2.F5): nothing is computed from dates here.
  const openRfqs = rfqs.filter((rfq) => ["submitted", "in_review", "need_info", "quoted"].includes(rfq.status)).length;
  const making = active.filter(({ order }) =>
    ["paid_for_production", "artwork_approved", "in_production"].includes(order.status),
  ).length;
  const onTheWay = active.filter(({ order }) => order.status === "shipping").length;
  // What needs doing: the orders' own actions, and a group waiting for its payment.
  const todo = active.filter((row) => row.actions.length > 0 || row.group.status === "waiting_payment");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-title leading-tight">{t("greeting", { name: me.displayName })}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>

      {launchpad ? (
        <LaunchpadPanel launchpad={launchpad} hasBrandKit={defaults?.companies.some((c) => c.hasBrandKit) ?? false} />
      ) : null}

      <section aria-labelledby="account-where">
        <h2 id="account-where" className="text-lg font-semibold">
          {t("where")}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat as={Link} href="/account/rfqs" label={t("openRequests")} value={format.number(openRfqs)} icon="inbox" />
          <Stat
            as={Link}
            href="/account/orders"
            label={t("inProduction")}
            value={format.number(making)}
            icon="factory"
          />
          <Stat as={Link} href="/account/orders" label={t("onTheWay")} value={format.number(onTheWay)} icon="truck" />
        </div>
      </section>

      {forMe.length > 0 ? (
        <Link
          href="/business/approvals"
          className="border-warning/40 bg-warning-subtle hover:border-warning flex flex-wrap items-center justify-between gap-3 rounded-card border p-5"
        >
          <span>
            <span className="block text-lg font-semibold">{t("approvalsForYou", { count: forMe.length })}</span>
            <span className="text-muted text-sm">
              {t("approvalsForYouBody", { company: company?.tradeName ?? company?.legalName ?? "" })}
            </span>
          </span>
          <span className="text-primary text-sm font-semibold">{t("approvalsOpen")}</span>
        </Link>
      ) : null}

      <section aria-labelledby="account-todo">
        <h2 id="account-todo" className="text-lg font-semibold">
          {t("todo")}
        </h2>
        {todo.length === 0 && forMe.length === 0 ? (
          <p className="text-muted mt-2 text-sm">{t("nothingToDo")}</p>
        ) : (
          <ul className="border-border bg-surface divide-border mt-3 divide-y rounded-card border">
            {todo.map(({ order, group, actions }) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                <ProductThumb
                  family={productFamilyOf(order.summary.productTypeCode)}
                  className="hidden size-12 rounded-xl sm:flex"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    <Link href={`/account/orders/${order.id}`} className="underline-offset-4 hover:underline">
                      {productNameOf(locale, order.summary)}
                    </Link>
                  </p>
                  <p className="text-muted mt-0.5 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-mono">{order.orderCode}</span>
                    <StatusChip map={ORDER_STATUS} value={order.status} />
                  </p>
                </div>
                <div className="flex basis-full flex-wrap items-center gap-2 sm:basis-auto">
                  {group.status === "waiting_payment" ? (
                    <Button asChild size="sm" iconStart="credit-card">
                      <Link href={`/account/orders/${order.id}#instalments`}>{t("payDue")}</Link>
                    </Button>
                  ) : null}
                  {actions.length > 0 ? (
                    <OrderActions orderId={order.id} orderCode={order.orderCode} size="sm" actions={actions} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {documents.length > 0 ? (
        <section aria-labelledby="account-documents">
          <h2 id="account-documents" className="text-lg font-semibold">
            {t("documents")}
          </h2>
          <ul className="border-border bg-surface divide-border mt-3 divide-y rounded-card border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{tOrders(`documents.types.${doc.docType}`)}</p>
                  <p className="text-muted text-[13px]">
                    {t("documentRow", {
                      number: doc.docNumber,
                      date: format.date(doc.documentDate),
                      amount: format.thb(doc.grossAmount),
                    })}
                  </p>
                </div>
                <DocumentLink documentId={doc.id} number={doc.docNumber} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="account-points"
        className="border-border bg-surface rounded-card border p-5"
      >
        <h2 id="account-points" className="font-semibold">
          {tNav("points")}
        </h2>
        <p className="serif mt-2 text-3xl tabular-nums">
          {t("points", { points: format.number(points.availablePoints) })}
        </p>
        <p className="text-muted text-sm">{t("pointsValue", { amount: format.thb(points.availableValue) })}</p>
        <p className="mt-3 text-sm">
          {t("tierNow", { tier: t(`tiers.${points.tier}`), spend: format.thb(points.spend12m) })}
        </p>
        <TierProgress points={points} className="mt-2 text-sm" />
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/account/points">{t("seePoints")}</Link>
        </Button>
      </section>
    </div>
  );
}
