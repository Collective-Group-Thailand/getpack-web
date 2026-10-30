import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PortalTable } from "@/features/customer/account/PortalTable";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { AgentFrame, AgentPager, pageOf } from "@/features/customer/agent/AgentPieces";
import { getAgent, getMyCommissions, requireAgent } from "@/features/customer/agent/api.server";
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
  await requireAgent();
  const page = pageOf((await searchParams).page);
  const [t, tt, tHome, format, list, agent] = await Promise.all([
    getTranslations("agent.commissions"),
    getTranslations("agent.table"),
    getTranslations("agent.home"),
    getFormat(),
    getMyCommissions(page),
    getAgent(),
  ]);
  return (
    <AgentFrame title={t("title")} intro={t("intro")}>
      {/* Project B4: the money by status on top, as the API totals it. */}
      <SummaryCards
        items={[
          {
            key: "earned",
            label: tHome("earned"),
            value: format.thb(agent.totals.earned),
            hint: tHome("earnedHint"),
            icon: "coins",
            highlight: true,
          },
          {
            key: "pending",
            label: tHome("pending"),
            value: format.thb(agent.totals.pending),
            hint: tHome("pendingHint"),
            icon: "hourglass",
          },
          {
            key: "statemented",
            label: tHome("statemented"),
            value: format.thb(agent.totals.statemented),
            hint: tHome("statementedHint"),
            icon: "document",
          },
          { key: "paid", label: tHome("paidThisYear"), value: format.thb(agent.totals.paidThisYear), icon: "wallet" },
        ]}
      />
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
        <PortalTable
          caption={t("title")}
          columns={[
            { key: "item", label: tt("item"), className: "md:w-[30%]" },
            { key: "detail", label: tt("detail") },
            { key: "date", label: tt("date") },
            { key: "amount", label: tt("amount"), numeric: true, className: "md:whitespace-nowrap" },
            { key: "status", label: tt("status"), className: "md:whitespace-nowrap" },
          ]}
          rows={list.data.map((entry) => ({
            id: entry.id,
            phoneSubtitle: entry.customerName,
            cells: {
              item: (
                <span className="block min-w-0">
                  <span className="block font-semibold">
                    {t(`kinds.${entry.kind}`)}
                    {entry.orderCode ? <span className="font-normal tabular-nums"> {entry.orderCode}</span> : null}
                  </span>
                  {entry.customerName ? (
                    <span className="text-muted hidden text-xs font-normal md:block">{entry.customerName}</span>
                  ) : null}
                </span>
              ),
              detail: (
                <span className="text-muted text-xs">
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
                </span>
              ),
              date: (
                <span className="text-sm">
                  {entry.status === "pending" && entry.availableAt
                    ? t("availableAt", { date: format.date(entry.availableAt) })
                    : entry.statementNo
                      ? t("onStatement", { no: entry.statementNo })
                      : format.date(entry.createdAt)}
                </span>
              ),
              amount: (
                <span className={`font-semibold ${Number(entry.amount) < 0 ? "text-danger" : ""}`}>
                  {format.thb(entry.amount)}
                </span>
              ),
              status: <StatusChip map={AGENT_COMMISSION_STATUS} value={entry.status} />,
            },
          }))}
        />
      )}
      <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/account/agent/commissions" />
    </AgentFrame>
  );
}
