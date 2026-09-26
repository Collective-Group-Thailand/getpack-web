import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { accountRequests } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { configureHref } from "@/features/customer/catalog/paths";
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
 * Saved quotations and configurations (F3 3.4): each holds its price until its validity ends
 * (D-051) and reopens in the configurator, where it is priced again at today's prices.
 */
export default async function Page() {
  await requireCustomer();
  const [t, format, quotes] = await Promise.all([
    getTranslations("account.quotes"),
    getFormat(),
    (await accountRequests()).call("GET /v1/store/quotes", { query: { perPage: 50 } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      {quotes.data.length === 0 ? (
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
        <ul className="mt-6 flex flex-col gap-3">
          {quotes.data.map((quote) => (
            <li
              key={quote.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{quote.product.name}</p>
                <p className="text-muted text-sm">
                  {t("row", {
                    code: quote.quoteCode,
                    quantity: format.number(quote.quantity),
                    unit: quote.unit,
                    amount: format.thb(quote.grossAmount),
                  })}
                </p>
                <p className="text-muted text-xs">{t("validUntil", { date: format.date(quote.validUntil) })}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip map={QUOTE_STATUS} value={quote.status} />
                {quote.source === "instant" && quote.product.slug ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`${configureHref(quote.product.slug)}?quote=${quote.id}`}>
                      {t("reopen")}
                      <span className="sr-only"> {quote.quoteCode}</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
