import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AGENT_QUOTE_STATUS } from "@/domain/status";
import { AgentPage, AgentPager, pageOf } from "@/features/agent/AgentPage";
import { getAgentQuotes, type AgentQuote } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { PortalTable } from "@/ui/components/PortalTable";
import { StatusBadge } from "@/ui/components/StatusBadge";
import { ViewTabs } from "@/ui/components/ViewTabs";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.quotes");
  return { title: t("title") };
}

const TABS = ["all", "opened", "sent", "accepted", "expired", "withdrawn"] as const;
type Tab = (typeof TABS)[number];

/**
 * ใบเสนอราคา (D-468, PROMPT P3 Web 4): the quotes the agent sent on leads' behalf — who, what, the total, and where
 * each stands (sent, opened by the customer, accepted, expired, withdrawn), with the deal badge where one is
 * registered. Replaces the P2 explainer. A phone reads cards; from 768 px a table.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireActiveAgent();
  const search = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(search.status ?? "") ? (search.status as Tab) : "all";
  const page = pageOf(search.page);
  const [t, tStatus, format, list] = await Promise.all([
    getTranslations("agentSales.quotes"),
    getTranslations("status"),
    getFormat(),
    getAgentQuotes({ status: tab === "all" ? undefined : (tab as AgentQuote["status"]), page }),
  ]);
  return (
    <AgentPage
      title={t("title")}
      intro={t("intro")}
      actions={
        <Button asChild iconStart="plus">
          <Link href="/quotes/new">{t("new")}</Link>
        </Button>
      }
    >
      <ViewTabs
        label={t("views")}
        current={tab}
        items={TABS.map((key) => ({
          key,
          href: key === "all" ? "/quotes" : `/quotes?status=${key}`,
          label: key === "all" ? t("all") : tStatus(AGENT_QUOTE_STATUS[key].labelKey),
        }))}
      />
      {list.data.length === 0 ? (
        <EmptyState
          icon="document"
          title={tab === "all" ? t("emptyTitle") : t("emptyFiltered")}
          description={tab === "all" ? t("emptyBody") : undefined}
          illustration={
            tab === "all" ? (
              <ol className="flex flex-wrap items-center justify-center gap-1.5" aria-label={t("pathLabel")}>
                {(["sent", "opened", "accepted"] as const).map((status, index) => (
                  <li key={status} className="flex items-center gap-1.5">
                    <StatusBadge meta={AGENT_QUOTE_STATUS[status]} label={tStatus(AGENT_QUOTE_STATUS[status].labelKey)} size="sm" />
                    {index < 2 ? <Icon name="chevron-right" size={14} className="text-muted" aria-hidden="true" /> : null}
                  </li>
                ))}
              </ol>
            ) : undefined
          }
          action={
            <Button asChild variant={tab === "all" ? "primary" : "secondary"}>
              <Link href={tab === "all" ? "/leads" : "/quotes"}>{tab === "all" ? t("emptyAction") : t("all")}</Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          caption={t("title")}
          columns={[
            { key: "lead", label: t("columns.lead"), className: "md:w-[28%]" },
            { key: "product", label: t("columns.product") },
            { key: "total", label: t("columns.total"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: t("columns.status"), className: "md:whitespace-nowrap" },
            { key: "sent", label: t("columns.sent"), className: "md:whitespace-nowrap" },
            { key: "open", label: t("columns.open"), srOnly: true, className: "text-end md:w-px" },
          ]}
          rows={list.data.map((quote) => {
            const largest = quote.quote.options.at(-1);
            return {
              id: quote.id,
              phoneSubtitle: quote.lead.organisationName,
              cells: {
                lead: (
                  <span className="block min-w-0">
                    <Link href={`/quotes/${quote.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {quote.lead.contactName}
                    </Link>
                    {quote.lead.organisationName ? (
                      <span className="text-muted hidden text-xs font-normal md:block">{quote.lead.organisationName}</span>
                    ) : null}
                  </span>
                ),
                product: (
                  <span className="text-sm">
                    {quote.quote.summary.product?.nameTh ?? quote.quote.summary.productTypeNameTh}
                    <span className="text-muted block text-xs tabular-nums">
                      {[quote.quote.quoteCode, largest ? t("pieces", { quantity: format.number(largest.quantity) }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                ),
                total: <span className="font-semibold tabular-nums">{format.thb(largest?.grossAmount)}</span>,
                status: (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <StatusChip map={AGENT_QUOTE_STATUS} value={quote.status} />
                    {quote.dealRegistration?.status === "registered" ? (
                      <span className="text-success-subtle-fg inline-flex items-center gap-1 text-xs font-medium">
                        <Icon name="shield-check" size={14} aria-hidden="true" />
                        {t("dealShort")}
                      </span>
                    ) : null}
                  </span>
                ),
                sent: (
                  <span className="text-sm">
                    {format.date(quote.sentAt, { style: "dayMonth" })}
                    {quote.openedAt ? (
                      <span className="text-muted block text-xs">{t("openedOn", { date: format.dateTime(quote.openedAt, { style: "dayMonth" }) })}</span>
                    ) : null}
                  </span>
                ),
                open: (
                  <Button asChild size="sm" variant="ghost" className="min-h-11 md:min-h-8">
                    <Link href={`/quotes/${quote.id}`}>
                      {t("open")}
                      <span className="sr-only"> {quote.lead.contactName}</span>
                    </Link>
                  </Button>
                ),
              },
            };
          })}
        />
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path={tab === "all" ? "/quotes" : `/quotes?status=${tab}`} />
    </AgentPage>
  );
}
