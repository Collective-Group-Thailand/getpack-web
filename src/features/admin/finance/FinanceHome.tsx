"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Stat } from "@/ui/components/Stat";
import type { IconName } from "@/ui/icons";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";
import { useQueues } from "../console/queues";
import { useSlaFormat } from "../console/useSlaFormat";
import { browserPath } from "../shell/menu";

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
 * The finance home (F6.1): every queue of the desks this person works, with its count, what is
 * past its SLA and what is due next — slips first (4 business hours, D-061). Which queues appear
 * is the API's decision (`admin.dashboard`, keys `finance.*`); the business-hour maths is too.
 * Below them, the finance approvals waiting on this person.
 */
export function FinanceHome() {
  const t = useTranslations("finance.home");
  const tQueues = useTranslations("dashboard.queues");
  const format = useFormat();
  const sla = useSlaFormat();
  const canAct = useCan("approvals.act");
  const queues = useQueues();
  const finance = (queues.data?.queues ?? []).filter((queue) => queue.key.startsWith("finance."));

  const inbox = useQuery({
    queryKey: queryKeys.list("admin", "approval", { inbox: true }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approvals/inbox")).data!,
    enabled: canAct,
    staleTime: STALE_TIME.live,
    select: (items) => items.filter((item) => FINANCE_POLICIES.has(item.policy)),
  });
  const label = (key: string) => (tQueues.has(key) ? tQueues(key) : key);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="finance-queues" className="flex flex-col gap-3">
        <h2 id="finance-queues" className="text-base font-semibold">
          {t("queuesTitle")}
        </h2>
        {queues.isError && !queues.data ? (
          <QueryError error={queues.error} onRetry={() => void queues.refetch()} />
        ) : !queues.data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : finance.length === 0 ? (
          <EmptyState icon="inbox" title={t("noQueuesTitle")} description={t("noQueuesBody")} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {finance.map((queue) => (
              <li key={queue.key}>
                <Stat
                  as={Link}
                  href={browserPath(queue.path)}
                  label={label(queue.key)}
                  value={format.number(queue.count)}
                  icon={QUEUE_ICONS[queue.key.slice("finance.".length)] ?? "inbox"}
                  tone={queue.overdueCount > 0 ? "danger" : queue.count > 0 ? "warning" : "neutral"}
                  hint={
                    queue.overdueCount > 0 ? (
                      t("overdue", { count: queue.overdueCount })
                    ) : queue.nextDueAt ? (
                      <SlaTimer dueAt={queue.nextDueAt} format={sla} />
                    ) : queue.count === 0 ? (
                      t("clear")
                    ) : (
                      t("noSla")
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canAct ? (
        <section aria-labelledby="finance-approvals" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="finance-approvals" className="text-base font-semibold">
              {t("approvalsTitle")}
            </h2>
            <Link href="/approvals" className="text-primary text-sm hover:underline">
              {t("allApprovals")}
            </Link>
          </div>
          <p className="text-muted -mt-2 text-sm">{t("approvalsNote")}</p>
          {inbox.isError ? (
            <QueryError error={inbox.error} onRetry={() => void inbox.refetch()} />
          ) : inbox.data && inbox.data.length === 0 ? (
            <p className="text-muted text-sm">{t("noApprovals")}</p>
          ) : (
            <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
              {(inbox.data ?? []).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/approvals/${item.id}`}
                    className="hover:bg-surface-subtle flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{t(`policies.${item.policy}`)}</span>
                    <span className="text-muted">{t("requestedBy", { name: item.requester.displayName })}</span>
                    <span className="ms-auto tabular-nums">{item.amount ? format.thb(item.amount) : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
