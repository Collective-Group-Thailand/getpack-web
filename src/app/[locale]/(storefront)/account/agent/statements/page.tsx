import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getMyStatements } from "@/features/customer/agent/api.server";
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
  const page = pageOf((await searchParams).page);
  const [t, format, list] = await Promise.all([
    getTranslations("agent.statements"),
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
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {list.data.map((s) => (
            <li key={s.id}>
              <Link
                href={`/account/agent/statements/${s.id}`}
                className="hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{format.date(s.periodStart, { style: "month" })}</p>
                  <p className="text-muted font-mono text-xs">{s.statementNo}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{format.thb(s.paidAmount ?? s.totalAmount)}</span>
                  <StatusChip map={AGENT_STATEMENT_STATUS} value={s.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/statements" />
    </AgentFrame>
  );
}
