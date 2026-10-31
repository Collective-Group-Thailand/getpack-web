"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PERIOD_STATUS } from "@/domain/status/finance";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { DeskSection, StatsRow, type SummaryItem } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { Row, RowList, StatStrip } from "@/ui/components/RowList";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import type { IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";
import { listTotalQuery, useQueues } from "../console/queues";
import { StatusChip } from "../console/StatusChip";
import { useSlaFormat } from "../console/useSlaFormat";
import { rowsSourceAt } from "../shell/badges";
import { browserPath } from "../shell/menu";
import { useFiscalYears } from "./ledger";
import { AccountNo } from "./shared";

/** The approval policies that belong to Finance's desks (accounting-design §8, D-169). */
export const FINANCE_POLICIES = new Set([
  "refund",
  "credit_note",
  "write_off",
  "payout_run",
  "manual_journal",
  "recurring_journal",
  "vendor_bank_account_change",
  "company_bank_account_change",
  "posting_rule_change",
  "coa_change",
  "tax_setting_change",
  "document_series_change",
]);

const QUEUE_ICONS: Record<string, IconName> = {
  slips: "receipt",
  unmatched_bank_lines: "building",
  unidentified_receipts: "help",
  payout_runs_awaiting_approval: "wallet",
  deliveries_without_gr: "package-check",
  bills_missing_tax_invoice: "document",
  wht_certificates_missing: "file-check",
  overdue_b2b_invoices: "clock",
  refunds_to_pay: "reset",
  close_tasks: "checklist",
};

/**
 * Where a queue's figure opens, when the API's own path is a report rather than the list of its rows: overdue B2B
 * invoices are the receivables list's "overdue" tab (the aging report shows amounts, not the invoices).
 */
const QUEUE_LIST: Readonly<Record<string, string>> = {
  "finance.overdue_b2b_invoices": "/finance/receivables?overdue=true",
};

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "over_90"] as const;

/**
 * The finance home (F6.1), calm: first what asks something of the desk now — the queues with work, each figure the
 * rows the link opens (the list's own `meta.total` where the queue is a list), late ones first; empty queues fold into
 * one line. Then where the books stand: the open periods, the cash per bank account and the receivables by age — every
 * figure the API's, nothing added up here. The finance approvals waiting on this person come last.
 */
