import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CertificateButton } from "@/features/customer/agent/AgentActions";
import { AgentFrame } from "@/features/customer/agent/AgentPieces";
import { getMyStatement } from "@/features/customer/agent/api.server";
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
  const { statementId } = await params;
  const [t, tc, format, s] = await Promise.all([
    getTranslations("agent.statements"),
    getTranslations("agent.commissions"),
    getFormat(),
    getMyStatement(statementId),
  ]);
  if (!s) notFound();
  return (
    <AgentFrame
      title={t("detailTitle", { period: format.date(s.periodStart, { style: "month" }) })}
      intro={s.statementNo}
      actions={s.hasWhtCertificate ? <CertificateButton statementId={s.id} /> : null}
    >
      <DescriptionList
        items={[
          { term: t("status"), description: <StatusChip map={AGENT_STATEMENT_STATUS} value={s.status} /> },
          { term: t("total"), description: format.thb(s.totalAmount) },
          { term: t("wht"), description: format.thb(s.whtAmount) },
          { term: t("paid"), description: format.thb(s.paidAmount) },
          { term: t("approvedAt"), description: format.date(s.approvedAt) },
          { term: t("paidAt"), description: format.date(s.paidAt) },
        ]}
      />
      <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
        {s.entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>
              {tc(`kinds.${entry.kind}`)}
              {entry.orderCode ? <span className="font-mono"> {entry.orderCode}</span> : null}
              {entry.customerName ? <span className="text-muted"> · {entry.customerName}</span> : null}
              {entry.factoryName ? <span className="text-muted"> · {entry.factoryName}</span> : null}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-semibold tabular-nums">{format.thb(entry.amount)}</span>
              <StatusChip map={AGENT_COMMISSION_STATUS} value={entry.status} />
            </span>
          </li>
        ))}
      </ul>
    </AgentFrame>
  );
}
