import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CertificateButton } from "@/features/customer/agent/AgentActions";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { AgentFrame } from "@/features/customer/agent/AgentPieces";
import { getMyStatement, requireAgent } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { AGENT_COMMISSION_STATUS, AGENT_STATEMENT_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.statements");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** One month's statement with its entries, withholding and the 50 ทวิ once paid (D-420, D-421). */
export default async function Page({ params }: { params: Promise<{ statementId: string }> }) {
  await requireCustomer();
  await requireAgent();
  const { statementId } = await params;
  const [t, tc, tt, tNav, format, s] = await Promise.all([
    getTranslations("agent.statements"),
    getTranslations("agent.commissions"),
    getTranslations("agent.table"),
    getTranslations("agent.nav"),
    getFormat(),
    getMyStatement(statementId),
  ]);
  if (!s) notFound();
  return (
    <AgentFrame
      back={{ href: "/account/agent/statements", label: tNav("statements") }}
      title={t("detailTitle", { period: format.date(s.periodStart, { style: "month" }) })}
      status={<StatusChip map={AGENT_STATEMENT_STATUS} value={s.status} size="md" />}
      intro={s.statementNo}
      actions={s.hasWhtCertificate ? <CertificateButton statementId={s.id} /> : null}
    >
      {/* Project B4: the three amounts as summary cards (what is transferred on the tint), the dates beside the
          entries. */}
      <SummaryCards
        columns={3}
        items={[
          { key: "paid", label: t("paid"), value: format.thb(s.paidAmount), icon: "wallet", highlight: true },
          { key: "total", label: t("total"), value: format.thb(s.totalAmount), icon: "coins" },
          { key: "wht", label: t("wht"), value: format.thb(s.whtAmount), icon: "receipt" },
        ]}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <PortalTable
          caption={t("detailTitle", { period: format.date(s.periodStart, { style: "month" }) })}
          columns={[
            { key: "item", label: tt("item"), className: "md:w-[50%]" },
            { key: "amount", label: tt("amount"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: tt("status"), className: "md:whitespace-nowrap" },
          ]}
          rows={s.entries.map((entry) => ({
            id: entry.id,
            phoneSubtitle: entry.customerName,
            cells: {
              item: (
                <span className="block min-w-0">
                  <span className="block font-semibold">
                    {tc(`kinds.${entry.kind}`)}
                    {entry.orderCode ? <span className="font-normal tabular-nums"> {entry.orderCode}</span> : null}
                  </span>
                  {entry.customerName ? (
                    <span className="text-muted hidden text-xs font-normal md:block">{entry.customerName}</span>
                  ) : null}
                </span>
              ),
              amount: <span className="font-semibold">{format.thb(entry.amount)}</span>,
              status: <StatusChip map={AGENT_COMMISSION_STATUS} value={entry.status} />,
            },
          }))}
        />
        <div className="border-border bg-surface rounded-card border p-4">
          <DescriptionList
            items={[
              { term: t("approvedAt"), description: format.date(s.approvedAt) },
              { term: t("paidAt"), description: format.date(s.paidAt) },
            ]}
          />
        </div>
      </div>
    </AgentFrame>
  );
}
