import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSavedQuotes } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { configureHref } from "@/features/customer/catalog/paths";
import { productNameOf, specLinesOf } from "@/features/customer/orders/summary";
import { RequestCallOff } from "@/features/customer/repeat/RequestCallOff";
import { RequestSample } from "@/features/customer/samples/RequestSample";
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
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [, { locale }] = await Promise.all([requireCustomer(), params]);
  const [t, format, quotes] = await Promise.all([getTranslations("account.quotes"), getFormat(), getSavedQuotes()]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
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
        <ul className="mt-6 flex flex-col gap-3">
          {quotes.map((quote) => {
            const option = quote.options[0];
            return (
              <li
                key={quote.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{productNameOf(locale, quote.summary)}</p>
                  {quote.summary.specs.length > 0 ? (
                    <p className="text-muted text-sm">
                      {specLinesOf(locale, quote.summary)
                        .map((line) => `${line.term} ${line.description}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {option ? (
                    <p className="text-muted text-sm">
                      {t(quote.quoteCode ? "row" : "rowNoCode", {
                        code: quote.quoteCode ?? "",
                        quantity: format.number(option.quantity),
                        amount: format.thb(option.grossAmount),
                      })}
                    </p>
                  ) : null}
                  <p className="text-muted text-xs">{t("validUntil", { date: format.date(quote.validUntil) })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip map={QUOTE_STATUS} value={quote.status} />
                  {quote.status === "saved" ? (
                    <RequestSample quoteId={quote.id} label={quote.quoteCode ?? productNameOf(locale, quote.summary)} />
                  ) : null}
                  {quote.status === "saved" && option ? (
                    <RequestCallOff
                      quoteId={quote.id}
                      optionId={option.id}
                      label={quote.quoteCode ?? productNameOf(locale, quote.summary)}
                    />
                  ) : null}
                  {quote.summary.product && quote.source === "instant" ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`${configureHref(quote.summary.product.slug)}?quote=${quote.id}`}>
                        {t("reopen")}
                        <span className="sr-only"> {quote.quoteCode ?? productNameOf(locale, quote.summary)}</span>
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
