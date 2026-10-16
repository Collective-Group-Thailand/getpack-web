"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { useNotifications } from "@/features/shared/shell/notifications";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
  const [showEmpty, setShowEmpty] = useState(false);
  // Read once: "due within a day" is a colour, not a countdown (SlaTimer ticks on its own).
  const [now] = useState(() => Date.now());
  const notifications = useNotifications("admin");

  // UX audit, dashboard: what to do today first — the queues with work, most urgent first (late
  // ones, then the soonest SLA) — as up to four large cards; every other queue with work as one
  // compact row; empty queues folded away.
  const busy = [...(data?.queues ?? [])]
    .filter((queue) => queue.count > 0)
    .sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        (a.nextDueAt ? Date.parse(a.nextDueAt) : Number.POSITIVE_INFINITY) -
          (b.nextDueAt ? Date.parse(b.nextDueAt) : Number.POSITIVE_INFINITY),
    );
  const today = busy.slice(0, 4);
  const others = busy.slice(4);
  const empty = (data?.queues ?? []).filter((queue) => queue.count === 0);
  const totalToday = busy.reduce((sum, queue) => sum + queue.count, 0);
  const totalOverdue = busy.reduce((sum, queue) => sum + queue.overdueCount, 0);
  const soon = (queue: { nextDueAt: string | null }) =>
    queue.nextDueAt !== null && Date.parse(queue.nextDueAt) - now < 24 * 60 * 60 * 1000;
  const tagged = (notifications.data?.items ?? []).filter((item) => /mention|tag/i.test(item.eventType));
  const feed = (tagged.length > 0 ? tagged : (notifications.data?.items ?? [])).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("hello", { name: actor.displayName })}</h1>
        <p className="text-muted mt-1.5 text-sm">
          {format.date(new Date(now).toISOString(), { style: "long" })}
          {data ? (
            <>
              {" · "}
              {t.rich("todaySummary", {
                count: totalToday,
                overdue: totalOverdue,
                strong: (chunks) => <strong className="text-fg font-semibold">{chunks}</strong>,
                danger: (chunks) => <strong className="text-danger-subtle-fg font-semibold">{chunks}</strong>,
              })}
            </>
          ) : null}
        </p>
      </header>

      <section aria-labelledby="dashboard-queues" className="flex flex-col gap-3">
        <h2 id="dashboard-queues" className="text-muted text-sm font-medium">
          {t("todayTitle")}
        </h2>
        {queues.isError && !data ? (
          <QueryError error={queues.error} onRetry={() => void queues.refetch()} />
        ) : !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36" />
            ))}
          </div>
        ) : data.queues.length === 0 ? (
          <EmptyState icon="inbox" title={t("noQueuesTitle")} description={t("noQueuesBody")} />
        ) : today.length === 0 ? (
          <EmptyState icon="success" title={t("allClearTitle")} description={t("allClearBody")} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {today.map((queue) => {
              const late = queue.overdueCount > 0;
              return (
                <li key={queue.key}>
                  <Link
                    href={browserPath(queue.path)}
                    className={cn(
                      "group border-border bg-surface rounded-card focus-visible:ring-focus-ring hover:shadow-lift flex h-full flex-col gap-2 border border-s-4 p-5 transition-shadow outline-none focus-visible:ring-2",
                      late ? "border-s-danger" : soon(queue) ? "border-s-warning" : "border-s-primary",
                    )}
                  >
                    <span className="text-muted flex items-center gap-2 text-sm">
                      <Icon name={QUEUE_ICONS[queue.key.split(".")[0] ?? ""] ?? "inbox"} size={16} aria-hidden="true" />
                      {label(queue.key)}
                    </span>
                    <span className="text-4xl font-bold tabular-nums">{format.number(queue.count)}</span>
                    <span
                      className={cn(
                        "text-sm",
                        late
                          ? "text-danger-subtle-fg font-medium"
                          : soon(queue)
                            ? "text-warning-subtle-fg"
                            : "text-muted",
                      )}
                    >
                      {late ? (
                        t("overdue", { count: queue.overdueCount })
                      ) : queue.nextDueAt ? (
                        <SlaTimer dueAt={queue.nextDueAt} format={sla} />
                      ) : (
                        t("nothingDue")
                      )}
                    </span>
                    <span className="mt-auto pt-1 text-sm font-semibold group-hover:underline">
                      {t("openQueue")} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {data && (others.length > 0 || empty.length > 0) ? (
          <section aria-labelledby="dashboard-other" className="border-border bg-surface rounded-card border">
            <h2 id="dashboard-other" className="border-border border-b px-5 py-3.5 font-semibold">
              {t("otherQueues")}
            </h2>
            <ul className="divide-border divide-y">
              {[...others, ...(showEmpty ? empty : [])].map((queue) => (
                <li key={queue.key}>
                  <Link
                    href={browserPath(queue.path)}
                    className="hover:bg-surface-subtle flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    {label(queue.key)}
                    <span
                      className={cn(
                        "tabular-nums",
                        queue.overdueCount > 0
                          ? "text-danger-subtle-fg font-semibold"
                          : queue.count === 0 && "text-muted",
                      )}
                    >
                      {format.number(queue.count)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {empty.length > 0 ? (
              <p className="border-border text-muted border-t px-5 py-3 text-xs">
                {showEmpty ? t("emptyShown", { count: empty.length }) : t("emptyHidden", { count: empty.length })}{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setShowEmpty((shown) => !shown)}
                  aria-expanded={showEmpty}
                >
                  {showEmpty ? t("hide") : t("show")}
                </button>
              </p>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="dashboard-tagged" className="border-border bg-surface rounded-card border">
          <h2 id="dashboard-tagged" className="border-border border-b px-5 py-3.5 font-semibold">
            {tagged.length > 0 ? t("taggedTitle") : t("latestTitle")}
          </h2>
          {feed.length === 0 ? (
            <p className="text-muted px-5 py-4 text-sm">{t("taggedNone")}</p>
          ) : (
            <ul className="divide-border divide-y">
              {feed.map((item) => (
                <li key={item.id} className="px-5 py-3 text-sm">
                  {item.url ? (
                    <Link href={browserPath(item.url)} className="font-medium hover:underline">
                      {item.title ?? item.body}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.title ?? item.body}</span>
                  )}
                  {item.title ? <p className="text-muted mt-0.5 line-clamp-2">{item.body}</p> : null}
                  <p className="text-muted mt-1 text-xs">{format.relative(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
