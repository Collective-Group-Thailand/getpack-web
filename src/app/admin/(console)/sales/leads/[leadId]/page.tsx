import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  AGENT_DISCOUNT_REQUEST_STATUS,
  AGENT_LEAD_STAGE,
  AGENT_QUOTE_STATUS,
  SALES_DISCOUNT_APPROVAL_STATUS,
} from "@/domain/status";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { adminServerApis } from "@/features/admin/console/api.server";
import { LogActivity, NewSalesQuote, RequestDiscount } from "@/features/admin/sales/LeadActions";
import { SalesNav } from "@/features/admin/sales/SalesNav";
import { getFormat } from "@/features/shared/format/server";
import { ProtectionText } from "@/features/shared/sales/LeadCard";
import { LeadTimeline } from "@/features/shared/sales/LeadTimeline";
import { displayPhone } from "@/features/shared/sales/phone";
import { StageMenu } from "@/features/shared/sales/StageMenu";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";
import { Icon } from "@/ui/icons";

type Props = { params: Promise<{ leadId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leadId } = await params;
  const { contract } = await adminServerApis();
  const found = await contract
    .GET("/v1/admin/sales/leads/{leadId}", { params: { path: { leadId } } })
    .catch(() => null);
  return { title: found?.data?.contactName ?? (await getTranslations("sales.lead"))("pageTitle") };
}

/**
 * One lead on the sales desk (D-469): the same header, stage menu, protection and timeline as the agent zone (shared
 * components), with the desk's own actions — log a contact, quote from a spec the desk already priced, ask for a
 * discount on a quote (the approval opens on the desk) — and, for a manager, the customer's negotiation history.
 * A freelance agent's lead is read-only here.
 */
