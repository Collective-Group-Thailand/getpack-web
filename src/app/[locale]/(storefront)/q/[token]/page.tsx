import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { QuoteAnswer } from "@/features/customer/quote-link/QuoteAnswer";
import { getQuoteLink } from "@/features/customer/quote-link/api.server";
import { getFormat } from "@/features/shared/format/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.quoteLink");
  // A quotation link is sent to one customer, never published.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * A factory's quotation as its customer opens it from the link the factory sent (D-360): the seller and buyer,
 * the lines and totals, the terms — and accepting or declining it without an account.
 */
export default async function QuoteLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const [t, tUnits, format, quote] = await Promise.all([
    getTranslations("storefront.quoteLink"),
    getTranslations("storefront.quoteLink.units"),
    getFormat(),
    getQuoteLink(token),
  ]);
  if (!quote) notFound();
  const party = (p: typeof quote.seller) =>
    [p.address, p.taxId ? t("taxId", { id: p.taxId }) : null, p.phone].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex items-center gap-3">
          {quote.sellerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL from the API
            <img src={quote.sellerLogoUrl} alt="" className="h-14 w-auto" />
          ) : null}
          <div>
            <p className="text-lg font-semibold">{quote.seller.name}</p>
            <p className="text-muted text-sm">{party(quote.seller)}</p>
          </div>
        </div>
        <div className="sm:text-end">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="font-mono">
            {quote.quoteNo}
            {quote.revision > 1 ? ` (${t("revision", { n: quote.revision })})` : ""}
          </p>
        </div>
      </header>

      <section className="bg-surface border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <div>
          <p className="text-muted text-sm">{t("to")}</p>
          <p className="font-medium">{quote.buyer.name}</p>
          <p className="text-muted text-sm">{party(quote.buyer)}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("date")}</dt>
          <dd>{format.date(quote.quoteDate)}</dd>
          <dt className="text-muted">{t("validUntil")}</dt>
          <dd>{format.date(quote.validUntil)}</dd>
          <dt className="text-muted">{t("terms")}</dt>
          <dd>{t("days", { n: quote.paymentTermDays })}</dd>
          {quote.leadTimeDays != null ? (
            <>
              <dt className="text-muted">{t("leadTime")}</dt>
              <dd>{t("days", { n: quote.leadTimeDays })}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("lines")}</caption>
          <thead>
            <tr className="border-border border-b text-start">
              <th className="py-2 text-start font-medium">{t("item")}</th>
              <th className="py-2 text-end font-medium">{t("quantity")}</th>
              <th className="py-2 text-end font-medium">{t("price")}</th>
              <th className="py-2 text-end font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-border border-b">
                <td className="py-2">{line.description || line.item?.name}</td>
                <td className="py-2 text-end whitespace-nowrap tabular-nums">
                  {Number(line.quantity).toLocaleString("th-TH")} {tUnits(line.unit as never)}
                </td>
                <td className="py-2 text-end tabular-nums">{format.thb(line.unitPrice)}</td>
                <td className="py-2 text-end tabular-nums">{format.thb(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
        <dt className="text-muted">{t("subtotal")}</dt>
        <dd className="text-end">{format.thb(quote.subtotal)}</dd>
        {quote.vatMode !== "none" ? (
          <>
            <dt className="text-muted">{t("vat", { rate: Number(quote.vatRatePct) })}</dt>
            <dd className="text-end">{format.thb(quote.vatAmount)}</dd>
          </>
        ) : null}
        <dt className="font-semibold">{t("total")}</dt>
        <dd className="text-end text-lg font-semibold">{format.thb(quote.total)}</dd>
        <dd className="text-muted col-span-2 text-end text-sm">{t("inWords", { words: quote.totalInWords })}</dd>
      </dl>
      {quote.terms ? (
        <section>
          <h2 className="font-semibold">{t("conditions")}</h2>
          <p className="text-muted text-sm whitespace-pre-line">{quote.terms}</p>
        </section>
      ) : null}

      {quote.status === "sent" ? (
        <QuoteAnswer token={token} quoteNo={quote.quoteNo} />
      ) : (
        <p className="bg-surface border-border rounded-xl border p-4 font-medium" role="status">
          {quote.status === "accepted"
            ? t("acceptedBy", {
                name: quote.acceptedName ?? "",
                at: quote.acceptedAt ? format.dateTime(quote.acceptedAt) : "",
              })
            : t(`closed.${quote.status}`)}
        </p>
      )}
      {quote.sellerContact ? (
        <p className="text-muted text-sm">{t("contact", { contact: quote.sellerContact })}</p>
      ) : null}
    </div>
  );
}
