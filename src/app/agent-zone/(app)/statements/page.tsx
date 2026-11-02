import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PortalTable } from "@/ui/components/PortalTable";
import { AgentPage, AgentPager, pageOf } from "@/features/agent/AgentPage";
import { getMyStatements } from "@/features/agent/api.server";
import { requireAgentRecords } from "@/features/agent/context.server";
import { getFormat } from "@/features/shared/format/server";
import Link from "next/link";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_STATEMENT_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.statements");
  return { title: t("title") };
}

/** Monthly statements (D-420): approved by Finance, then transferred with tax withheld (D-421). */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const state = await requireAgentRecords();
  const ended = state.kind === "ended";
  const page = pageOf((await searchParams).page);
  const [t, tt, tz, format, list] = await Promise.all([
    getTranslations("agent.statements"),
    getTranslations("agent.table"),
    getTranslations("agentZone.ended"),
    getFormat(),
    getMyStatements(page),
  ]);
  return (
    <AgentPage title={t("title")} intro={t("intro")}>
      {/* D-467: after the agreement ends, the statements and 50 ทวิ stay readable — and nothing else. */}
      {ended ? <Callout tone="info" title={tz("title")}>{tz("body")}</Callout> : null}
      {list.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            ended ? undefined : (
              <Button asChild variant="secondary">
                <Link href="/commissions">{t("emptyAction")}</Link>
              </Button>
            )
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
                  href={`/statements/${s.id}`}
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
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/statements" />
    </AgentPage>
  );
}
