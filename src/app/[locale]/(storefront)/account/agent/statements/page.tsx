import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PortalTable } from "@/features/customer/account/PortalTable";
import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getMyStatements, requireAgent } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_STATEMENT_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.statements");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Monthly statements (D-420): approved by Finance, then transferred with tax withheld (D-421). */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireCustomer();
  await requireAgent();
  const page = pageOf((await searchParams).page);
  const [t, tt, format, list] = await Promise.all([
    getTranslations("agent.statements"),
    getTranslations("agent.table"),
    getFormat(),
    getMyStatements(page),
  ]);
  return (
    <AgentFrame title={t("title")} intro={t("intro")}>
      {list.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/account/agent/commissions">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          caption={t("title")}
          columns={[
            { key: "period", label: tt("period"), className: "md:w-[34%]" },
            { key: "number", label: tt("number"), className: "md:whitespace-nowrap" },
            { key: "amount", label: tt("amount"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: tt("status"), className: "md:whitespace-nowrap" },
          ]}
          rows={list.data.map((s) => ({
            id: s.id,
            cells: {
              period: (
                <Link
                  href={`/account/agent/statements/${s.id}`}
                  className="text-fg font-semibold underline-offset-4 hover:underline"
                >
                  {format.date(s.periodStart, { style: "month" })}
                </Link>
              ),
              number: <span className="tabular-nums">{s.statementNo}</span>,
              amount: <span className="font-semibold">{format.thb(s.paidAmount ?? s.totalAmount)}</span>,
              status: <StatusChip map={AGENT_STATEMENT_STATUS} value={s.status} />,
            },
          }))}
        />
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/statements" />
    </AgentFrame>
  );
}
