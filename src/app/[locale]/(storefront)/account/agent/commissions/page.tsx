import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getMyCommissions } from "@/features/customer/agent/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_COMMISSION_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.commissions");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Every commission entry (D-418, D-419): an order's commission waits for its claim window and payment,
 * then is earned and goes on the month's statement; refunds come back as negative entries.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireCustomer();
  const page = pageOf((await searchParams).page);
  const [t, format, list] = await Promise.all([
    getTranslations("agent.commissions"),
    getFormat(),
    getMyCommissions(page),
  ]);
  return (
    <AgentFrame title={t("title")} intro={t("intro")}>
      {list.data.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/account/agent">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {list.data.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {t(`kinds.${entry.kind}`)}
                  {entry.orderCode ? <span className="text-sm tabular-nums"> {entry.orderCode}</span> : null}
                  {entry.customerName ? <span className="text-muted"> · {entry.customerName}</span> : null}
                </p>
                <p className="text-muted text-xs">
                  {entry.kind === "order"
                    ? t("detail", {
                        base: format.thb(entry.baseAmount),
                        rate: entry.ratePct ?? "0",
                        first: entry.isFirstOrder ? "yes" : "no",
                      })
                    : (entry.note ?? "")}
                  {entry.capAmount !== null && entry.kind === "order"
                    ? ` · ${t("cap", { amount: format.thb(entry.capAmount) })}`
                    : ""}
                </p>
                <p className="text-muted text-xs">
                  {entry.status === "pending" && entry.availableAt
                    ? t("availableAt", { date: format.date(entry.availableAt) })
                    : entry.statementNo
                      ? t("onStatement", { no: entry.statementNo })
                      : format.date(entry.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold tabular-nums ${Number(entry.amount) < 0 ? "text-danger" : ""}`}>
                  {format.thb(entry.amount)}
                </span>
                <StatusChip map={AGENT_COMMISSION_STATUS} value={entry.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/commissions" />
    </AgentFrame>
  );
}
