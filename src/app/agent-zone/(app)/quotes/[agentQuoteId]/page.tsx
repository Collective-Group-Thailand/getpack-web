import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AGENT_DISCOUNT_REQUEST_STATUS, AGENT_QUOTE_STATUS } from "@/domain/status";
import { AgentPage, Panel } from "@/features/agent/AgentPage";
import { getAgentQuote, getDiscountRequests, type DiscountRequest } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { DiscountOptions } from "@/features/agent/discount/DiscountOptions";
import { DealBadge } from "@/features/agent/quotes/DealBadge";
import { QuoteActions } from "@/features/agent/quotes/QuoteActions";
import { ShareLink } from "@/features/agent/share/ShareLink";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentSales.quote");
  return { title: t("title") };
}

/** What the customer gives back in a round, in words (D-468 §3 give-get). */
async function giveGetLines(round: DiscountRequest): Promise<string[]> {
  const [t, format] = await Promise.all([getTranslations("agentSales.discount.giveGet"), getFormat()]);
  return [
    round.quantityChange ? t("summary.quantity", { quantity: format.number(round.quantityChange) }) : null,
    round.commitment === "call_off" && round.commitmentMonths ? t("summary.callOff", { months: round.commitmentMonths }) : null,
    round.depositPct ? t("summary.deposit", { pct: format.percent(round.depositPct) }) : null,
    round.cashWithinDays !== null && round.cashWithinDays !== undefined ? t("summary.cash", { days: round.cashWithinDays }) : null,
    round.leadTimeFlexDays ? t("summary.leadTime", { days: round.leadTimeFlexDays }) : null,
    round.specChange ? t("summary.spec", { spec: round.specChange }) : null,
  ].filter((line): line is string => Boolean(line));
}

/**
 * One quote on behalf (D-468 §2–§4): where it stands, the prices per quantity (the customer's view), the share link,
 * resend / withdraw / จองดีล, the deal badge, and the discount rounds — waiting for getpack, the options offered, or the
 * one chosen. In Phase 3 getpack's desk that offers options is not live yet (Phase 4), so a new request honestly says
 * it is waiting.
 */
export default async function Page({ params }: { params: Promise<{ agentQuoteId: string }> }) {
  await requireActiveAgent();
  const { agentQuoteId } = await params;
  const quote = await getAgentQuote(agentQuoteId);
  if (!quote) notFound();
  const [t, tDiscount, format, rounds] = await Promise.all([
    getTranslations("agentSales.quote"),
    getTranslations("agentSales.discount"),
    getFormat(),
    getDiscountRequests(quote.id),
  ]);
  const live = quote.status === "sent" || quote.status === "opened";
  const latest = rounds.at(-1);
  const canAsk = live && !rounds.some((round) => round.status === "open" || round.status === "offered");
  const product = quote.quote.summary.product?.nameTh ?? quote.quote.summary.productTypeNameTh ?? t("title");
  const lines = latest ? await giveGetLines(latest) : [];

  return (
    <AgentPage
      title={product}
      status={<StatusChip map={AGENT_QUOTE_STATUS} value={quote.status} size="md" />}
      intro={
        <>
          {t("for")}{" "}
          <Link href={`/leads/${quote.lead.id}`} className="text-link font-medium underline-offset-2 hover:underline">
            {quote.lead.contactName}
          </Link>
          {quote.lead.organisationName ? ` · ${quote.lead.organisationName}` : ""}
        </>
      }
      back={{ href: "/quotes", label: t("back") }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="quote-facts" className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5">
            <h2 id="quote-facts" className="sr-only">
              {t("facts")}
            </h2>
            <DealBadge deal={quote.dealRegistration} className="self-start" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted text-xs">{t("code")}</dt>
                <dd className="font-medium tabular-nums">{quote.quote.quoteCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">{t("sentAt")}</dt>
                <dd>{format.dateTime(quote.sentAt, { style: "dayMonth" })}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">{t("openedAt")}</dt>
                <dd>{quote.openedAt ? format.dateTime(quote.openedAt, { style: "dayMonth" }) : t("notOpened")}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">{t("validUntil")}</dt>
                <dd>{format.date(quote.quote.validUntil)}</dd>
              </div>
            </dl>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("prices")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 text-start font-medium">{t("quantity")}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t("unitPrice")}</th>
                  <th scope="col" className="py-2 text-end font-medium">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote.options.map((option) => (
                  <tr key={option.id} className="border-border border-b tabular-nums last:border-b-0">
                    <td className="py-2.5">{format.number(option.quantity)}</td>
                    <td className="py-2.5 text-end">{format.thb(option.unitPrice)}</td>
                    <td className="py-2.5 text-end font-semibold">{format.thb(option.grossAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted text-xs">{t("vatNote")}</p>
          </section>

          <Panel
            title={tDiscount("title")}
            id="discount"
            action={
              canAsk ? (
                <Button asChild size="sm" variant="secondary" iconStart="percent" className="min-h-11 sm:min-h-8">
                  <Link href={`/quotes/${quote.id}/discount`}>{latest ? tDiscount("askAgain") : tDiscount("ask")}</Link>
                </Button>
              ) : null
            }
          >
            {!latest ? (
              <p className="text-muted text-sm">{live ? tDiscount("none") : tDiscount("noneClosed")}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip map={AGENT_DISCOUNT_REQUEST_STATUS} value={latest.status} />
                  <span className="text-muted text-sm">
                    {tDiscount("round", { round: latest.round, date: format.date(latest.createdAt, { style: "dayMonth" }) })}
                  </span>
                </div>
                <p className="text-sm">
                  {tDiscount("asked", { pct: format.percent(latest.requestedPct), reason: tDiscount(`reasons.${latest.reason}`) })}
                  {lines.length ? <span className="text-muted"> · {lines.join(" · ")}</span> : null}
                </p>
                {latest.status === "open" ? (
                  <Callout tone="info" icon="hourglass" title={tDiscount("waitingTitle")}>
                    {tDiscount("waitingBody")}
                  </Callout>
                ) : null}
                {latest.options.length > 0 ? (
                  <DiscountOptions agentQuoteId={quote.id} options={latest.options} locked={latest.status !== "offered"} />
                ) : null}
                {latest.decisionNote ? <p className="text-muted text-sm">{latest.decisionNote}</p> : null}
              </div>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-4" aria-label={t("shareTitle")}>
          {quote.shareUrl ? (
            <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
              <h2 className="font-semibold">{t("shareTitle")}</h2>
              <p className="text-muted text-sm">{t("shareBody", { count: quote.sendCount })}</p>
              <ShareLink
                link={quote.shareUrl}
                code={quote.quote.quoteCode ?? ""}
                message={t("shareMessage", { name: quote.lead.contactName })}
              />
            </section>
          ) : (
            <Callout tone="neutral" title={t(`closed.${quote.status}`)} />
          )}
          <QuoteActions quote={quote} />
        </aside>
      </div>
    </AgentPage>
  );
}
