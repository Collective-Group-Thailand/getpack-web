import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RegisterLead, WithdrawLead } from "@/features/customer/agent/AgentActions";
import { PortalTable } from "@/features/customer/account/PortalTable";
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
  const [t, tt, format, list, agent] = await Promise.all([
    getTranslations("agent.leads"),
    getTranslations("agent.table"),
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
        <PortalTable
          caption={t("title")}
          columns={[
            { key: "lead", label: tt("lead"), className: "md:w-[30%]" },
            { key: "kind", label: tt("kind"), className: "md:whitespace-nowrap" },
            { key: "contact", label: tt("contact") },
            { key: "protection", label: tt("protection"), className: "md:whitespace-nowrap" },
            { key: "status", label: tt("status"), className: "md:whitespace-nowrap" },
            { key: "actions", label: tt("actions"), srOnly: true, className: "text-end md:w-px md:whitespace-nowrap" },
          ]}
          rows={list.data.map((lead) => ({
            id: lead.id,
            phoneSubtitle: lead.organisationName,
            cells: {
              lead: (
                <span className="block min-w-0">
                  <span className="block font-semibold">{lead.contactName}</span>
                  {lead.organisationName ? (
                    <span className="text-muted hidden text-xs font-normal md:block">{lead.organisationName}</span>
                  ) : null}
                </span>
              ),
              kind: t(`kinds.${lead.kind}`),
              contact: (
                <span className="text-sm break-all tabular-nums">
                  {[lead.phone, lead.email, lead.taxId].filter(Boolean).join(" · ")}
                </span>
              ),
              protection: (
                <span className="text-sm">
                  {lead.status === "registered"
                    ? t("protectedUntil", { date: format.date(lead.protectedUntil) })
                    : lead.status === "converted"
                      ? t("convertedAt", { date: format.date(lead.convertedAt) })
                      : (lead.closedReason ?? "—")}
                </span>
              ),
              status: <StatusChip map={AGENT_LEAD_STATUS} value={lead.status} />,
              actions: lead.status === "registered" ? <WithdrawLead leadId={lead.id} name={lead.contactName} /> : null,
            },
          }))}
        />
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/leads" />
    </AgentFrame>
  );
}
