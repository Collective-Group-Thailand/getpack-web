import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AGENT_LEAD_STAGE } from "@/domain/status";
import { AgentPage } from "@/features/agent/AgentPage";
import { getLead, getPipeline, getQuotableProducts } from "@/features/agent/api.server";
import { requireActiveAgent } from "@/features/agent/context.server";
import { NewQuoteFlow } from "@/features/agent/quotes/NewQuoteFlow";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentSales.newQuote");
  return { title: t("title") };
}

/**
 * A new quote on a lead's behalf (D-468 §2). Opened from a lead (`?leadId=`); from the quotes tab the agent first
 * picks which lead it is for — a quote always belongs to one (getpack owns it until the lead signs up).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  await requireActiveAgent();
  const { leadId } = await searchParams;
  const [t, tz] = await Promise.all([getTranslations("agentSales.newQuote"), getTranslations("agentZone.titles")]);
  const found = leadId ? await getLead(leadId) : null;
  const open = found && ["registered", "converted"].includes(found.lead.status) && !["won", "lost"].includes(found.lead.stage);

  if (!found || !open) {
    const pipeline = await getPipeline({ view: "open", limit: 50 });
    return (
      <AgentPage title={t("title")} intro={t("pickLeadIntro")} back={{ href: "/quotes", label: t("backToQuotes") }}>
        {pipeline.data.length === 0 ? (
          <EmptyState
            icon="user-plus"
            title={t("noLeadsTitle")}
            description={t("noLeadsBody")}
            action={
              <Button asChild>
                <Link href="/leads">{tz("leads")}</Link>
              </Button>
            }
          />
        ) : (
          <section aria-labelledby="pick-lead" className="flex flex-col gap-3">
            <h2 id="pick-lead" className="text-lg font-semibold">
              {t("pickLead")}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pipeline.data.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/quotes/new?leadId=${lead.id}`}
                    className="border-border bg-surface focus-visible:ring-focus-ring hover:border-primary/40 rounded-card flex min-h-16 items-center justify-between gap-3 border p-4 outline-none focus-visible:ring-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{lead.contactName}</span>
                      <span className="text-muted block truncate text-sm">{lead.organisationName ?? " "}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusChip map={AGENT_LEAD_STAGE} value={lead.stage} />
                      <Icon name="chevron-right" size={16} aria-hidden="true" className="text-muted" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </AgentPage>
    );
  }

  const products = await getQuotableProducts();
  const { lead } = found;
  return (
    <AgentPage title={t("title")} back={{ href: `/leads/${lead.id}`, label: lead.contactName }}>
      <NewQuoteFlow
        lead={{ id: lead.id, contactName: lead.contactName, organisationName: lead.organisationName, lineId: lead.lineId }}
        products={products}
      />
    </AgentPage>
  );
}
