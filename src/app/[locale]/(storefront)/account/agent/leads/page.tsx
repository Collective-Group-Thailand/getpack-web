import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RegisterLead, WithdrawLead } from "@/features/customer/agent/AgentActions";
import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getAgent, getMyLeads, requireAgent } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_LEAD_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.leads");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Prospects the agent registered (D-417, D-419): protected from other agents until their date, linked
 * when they sign up, apply as a company or join as a factory.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireCustomer();
  const programme = await requireAgent();
  const page = pageOf((await searchParams).page);
  const [t, format, list, agent] = await Promise.all([
    getTranslations("agent.leads"),
    getFormat(),
    getMyLeads(page),
    getAgent(),
  ]);
  return (
    <AgentFrame
      title={t("title")}
      intro={t("intro", { days: programme.leadProtectionDays })}
      actions={agent.status === "active" ? <RegisterLead protectionDays={programme.leadProtectionDays} /> : null}
    >
      {list.data.length === 0 ? (
        <EmptyState
          icon="user-plus"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            agent.status === "active" ? (
              <RegisterLead protectionDays={programme.leadProtectionDays} />
            ) : (
              <Button asChild variant="secondary">
                <Link href="/account/agent">{t("emptyAction")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {list.data.map((lead) => (
            <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {lead.contactName}
                  {lead.organisationName ? <span className="text-muted"> · {lead.organisationName}</span> : null}
                </p>
                <p className="text-muted text-xs">
                  {t(`kinds.${lead.kind}`)} · {[lead.phone, lead.email, lead.taxId].filter(Boolean).join(" · ")}
                </p>
                <p className="text-muted text-xs">
                  {lead.status === "registered"
                    ? t("protectedUntil", { date: format.date(lead.protectedUntil) })
                    : lead.status === "converted"
                      ? t("convertedAt", { date: format.date(lead.convertedAt) })
                      : (lead.closedReason ?? "")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip map={AGENT_LEAD_STATUS} value={lead.status} />
                {lead.status === "registered" ? <WithdrawLead leadId={lead.id} name={lead.contactName} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/leads" />
    </AgentFrame>
  );
}