export function FinanceHome() {
  const t = useTranslations("finance.home");
  const tDash = useTranslations("dashboard");
  const tQueues = useTranslations("dashboard.queues");
  const tCash = useTranslations("finance.banking.cash");
  const tAging = useTranslations("finance.receivables.aging");
  const tClose = useTranslations("finance.close.index");
  const format = useFormat();
  const sla = useSlaFormat();
  const canAct = useCan("approvals.act");
  const canBank = useCan("banking.read");
  const canAr = useCan("receivables.read");
  const canClose = useCan("close.read");
  const canLedger = useCan("ledger.read");
  const [showEmpty, setShowEmpty] = useState(false);
  const [now] = useState(() => Date.now());
  const queues = useQueues();
  const finance = (queues.data?.queues ?? []).filter((queue) => queue.key.startsWith("finance."));
  const hrefOf = (queue: (typeof finance)[number]) => QUEUE_LIST[queue.key] ?? browserPath(queue.path);

  // A queue that opens a list counts that list's rows (the same read as its tab), so "สลิปรอตรวจ 1" opens one row.
  const sources = finance.map((queue) => rowsSourceAt(hrefOf(queue)));
  const totals = useQueries({
    queries: sources.map((source, index) =>
      source
        ? listTotalQuery(source)
        : { queryKey: ["admin", "finance-count", finance[index]?.key], queryFn: () => null, enabled: false },
    ),
  });
  const counted = finance.map((queue, index) => {
    const rows = totals[index]?.data;
    const count = typeof rows === "number" ? rows : queue.count;
    return { ...queue, href: hrefOf(queue), count, overdueCount: Math.min(queue.overdueCount, count) };
  });
  const busy = counted
    .filter((queue) => queue.count > 0)
    .sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        (a.nextDueAt ? Date.parse(a.nextDueAt) : Number.POSITIVE_INFINITY) -
          (b.nextDueAt ? Date.parse(b.nextDueAt) : Number.POSITIVE_INFINITY),
    );
  const first = busy.slice(0, 4);
  const others = busy.slice(4);
  const empty = counted.filter((queue) => queue.count === 0);
  const label = (key: string) => (tQueues.has(key) ? tQueues(key) : key);
  const icon = (key: string) => QUEUE_ICONS[key.slice("finance.".length)] ?? "inbox";
  const soon = (queue: { nextDueAt: string | null }) =>
    queue.nextDueAt !== null && Date.parse(queue.nextDueAt) - now < 24 * 60 * 60 * 1000;

  const figures: SummaryItem[] = first.map((queue) => {
    const late = queue.overdueCount > 0;
    return {
      key: queue.key,
      label: label(queue.key),
      icon: icon(queue.key),
      value: format.number(queue.count),
      tone: late ? "danger" : soon(queue) ? "warning" : "neutral",
      hint: late ? (
        t("overdue", { count: queue.overdueCount })
      ) : queue.nextDueAt ? (
        <SlaTimer dueAt={queue.nextDueAt} format={sla} />
      ) : (
        t("noSla")
      ),
      href: queue.href,
    };
  });

  const today = bangkokToday();
  const years = useFiscalYears();
  // The month we are in and the two before it: the one being closed is usually last month.
  const periods = (years.data ?? [])
    .flatMap((year) => year.periods)
    .filter((period) => period.startDate <= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 3);

  const cash = useQuery({
    queryKey: queryKeys.list("admin", "cash-position", { asOf: today }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/cash-position", { params: { query: { asOf: today } } })).data!,
    enabled: canBank,
  });
  const aging = useQuery({
    queryKey: queryKeys.list("admin", "receivables-aging", { asOf: today }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/receivables/aging", { params: { query: { asOf: today } } }))
        .data!,
    enabled: canAr,
  });

  const inbox = useQuery({
    queryKey: queryKeys.list("admin", "approval", { inbox: true }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approvals/inbox")).data!,
    enabled: canAct,
    staleTime: STALE_TIME.live,
    select: (items) => items.filter((item) => FINANCE_POLICIES.has(item.policy)),
  });

  const showPeriods = (canClose || canLedger) && !years.isError;
  const showCash = canBank && !cash.isError && (cash.isPending || (cash.data?.banks.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-8">
      <DeskSection id="finance-now" title={t("nowTitle")}>
        {queues.isError && !queues.data ? (
          <QueryError error={queues.error} onRetry={() => void queues.refetch()} />
        ) : !queues.data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : finance.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={t("noQueuesTitle")}
            description={t("noQueuesBody")}
            action={
              <Button asChild variant="secondary">
                <Link href="/finance/reports">{t("openReports")}</Link>
              </Button>
            }
          />
        ) : first.length === 0 ? (
          <EmptyState
            icon="success"
            title={tDash("allClearTitle")}
            description={tDash("allClearBody")}
            action={
              <Button asChild variant="secondary">
                <Link href="/finance/payments">{t("openPayments")}</Link>
              </Button>
            }
          />
        ) : (
          <StatsRow
            label={t("nowTitle")}
            items={figures}
            columns={figures.length === 3 ? 3 : figures.length < 3 ? 2 : 4}
          />
        )}
        {queues.data && (others.length > 0 || empty.length > 0) ? (
          <div className="flex flex-col gap-2">
            {others.length > 0 || showEmpty ? (
              <RowList label={tDash("otherQueues")}>
                {[...others, ...(showEmpty ? empty : [])].map((queue) => (
                  <Row
                    key={queue.key}
                    href={queue.href}
                    icon={icon(queue.key)}
                    tone={queue.overdueCount > 0 ? "danger" : "neutral"}
                    title={label(queue.key)}
                    meta={queue.overdueCount > 0 ? t("overdue", { count: queue.overdueCount }) : undefined}
                    aside={
                      <span className={cn("font-semibold", queue.count === 0 && "text-muted font-normal")}>
                        {format.number(queue.count)}
                      </span>
                    }
                  />
                ))}
              </RowList>
            ) : null}
            {empty.length > 0 ? (
              <p className="text-muted text-sm">
                {showEmpty
                  ? tDash("emptyShown", { count: empty.length })
                  : tDash("emptyHidden", { count: empty.length })}{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setShowEmpty((shown) => !shown)}
                  aria-expanded={showEmpty}
                >
                  {showEmpty ? tDash("hide") : tDash("show")}
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
      </DeskSection>

      {showPeriods || showCash ? (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {showPeriods ? (
            <DeskSection
              id="finance-periods"
              title={t("periodsTitle")}
              actions={
                <Button variant="link" size="sm" asChild>
                  <Link href="/finance/close">{t("allPeriods")}</Link>
                </Button>
              }
            >
              {!years.data ? (
                <Skeleton className="h-36" />
              ) : (
                <RowList label={t("periodsTitle")}>
                  {periods.map((period) => (
                    <Row
                      key={period.id}
                      href={`/finance/close/${period.startDate.slice(0, 7)}`}
                      icon="calendar"
                      title={
                        <>
                          <span>{format.date(period.startDate, { style: "month" })}</span>
                          <StatusChip map={PERIOD_STATUS} value={period.status} />
                        </>
                      }
                      meta={
                        period.statusChangedAt
                          ? `${tClose("changedAt")} ${format.date(period.statusChangedAt)}`
                          : undefined
                      }
                    />
                  ))}
                </RowList>
              )}
            </DeskSection>
          ) : null}

          {showCash ? (
            <DeskSection
              id="finance-cash"
              title={tCash("banks")}
              description={cash.data ? `${tCash("asOf")} ${format.date(cash.data.asOf)}` : undefined}
              actions={
                <Button variant="link" size="sm" asChild>
                  <Link href="/finance/banking">{t("openCash")}</Link>
                </Button>
              }
            >
              {!cash.data ? (
                <Skeleton className="h-36" />
              ) : (
                <RowList label={tCash("banks")}>
                  {cash.data.banks.map((bank) => (
                    <Row
                      key={bank.companyBankAccountId}
                      href={`/finance/banking/lines?companyBankAccountId=${bank.companyBankAccountId}`}
                      icon="building"
                      tone={bank.unmatchedLines > 0 ? "warning" : "neutral"}
                      title={<AccountNo last4={bank.accountNoLast4} gl={bank.glAccountCode} />}
                      meta={
                        bank.unmatchedLines > 0
                          ? `${tCash("unmatched")} ${format.number(bank.unmatchedLines)}`
                          : bank.statementBalance
                            ? `${tCash("statementBalance")} ${format.thb(bank.statementBalance)}`
                            : undefined
                      }
                      aside={<span className="font-semibold">{format.thb(bank.glBalance)}</span>}
                    />
                  ))}
                </RowList>
              )}
            </DeskSection>
          ) : null}
        </div>
      ) : null}

      {canAr && aging.data ? (
        <DeskSection
          id="finance-aging"
          title={tAging("title")}
          description={`${tAging("asOf")} ${format.date(aging.data.asOf)}`}
          actions={
            <Button variant="link" size="sm" asChild>
              <Link href="/finance/receivables/aging">{t("openAging")}</Link>
            </Button>
          }
        >
          <StatStrip
            label={tAging("title")}
            items={AGING_BUCKETS.map((bucket) => ({
              key: bucket,
              label: tAging(`buckets.${bucket}`),
              value: format.thb(aging.data.totals[bucket]),
              tone: bucket !== "current" && Number(aging.data.totals[bucket]) > 0 ? "warning" : "neutral",
            }))}
          />
        </DeskSection>
      ) : null}

      {canAct ? (
        <DeskSection
          id="finance-approvals"
          title={t("approvalsTitle")}
          description={t("approvalsNote")}
          actions={
            <Button variant="link" size="sm" asChild>
              <Link href="/approvals">{t("allApprovals")}</Link>
            </Button>
          }
        >
          {inbox.isError ? (
            <QueryError error={inbox.error} onRetry={() => void inbox.refetch()} />
          ) : inbox.data && inbox.data.length === 0 ? (
            <p className="border-border bg-surface text-muted rounded-xl border px-4 py-3 text-sm">
              {t("noApprovals")}
            </p>
          ) : !inbox.data ? (
            <Skeleton className="h-24" />
          ) : (
            <RowList label={t("approvalsTitle")}>
              {inbox.data.map((item) => (
                <Row
                  key={item.id}
                  href={`/approvals/${item.id}`}
                  title={t(`policies.${item.policy}`)}
                  meta={t("requestedBy", { name: item.requester.displayName })}
                  aside={item.amount ? <span className="font-semibold">{format.thb(item.amount)}</span> : undefined}
                />
              ))}
            </RowList>
          )}
        </DeskSection>
      ) : null}
    </div>
  );
}
