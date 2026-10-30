import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getDefaults,
  getLaunchpad,
  getPoints,
  getSavedQuotes,
  getStoreCredit,
} from "@/features/customer/account/api.server";
import { LaunchpadPanel } from "@/features/customer/account/Launchpad";
import { TierProgress } from "@/features/customer/account/TierProgress";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getApprovals, getMyCompany } from "@/features/customer/business/api.server";
import { listOrderPage } from "@/features/customer/orders/api.server";
import { OrderCard } from "@/features/customer/orders/list/OrderCard";
import { TodoStrip } from "@/features/customer/orders/list/TodoStrip";
import { productNameOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.home");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** A section of the overview with its heading and a "see all" link. */
function Section({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {more ? (
          <Link href={more.href} className="text-primary text-sm font-medium underline-offset-4 hover:underline">
            {more.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The account's front page (account pack Phase 4): what needs doing now (the orders list's "ต้องทำตอนนี้" cards)
 * and the latest three orders as the list shows them; then the designs to continue and what to order again (the
 * launchpad, D-297), quotations whose price is still locked, points, store credit and the tier with the rule of what
 * counts (`spendBasisTh`); for a company member, what waits for their approval and the company's shortcuts.
 * Each read beyond the orders is a convenience: a failure hides its part, never the page.
 */
export default async function Page() {
  const me = await requireCustomer();
  const locale = await getLocale();
  const [t, format, latest, active, points, credit, launchpad, defaults, quotes, company] = await Promise.all([
    getTranslations("account.home"),
    getFormat(),
    listOrderPage("active", "", 1, 3).catch(() => null),
    listOrderPage("active", "", 1, 100).catch(() => null),
    getPoints().catch(() => null),
    getStoreCredit().catch(() => null),
    getLaunchpad().catch(() => null),
    getDefaults().catch(() => null),
    getSavedQuotes().catch(() => []),
    getMyCompany().catch(() => null),
  ]);
  // A company approver's queue leads (round 2, B2).
  const forMe = company?.can.approveOrders ? ((await getApprovals(company.id, "pending").catch(() => null)) ?? []) : [];
  const latestOrders = (latest?.groups ?? [])
    .flatMap((group) => group.orders.map((order) => ({ order, group })))
    .slice(0, 3);
  const activeOrders = (active?.groups ?? []).flatMap((group) => group.orders);
  // A quotation is open while its price is locked (D-051) — the API says which.
  const openQuotes = quotes.filter((quote) => quote.priceLocked).slice(0, 3);
  const companyCredit = company?.credit ?? company?.creditSummary ?? null;
  const availableCredit = companyCredit?.creditStatus === "credit" ? (companyCredit.availableAmount ?? null) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.02em]">
          {t("greeting", { name: me.displayName })}
        </h1>
        <p className="text-muted mt-1.5">{t("intro")}</p>
      </div>

      {forMe.length > 0 ? (
        <Link
          href="/business/approvals"
          className="border-warning/40 bg-warning-subtle hover:border-warning flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5"
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

      <TodoStrip orders={activeOrders} />

      <Section id="account-latest" title={t("latest")} more={{ href: "/account/orders", label: t("allOrders") }}>
        {latestOrders.length === 0 ? (
          <div className="border-border-strong text-muted rounded-panel border border-dashed p-8 text-center">
            <p>{t("noOrders")}</p>
            <Button asChild className="mt-4">
              <Link href="/products">{t("browse")}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {latestOrders.map(({ order, group }) => (
              <OrderCard key={order.id} order={order} placedAt={group.placedAt} />
            ))}
          </div>
        )}
      </Section>

      {launchpad ? (
        <LaunchpadPanel launchpad={launchpad} hasBrandKit={defaults?.companies.some((c) => c.hasBrandKit) ?? false} />
      ) : null}

      {openQuotes.length > 0 ? (
        <Section id="account-quotes" title={t("openQuotes")} more={{ href: "/account/quotes", label: t("allQuotes") }}>
          <ul className="border-border bg-surface divide-border divide-y rounded-2xl border">
            {openQuotes.map((quote) => (
              <li key={quote.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{productNameOf(locale, quote.summary)}</p>
                  <p className="text-muted text-[0.8125rem] tabular-nums">
                    {quote.quoteCode} · {t("lockedUntil", { date: format.dateTime(quote.validUntil) })}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/account/quotes">{t("openQuote")}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {points || credit ? (
        <Section id="account-rewards" title={t("rewards")} more={{ href: "/account/points", label: t("seePoints") }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {points ? (
              <div className="border-border bg-surface flex flex-col gap-1.5 rounded-2xl border p-5">
                <p className="text-muted text-sm">{t("pointsTitle")}</p>
                <p className="text-[1.625rem] font-bold tabular-nums">
                  {t("points", { points: format.number(points.availablePoints) })}
                </p>
                <p className="text-muted text-sm">{t("pointsValue", { amount: format.thb(points.availableValue) })}</p>
                <p className="mt-2 text-sm">
                  {t("tierNow", { tier: t(`tiers.${points.tier}`), spend: format.thb(points.spend12m) })}
                </p>
                {/* The rule of what counts (the API's words) is part of the tier progress. */}
                <TierProgress points={points} className="text-sm" />
              </div>
            ) : null}
            {credit ? (
              <div className="border-border bg-surface flex flex-col gap-1.5 rounded-2xl border p-5">
                <p className="text-muted text-sm">{t("creditTitle")}</p>
                <p className="text-[1.625rem] font-bold tabular-nums">{format.thb(credit.balance)}</p>
                <p className="text-muted text-sm">{t("creditBody")}</p>
                <Link
                  href="/account/wallet"
                  className="text-primary mt-auto pt-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  {t("seeCredit")}
                </Link>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {company ? (
        // A company member's shortcuts (business pack): the company's catalogue, approvals and credit.
        <Section id="account-company" title={t("company", { name: company.tradeName ?? company.legalName })}>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              ...(company.can.order
                ? [{ href: "/business/reorder", icon: "refresh" as const, label: t("companyCatalogue") }]
                : []),
              ...(company.can.approveOrders
                ? [
                    {
                      href: "/business/approvals",
                      icon: "check" as const,
                      label: t("companyApprovals", { count: forMe.length }),
                    },
                  ]
                : []),
              // D-462: whoever may order sees the available credit; finance roles see the full page.
              ...(company.can.viewFinance || company.can.order
                ? [
                    {
                      href: "/business/credit",
                      icon: "wallet" as const,
                      label: availableCredit
                        ? t("companyCreditAvailable", { amount: format.thb(availableCredit) })
                        : t("companyCredit"),
                    },
                  ]
                : []),
              { href: "/business", icon: "building" as const, label: t("companyOrders") },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="border-border bg-surface hover:border-primary flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium"
                >
                  <span className="bg-primary-subtle text-primary-subtle-fg grid size-10 place-items-center rounded-xl">
                    <Icon name={item.icon} size={20} aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        // D-462: without a company account a customer would never learn credit terms exist.
        <section
          aria-labelledby="account-business"
          className="border-border bg-surface grid gap-4 rounded-2xl border p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
        >
          <span className="bg-primary-subtle text-primary-subtle-fg grid size-11 place-items-center rounded-xl">
            <Icon name="building" size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="account-business" className="font-semibold">
              {t("businessTitle")}
            </h2>
            <p className="text-muted mt-0.5 text-sm">{t("businessBody")}</p>
          </div>
          <Button asChild variant="secondary" className="justify-self-start sm:justify-self-end">
            <Link href="/business">{t("businessAction")}</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
