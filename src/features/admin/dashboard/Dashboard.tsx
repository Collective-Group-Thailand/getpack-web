"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Stat } from "@/ui/components/Stat";
import type { IconName } from "@/ui/icons";

// By path, not through the console barrel: the barrel holds the form engine (zod,
// react-hook-form) that the landing page does not need.
import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";
import { useQueues } from "../console/queues";
import { useSlaFormat } from "../console/useSlaFormat";
import { browserPath } from "../shell/menu";

type Dashboard = Schemas["AdminDashboardDto"];

/** Icons by queue prefix; the queue itself is whatever the API says this person may work. */
const QUEUE_ICONS: Record<string, IconName> = {
  approvals: "stamp",
  orders: "package",
  payments: "receipt",
  rfq: "chat",
  rfqs: "chat",
  prepress: "image",
  production: "factory",
  shipments: "truck",
  claims: "flag",
  partners: "handshake",
  referrals: "gift",
  companies: "building",
  finance: "wallet",
};

/**
 * The back-office home (F2 A.2.8): work queues first — the actionable queues this person may
 * work, with counts and SLA state, then what is waiting for their approval.
 *
 * Which queues appear is the API's decision (`admin.dashboard.get`), not a role check here; a key
 * the UI has no label for still shows, as itself.
 */
export function Dashboard({ initial }: { initial: Dashboard | null }) {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const canAct = useCan("approvals.act");
  const queues = useQueues();
  const data = queues.data ?? initial ?? undefined;

  const inbox = useQuery({
    queryKey: queryKeys.list("admin", "approval", { inbox: true }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approvals/inbox")).data!,
    enabled: canAct,
    staleTime: STALE_TIME.live,
  });

  const label = (key: string) => (t.has(`queues.${key}`) ? t(`queues.${key}`) : key);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted mt-1 text-sm">{t("greeting", { name: actor.displayName })}</p>
      </header>

      <section aria-labelledby="dashboard-queues" className="flex flex-col gap-3">
        <h2 id="dashboard-queues" className="text-base font-semibold">
          {t("queuesTitle")}
        </h2>
        {queues.isError && !data ? (
          <QueryError error={queues.error} onRetry={() => void queues.refetch()} />
        ) : !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : data.queues.length === 0 ? (
          <EmptyState icon="inbox" title={t("noQueuesTitle")} description={t("noQueuesBody")} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.queues.map((queue) => (
              <li key={queue.key}>
                <Stat
                  as={Link}
                  href={browserPath(queue.path)}
                  label={label(queue.key)}
                  value={format.number(queue.count)}
                  icon={QUEUE_ICONS[queue.key.split(".")[0] ?? ""] ?? "inbox"}
                  tone={queue.overdueCount > 0 ? "danger" : queue.count > 0 ? "warning" : "neutral"}
                  hint={
                    queue.overdueCount > 0 ? (
                      t("overdue", { count: queue.overdueCount })
                    ) : queue.nextDueAt ? (
                      <SlaTimer dueAt={queue.nextDueAt} format={sla} />
                    ) : (
                      t("nothingDue")
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canAct ? (
        <section aria-labelledby="dashboard-approvals" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="dashboard-approvals" className="text-base font-semibold">
              {t("approvalsTitle")}
            </h2>
            <Button variant="link" size="sm" asChild>
              <Link href="/approvals">{t("allApprovals")}</Link>
            </Button>
          </div>
          {inbox.data && inbox.data.length === 0 ? (
            <p className="text-muted text-sm">{t("noApprovals")}</p>
          ) : (
            <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
              {(inbox.data ?? []).slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/approvals/${item.id}`}
                    className="hover:bg-surface-subtle flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {t.has(`policies.${item.policy}`) ? t(`policies.${item.policy}`) : item.policy}
                    </span>
                    <span className="text-muted">{item.requester.displayName}</span>
                    {item.amount ? (
                      <span className="ms-auto tabular-nums">{format.thb(item.amount)}</span>
                    ) : (
                      <span className="ms-auto" />
                    )}
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
