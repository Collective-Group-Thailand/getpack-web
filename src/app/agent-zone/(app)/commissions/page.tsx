import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PortalTable } from "@/ui/components/PortalTable";
import { SummaryCards } from "@/ui/components/SummaryCards";
import { AgentPage, AgentPager, pageOf } from "@/features/agent/AgentPage";
import { getForecast, getMyCommissions } from "@/features/agent/api.server";
import { Forecast } from "@/features/agent/forecast/Forecast";
import { ViewTabs } from "@/ui/components/ViewTabs";
import { requireActiveAgent } from "@/features/agent/context.server";
import { getFormat } from "@/features/shared/format/server";
import Link from "next/link";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { AGENT_COMMISSION_STATUS } from "@/domain/status";
import { StatusChip } from "@/features/shared/status/StatusChip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.titles");
  return { title: t("commissions") };
}

/**
 * Every commission entry (D-418, D-419): an order's commission waits for its claim window and payment,
 * then is earned and goes on the month's statement; refunds come back as negative entries.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; view?: string }> }) {
  const { agent } = await requireActiveAgent();
  const search = await searchParams;
  const page = pageOf(search.page);
  const forecastView = search.view === "forecast";
  const [t, tt, tHome, tz, format, list] = await Promise.all([
    getTranslations("agent.commissions"),
    getTranslations("agent.table"),
    getTranslations("agent.home"),
    getTranslations("agentZone.titles"),
    getFormat(),
    forecastView ? null : getMyCommissions(page),
  ]);
  const tViews = await getTranslations("agentSales.forecast");
  const views = (
    <ViewTabs
      label={tViews("views")}
      current={forecastView ? "forecast" : "entries"}
      items={[
        { key: "entries", href: "/commissions", label: tViews("entries") },
        { key: "forecast", href: "/commissions?view=forecast", label: tViews("forecast") },
      ]}
    />
  );
  return (
    <AgentPage
      title={tz("commissions")}
      intro={t("intro")}
      actions={
        // On a phone the statements sit behind this tab (PROMPT <responsive>: four tabs, no "more").
        <Button asChild variant="secondary" iconStart="receipt">
          <Link href="/statements">{tz("statements")}</Link>
        </Button>
      }
    >
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
      {views}
      {forecastView ? (
        <Forecast forecast={await getForecast()} />
      ) : !list ? null : list.data.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <Link href="/">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <PortalTable
          caption={tz("commissions")}
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
      {list ? <AgentPager page={page} total={list.meta.total} perPage={list.meta.perPage} path="/commissions" /> : null}
    </AgentPage>
  );
}
