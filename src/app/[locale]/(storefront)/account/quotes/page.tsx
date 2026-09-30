import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSavedQuotes } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypes } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
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
 * Saved quotations (F3 3.4): each holds its price until its validity ends (D-051).
 *
 * CONTRACT-GAP store.catalog-product-ref — a published quotation names its catalogue product by id
 * only, and the store catalogue cannot be read by id, so a quotation can no longer be reopened in
 * the configurator from here, and is named by its product type.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const [, { locale }] = await Promise.all([requireCustomer(), params]);
  const [t, format, quotes, types] = await Promise.all([
    getTranslations("account.quotes"),
    getFormat(),
    getSavedQuotes(),
    getProductTypes(),
  ]);
  const typeName = (code: string) => {
    const type = types.find((candidate) => candidate.code === code);
    return type ? pick(locale, type.nameTh, type.nameEn) : code;
  };

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
                  <p className="font-semibold">{typeName(quote.productTypeCode)}</p>
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
                <StatusChip map={QUOTE_STATUS} value={quote.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
