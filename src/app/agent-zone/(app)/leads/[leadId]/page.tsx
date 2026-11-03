import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AGENT_LEAD_STAGE, AGENT_QUOTE_STATUS } from "@/domain/status";
import { AgentPage, Panel } from "@/features/agent/AgentPage";
import {
  getAgentQuotes,
  getLead,
  getLeadActivities,
  getPipeline,
  getPlaybook,
  type PipelineLead,
  type PlaybookContext,
} from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { PlaybookCard } from "@/features/agent/playbook/PlaybookCard";
import { EditLead } from "@/features/agent/pipeline/EditLead";
import { FollowUpPicker } from "@/features/agent/pipeline/FollowUpPicker";
import { LeadActionBar } from "@/features/agent/pipeline/LeadActions";
import { ProtectionText } from "@/features/agent/pipeline/LeadCard";
import { LeadTimeline } from "@/features/agent/pipeline/LeadTimeline";
import { displayPhone } from "@/features/agent/pipeline/phone";
import { StageMenu } from "@/features/agent/pipeline/StageMenu";
import { DealBadge } from "@/features/agent/quotes/DealBadge";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata({ params }: { params: Promise<{ leadId: string }> }): Promise<Metadata> {
  const { leadId } = await params;
  const [t, found] = await Promise.all([getTranslations("agentZone.titles"), getLead(leadId).catch(() => null)]);
  return { title: found ? found.lead.contactName : t("leads") };
}

/** The playbook context a lead is in (D-468 §5). */
function contextOf(lead: PipelineLead, bigDeal: boolean): PlaybookContext {
  if (lead.stage === "lost") return "lead_lost_price";
  if (bigDeal) return "big_deal";
  if (lead.stage === "new") return "first_contact";
  if (lead.stage === "negotiating") return "discount_request";
  return "follow_up";
}

/**
 * One lead (D-468, PROMPT P3 Web 3). A phone reads it as a full page with the action bar fixed above the tab bar
 * (โทร · LINE · ส่งใบเสนอราคา · บันทึกการติดต่อ); a desktop keeps the pipeline beside it (split view). Header: name, stage,
 * protection countdown, expected value, a registered deal. Then follow-up, timeline, quotes, details and the playbook
 * card for where the lead stands.
 */