export default async function Page({ params }: Props) {
  const { leadId } = await params;
  const { contract } = await adminServerApis();
  const found = await contract
    .GET("/v1/admin/sales/leads/{leadId}", { params: { path: { leadId } } })
    .catch(() => null);
  const lead = found?.data;
  if (!lead) notFound();
  const [t, tAgent, format, me, activities, quotes] = await Promise.all([
    getTranslations("sales.lead"),
    getTranslations("agentSales.lead"),
    getFormat(),
    contract.GET("/v1/admin/me").then((response) => response.data!),
    contract
      .GET("/v1/admin/sales/leads/{leadId}/activities", { params: { path: { leadId }, query: { limit: 50 } } })
      .then((response) => response.data?.data ?? []),
    contract
      .GET("/v1/admin/sales/quotes", { params: { query: { leadId, perPage: 50 } } })
      .then((response) => response.data?.data ?? []),
  ]);
  const can = (permission: string) => me.permissions.includes(permission);
  const readOnly = lead.agent.kind === "freelance";
  const closed =
    readOnly || lead.stage === "won" || lead.stage === "lost" || !["registered", "converted"].includes(lead.status);
  const [rounds, approvals] = await Promise.all([
    Promise.all(
      quotes.map((quote) =>
        contract
          .GET("/v1/admin/sales/quotes/{agentQuoteId}/discount-requests", {
            params: { path: { agentQuoteId: quote.id } },
          })
          .then((response) => response.data ?? []),
      ),
    ),
    can("discount_approvals.read")
      ? contract
          .GET("/v1/admin/sales/discount-approvals", { params: { query: { perPage: 100 } } })
          .then((response) => response.data?.data ?? [])
      : Promise.resolve([]),
  ]);
  const rows = [
    {
      key: "phone",
      icon: "phone" as const,
      value: lead.phone ? displayPhone(lead.phone) : null,
      href: lead.phone ? `tel:${lead.phone}` : null,
    },
    { key: "email", icon: "mail" as const, value: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
    { key: "lineId", icon: "chat" as const, value: lead.lineId, href: null },
    { key: "taxId", icon: "building" as const, value: lead.taxId, href: null },
    { key: "industry", icon: "tag" as const, value: lead.industry, href: null },
  ];

  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader
        back={{ href: "/sales/pipeline", label: t("back") }}
        title={lead.contactName}
        meta={
          <>
            <StatusChip map={AGENT_LEAD_STAGE} value={lead.stage} size="md" />
            {lead.organisationName ? <span className="text-muted text-sm">{lead.organisationName}</span> : null}
          </>
        }
        description={t("workedBy", { name: lead.agent.legalName, code: lead.agent.code })}
        actions={
          closed ? null : (
            <>
              <LogActivity leadId={lead.id} />
              <StageMenu leadId={lead.id} name={lead.contactName} stage={lead.stage} size="md" surface="admin" />
              <NewSalesQuote leadId={lead.id} leadName={lead.contactName} />
            </>
          )
        }
      />
      <SalesNav />
      {readOnly ? <p className="text-muted -mt-2 text-sm">{t("readOnly")}</p> : null}

      <section aria-label={tAgent("summary")} className="border-border bg-surface rounded-card border p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-muted text-xs">{tAgent("protection")}</dt>
            <dd className="mt-0.5 text-[0.9375rem]">
              <ProtectionText lead={lead} />
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{tAgent("expectedValue")}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold tabular-nums">
              {lead.expectedValue ? (
                format.thb(lead.expectedValue)
              ) : (
                <span className="text-muted font-normal">{tAgent("noValue")}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{tAgent("since")}</dt>
            <dd className="mt-0.5 text-[0.9375rem]">{format.date(lead.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("followUp")}</dt>
            <dd className="mt-0.5 text-[0.9375rem]">
              {lead.nextFollowUpAt ? (
                format.dateTime(lead.nextFollowUpAt)
              ) : (
                <span className="text-muted">{t("noFollowUp")}</span>
              )}
            </dd>
          </div>
        </dl>
        {lead.stage === "lost" ? (
          <p className="text-muted mt-3 text-sm">
            {tAgent("lostBecause", { reason: lead.lostReason ? tAgent(`lostReasons.${lead.lostReason}`) : "—" })}
            {lead.lostNote ? ` · ${lead.lostNote}` : ""}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="quotes-heading"
            className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5"
          >
            <h2 id="quotes-heading" className="text-base font-semibold">
              {tAgent("quotes")}
            </h2>
            {quotes.length === 0 ? (
              <p className="text-muted text-sm">{closed ? tAgent("noQuotesClosed") : t("noQuotes")}</p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {quotes.map((quote, at) => {
                  const last = rounds[at]?.at(-1);
                  const approval = approvals.find((row) => row.agentQuoteId === quote.id && row.requestId === last?.id);
                  return (
                    <li key={quote.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {quote.quote.summary.product?.nameTh ?? quote.quote.quoteCode}
                        </p>
                        <p className="text-muted text-xs tabular-nums">
                          {[
                            quote.quote.quoteCode,
                            t("quantity", { count: format.number(quote.quote.options[0]?.quantity ?? 0) }),
                            tAgent("sentOn", { date: format.date(quote.sentAt, { style: "dayMonth" }) }),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {last ? (
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                            <StatusChip map={AGENT_DISCOUNT_REQUEST_STATUS} value={last.status} />
                            <span className="text-muted">
                              {t("asked", { pct: format.percent(last.requestedPct), round: last.round })}
                            </span>
                            {approval ? (
                              <Link
                                href={`/sales/approvals/${approval.id}`}
                                className="text-link inline-flex items-center gap-1 hover:underline"
                              >
                                <StatusChip map={SALES_DISCOUNT_APPROVAL_STATUS} value={approval.status} />
                                {t("openApproval")}
                              </Link>
                            ) : null}
                          </p>
                        ) : null}
                        {last?.options.length ? (
                          <ul className="text-muted mt-1 text-xs">
                            {last.options.map((option) => (
                              <li key={option.id}>
                                {t(`optionLine.${option.kind}`, {
                                  pct: format.percent(option.discountPct),
                                  rate: format.percent(option.ratePct),
                                })}
                                {option.status === "accepted" ? ` · ${t("accepted")}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-semibold tabular-nums">
                          {format.thb(quote.quote.options[0]?.grossAmount)}
                        </span>
                        <StatusChip map={AGENT_QUOTE_STATUS} value={quote.status} />
                        {!closed && last?.status !== "open" && last?.status !== "offered" ? (
                          <RequestDiscount agentQuoteId={quote.id} quoteCode={quote.quote.quoteCode} />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="timeline-heading"
            className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5"
          >
            <h2 id="timeline-heading" className="text-base font-semibold">
              {tAgent("timeline")}
            </h2>
            {activities.length === 0 ? (
              <p className="text-muted text-sm">{tAgent("noActivity")}</p>
            ) : (
              <LeadTimeline activities={activities} surface="admin" />
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="details-heading"
            className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5"
          >
            <h2 id="details-heading" className="text-base font-semibold">
              {tAgent("details")}
            </h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              {rows.map((row) => (
                <div key={row.key} className="flex items-start gap-2.5">
                  <Icon name={row.icon} size={16} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
                  <dt className="sr-only">{tAgent(`fields.${row.key}`)}</dt>
                  <dd className="min-w-0 break-words">
                    {row.value ? (
                      row.href ? (
                        <a href={row.href} className="text-link underline-offset-2 hover:underline">
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )
                    ) : (
                      <span className="text-muted">{tAgent("missing", { field: tAgent(`fields.${row.key}`) })}</span>
                    )}
                  </dd>
                </div>
              ))}
              {lead.note ? (
                <div className="border-border mt-1 border-t pt-3">
                  <dt className="text-muted text-xs">{tAgent("fields.note")}</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{lead.note}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          {can("sales_reports.read") ? (
            <section
              aria-labelledby="history-heading"
              className="border-border bg-surface rounded-card flex flex-col gap-2 border p-4 sm:p-5"
            >
              <h2 id="history-heading" className="text-base font-semibold">
                {t("history")}
              </h2>
              <p className="text-muted text-sm">{t("historyHint")}</p>
              <Button asChild size="sm" variant="secondary" iconStart="history" className="self-start">
                <Link href={`/sales/reports/negotiations?leadId=${lead.id}`}>{t("openHistory")}</Link>
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </ConsolePage>
  );
}
