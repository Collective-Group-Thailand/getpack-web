import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { TabBar } from "@/features/customer/account/AccountTabs";
import { getSavedQuotes } from "@/features/customer/account/api.server";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { QuoteRowActions } from "@/features/customer/account/QuoteRowActions";
import { customerStatusLabel } from "@/features/customer/account/status-label";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { configureHref } from "@/features/customer/catalog/paths";
import { productNameOf, specLinesOf } from "@/features/customer/orders/summary";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { QUOTE_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.quotes");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Saved quotations (F3 3.4): each holds its price until its validity ends (D-051), names its
 * product and spec lines (`summary`), and reopens in the configurator of its product, where it is
 * priced again at today's prices.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [, { locale }, search] = await Promise.all([requireCustomer(), params, searchParams]);
  const [t, tHome, tTabs, tStatus, format, all] = await Promise.all([
    getTranslations("account.quotes"),
    getTranslations("account.home"),
    getTranslations("account.tabs"),
    getTranslations("status"),
    getFormat(),
    getSavedQuotes(),
  ]);

  // Project B2: the figures on top (quotes whose price still holds, and the first of them to lapse; ordered;
  // expired), then the statuses present as tabs over the table.
  const open = all.filter((quote) => quote.status === "saved" || quote.status === "shared");
  const firstToLapse = open.map((quote) => quote.validUntil).sort()[0];
  const countOf = (status: string) => all.filter((quote) => quote.status === status).length;
  const statuses = (Object.keys(QUOTE_STATUS) as (keyof typeof QUOTE_STATUS)[]).filter((status) => countOf(status) > 0);
  const status = statuses.find((value) => value === search.status);
  const quotes = status ? all.filter((quote) => quote.status === status) : all;

  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro")}
        actions={
          <Button asChild iconStart="plus">
            <Link href="/products">{t("browse")}</Link>
          </Button>
        }
      />
      {all.length > 0 ? (
        <>
          <SummaryCards
            className="mt-6"
            columns={3}
            items={[
              {
                key: "open",
                label: tHome("openQuotes"),
                value: format.number(open.length),
                hint: firstToLapse ? tHome("lockedUntil", { date: format.date(firstToLapse) }) : undefined,
                icon: "receipt",
                highlight: true,
              },
              {
                key: "converted",
                label: customerStatusLabel(tStatus, QUOTE_STATUS, "converted"),
                value: format.number(countOf("converted")),
                icon: "check",
              },
              {
                key: "expired",
                label: customerStatusLabel(tStatus, QUOTE_STATUS, "expired"),
                value: format.number(countOf("expired")),
                icon: "clock",
              },
            ]}
          />
          {statuses.length > 1 ? (
            <TabBar
              className="mt-6"
              label={t("table.status")}
              items={[
                {
                  key: "all",
                  href: "/account/quotes",
                  label: tTabs("all"),
                  current: !status,
                  count: all.length,
                },
                ...statuses.map((value) => ({
                  key: value,
                  href: `/account/quotes?status=${value}`,
                  label: customerStatusLabel(tStatus, QUOTE_STATUS, value),
                  current: status === value,
                  count: countOf(value),
                })),
              ]}
            />
          ) : null}
        </>
      ) : null}
      {quotes.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="receipt"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          className="mt-4"
          caption={t("table.caption")}
          columns={[
            { key: "product", label: t("table.product"), className: "md:w-[40%] md:min-w-[13rem]" },
            { key: "quantity", label: t("table.quantity"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "price", label: t("table.price"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "validUntil", label: t("table.validUntil"), className: "md:min-w-[7.5rem] md:whitespace-nowrap" },
            { key: "status", label: t("table.status"), className: "md:whitespace-nowrap" },
            {
              key: "actions",
              label: t("table.actions"),
              srOnly: true,
              className: "text-end md:w-px md:whitespace-nowrap",
            },
          ]}
          rows={quotes.map((quote) => {
            const option = quote.options[0];
            const name = productNameOf(locale, quote.summary);
            const label = quote.quoteCode ?? name;
            const specs = specLinesOf(locale, quote.summary)
              .map((line) => `${line.term} ${line.description}`)
              .join(" · ");
            return {
              id: quote.id,
              phoneSubtitle: quote.quoteCode ? <span className="tabular-nums">{quote.quoteCode}</span> : null,
              cells: {
                product: (
                  <span className="block min-w-0">
                    <span className="block font-semibold">{name}</span>
                    {quote.quoteCode ? (
                      <span className="text-muted hidden text-xs font-normal tabular-nums md:block">
                        {quote.quoteCode}
                      </span>
                    ) : null}
                    {specs ? (
                      <span className="text-muted mt-0.5 line-clamp-1 text-xs font-normal" title={specs}>
                        {specs}
                      </span>
                    ) : null}
                  </span>
                ),
                quantity: option ? format.number(option.quantity) : <span className="text-muted">—</span>,
                price: option ? (
                  <span className="block">
                    <span className="font-semibold">{format.thb(option.grossAmount)}</span>
                    <span className="text-muted block text-xs">{t("inclVat")}</span>
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
                validUntil: format.date(quote.validUntil),
                status: <StatusChip map={QUOTE_STATUS} value={quote.status} />,
                actions: (
                  <QuoteRowActions
                    quoteId={quote.id}
                    optionId={quote.status === "saved" && option ? option.id : null}
                    label={label}
                    canSample={quote.status === "saved"}
                    reopenHref={
                      quote.summary.product && quote.source === "instant"
                        ? `${configureHref(quote.summary.product.slug)}?quote=${quote.id}`
                        : null
                    }
                  />
                ),
              },
            };
          })}
        />
      )}
    </div>
  );
}
