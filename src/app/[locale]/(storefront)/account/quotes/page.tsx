import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSavedQuotes } from "@/features/customer/account/api.server";
import { PortalTable } from "@/features/customer/account/PortalTable";
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
      <h1 className="text-title leading-tight">{t("title")}</h1>
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
        <PortalTable
          className="mt-6"
          caption={t("table.caption")}
          columns={[
            { key: "product", label: t("table.product"), className: "md:min-w-[13rem]" },
            { key: "quantity", label: t("table.quantity"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "price", label: t("table.price"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "validUntil", label: t("table.validUntil") },
            { key: "status", label: t("table.status") },
            { key: "actions", label: t("table.actions"), srOnly: true, className: "text-end" },
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
                      <span className="text-muted mt-0.5 line-clamp-2 text-xs font-normal" title={specs}>
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
                  <span className="flex flex-wrap justify-end gap-2">
                    {quote.status === "saved" ? <RequestSample quoteId={quote.id} label={label} /> : null}
                    {quote.status === "saved" && option ? (
                      <RequestCallOff quoteId={quote.id} optionId={option.id} label={label} />
                    ) : null}
                    {quote.summary.product && quote.source === "instant" ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`${configureHref(quote.summary.product.slug)}?quote=${quote.id}`}>
                          {t("reopen")}
                          <span className="sr-only"> {label}</span>
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
    </div>
  );
}