export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  await requireActiveAgent();
  const { leadId } = await params;
  const found = await getLead(leadId);
  if (!found) notFound();
  const { lead, etag } = found;
  const [t, tz, format, activities, quotes, pipeline] = await Promise.all([
    getTranslations("agentSales.lead"),
    getTranslations("agentZone.titles"),
    getFormat(),
    getLeadActivities(lead.id),
    getAgentQuotes({ leadId: lead.id }),
    getPipeline({ view: "open", limit: 30 }),
  ]);
  const deal = quotes.data.map((quote) => quote.dealRegistration).find((entry) => entry && entry.status === "registered");
  const playbook = (await getPlaybook(contextOf(lead, Boolean(deal)))).filter((card) => !card.contexts.includes("all"));
  const closed = lead.stage === "won" || lead.stage === "lost" || !["registered", "converted"].includes(lead.status);
  const rows = [
    { key: "phone", icon: "phone" as const, value: lead.phone ? displayPhone(lead.phone) : null, href: lead.phone ? `tel:${lead.phone}` : null },
    { key: "email", icon: "mail" as const, value: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
    { key: "lineId", icon: "chat" as const, value: lead.lineId, href: null },
    { key: "taxId", icon: "building" as const, value: lead.taxId, href: null },
    { key: "industry", icon: "tag" as const, value: lead.industry, href: null },
  ];

  return (
    <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label={t("pipelineNav")} className="hidden lg:block">
        <div className="sticky top-20 flex max-h-[calc(100dvh-7rem)] flex-col gap-2">
          <Link href="/leads" className="text-muted hover:text-fg inline-flex min-h-9 items-center gap-1 text-sm">
            <Icon name="chevron-left" size={16} aria-hidden="true" />
            {tz("leads")}
          </Link>
          <ul className="border-border bg-surface rounded-card flex flex-col overflow-y-auto border p-1.5">
            {pipeline.data.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/leads/${row.id}`}
                  aria-current={row.id === lead.id ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-focus-ring flex flex-col rounded-lg px-3 py-2 outline-none focus-visible:ring-2",
                    row.id === lead.id ? "bg-primary-subtle text-primary-subtle-fg" : "hover:bg-surface-subtle",
                  )}
                >
                  <span className="truncate text-sm font-medium">{row.contactName}</span>
                  <span className="text-muted truncate text-xs">{row.organisationName ?? " "}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <AgentPage
        title={lead.contactName}
        status={<StatusChip map={AGENT_LEAD_STAGE} value={lead.stage} size="md" />}
        intro={lead.organisationName ?? undefined}
        back={{ href: "/leads", label: tz("leads") }}
        className="lg:[&>header>a]:hidden"
        actions={closed ? null : <StageMenu leadId={lead.id} name={lead.contactName} stage={lead.stage} size="md" />}
      >
        <section aria-label={t("summary")} className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted text-xs">{t("protection")}</dt>
              <dd className="mt-0.5 text-[0.9375rem]">
                <ProtectionText lead={lead} />
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t("expectedValue")}</dt>
              <dd className="mt-0.5 text-[0.9375rem] font-semibold tabular-nums">
                {lead.expectedValue ? format.thb(lead.expectedValue) : <span className="text-muted font-normal">{t("noValue")}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t("since")}</dt>
              <dd className="mt-0.5 text-[0.9375rem]">{format.date(lead.createdAt)}</dd>
            </div>
          </dl>
          <DealBadge deal={deal} className="self-start" />
          {lead.stage === "lost" ? (
            <p className="text-muted text-sm">
              {t("lostBecause", { reason: lead.lostReason ? t(`lostReasons.${lead.lostReason}`) : "—" })}
              {lead.lostNote ? ` · ${lead.lostNote}` : ""}
            </p>
          ) : null}
          <LeadActionBar lead={lead} closed={closed} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {closed ? null : (
              <Panel title={t("followUp")} id="follow-up">
                <FollowUpPicker leadId={lead.id} etag={etag} current={lead.nextFollowUpAt} />
              </Panel>
            )}

            <Panel
              title={t("quotes")}
              id="quotes"
              action={
                closed ? null : (
                  <Button asChild size="sm" variant="secondary" iconStart="plus" className="min-h-11 sm:min-h-8">
                    <Link href={`/quotes/new?leadId=${lead.id}`}>{t("newQuote")}</Link>
                  </Button>
                )
              }
            >
              {quotes.data.length === 0 ? (
                <p className="text-muted text-sm">{closed ? t("noQuotesClosed") : t("noQuotes")}</p>
              ) : (
                <ul className="divide-border flex flex-col divide-y">
                  {quotes.data.map((quote) => (
                    <li key={quote.id}>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="focus-visible:ring-focus-ring hover:bg-surface-subtle -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 outline-none focus-visible:ring-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {quote.quote.summary.product?.nameTh ?? quote.quote.quoteCode}
                          </span>
                          <span className="text-muted block text-xs tabular-nums">
                            {[quote.quote.quoteCode, t("sentOn", { date: format.date(quote.sentAt, { style: "dayMonth" }) })].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-semibold tabular-nums">{format.thb(quote.quote.options[0]?.grossAmount)}</span>
                          <StatusChip map={AGENT_QUOTE_STATUS} value={quote.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t("timeline")} id="timeline">
              {activities.length === 0 ? (
                <p className="text-muted text-sm">{t("noActivity")}</p>
              ) : (
                <LeadTimeline activities={activities} />
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Panel title={t("details")} id="details" action={closed ? null : <EditLead lead={lead} etag={etag} />}>
              <dl className="flex flex-col gap-2.5 text-sm">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-start gap-2.5">
                    <Icon name={row.icon} size={16} aria-hidden="true" className="text-muted mt-0.5 shrink-0" />
                    <dt className="sr-only">{t(`fields.${row.key}`)}</dt>
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
                        <span className="text-muted">{t("missing", { field: t(`fields.${row.key}`) })}</span>
                      )}
                    </dd>
                  </div>
                ))}
                {lead.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <dt className="sr-only">{t("fields.tags")}</dt>
                    {lead.tags.map((tag) => (
                      <dd key={tag} className="bg-surface-subtle rounded-md px-2 py-0.5 text-xs">
                        {tag}
                      </dd>
                    ))}
                  </div>
                ) : null}
                {lead.note ? (
                  <div className="border-border mt-1 border-t pt-3">
                    <dt className="text-muted text-xs">{t("fields.note")}</dt>
                    <dd className="mt-0.5 whitespace-pre-line">{lead.note}</dd>
                  </div>
                ) : null}
              </dl>
            </Panel>
            {playbook.slice(0, 1).map((card) => (
              <PlaybookCard key={card.id} card={card} compact />
            ))}
            <Link href="/playbook" className="text-primary -mt-3 self-start text-sm font-medium underline underline-offset-2">
              {t("allPlaybook")}
            </Link>
          </div>
        </div>
      </AgentPage>
    </div>
  );
}
