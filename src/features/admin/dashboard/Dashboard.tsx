"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { useNotifications } from "@/features/shared/shell/notifications";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { DeskSection, StatsRow, type SummaryItem } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { Row, RowList } from "@/ui/components/RowList";
import { Skeleton } from "@/ui/components/Skeleton";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

// By path, not through the console barrel: the barrel holds the form engine (zod,
// react-hook-form) that the landing page does not need.
import { useActor, useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";
import { listTotalQuery, useQueues } from "../console/queues";
import { useSlaFormat } from "../console/useSlaFormat";
import { rowsSourceAt } from "../shell/badges";
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

/** "(D-074)", "(D-221, D-300)", "(D-061: 4 business hours)": decision references are for the team, not the desk. */
const DECISION_REF = /\s*\(D-\d{3}[^)]*\)/g;

/** Today in Bangkok, `YYYY-MM-DD`. */
const bangkokToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * The back-office home (F2 A.2.8): a calm operations page. First what needs me now — the queues with work, the most
 * urgent four as figures and the rest as rows, each count read from the list it opens so the number and the rows
 * agree — then today's figures from the API, then what waits for my approval and the latest updates to me.
 *
 * Which queues appear is the API's decision (`admin.dashboard.get`), not a role check here; a key
 * the UI has no label for still shows, as itself.
 */
export function Dashboard({ initial }: { initial: Dashboard | null }) {
  const t = useTranslations("dashboard");
  const tOps = useTranslations("platform.ops");
  const tAnalytics = useTranslations("analytics");
  const locale = useLocale();
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const canAct = useCan("approvals.act");
  const canSales = useCan("analytics.read");
  const queues = useQueues();
  const data = queues.data ?? initial ?? undefined;

  const inbox = useQuery({
    queryKey: queryKeys.list("admin", "approval", { inbox: true }),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/approvals/inbox")).data!,
    enabled: canAct,
    staleTime: STALE_TIME.live,
  });
  const [day] = useState(bangkokToday);
  const sales = useQuery({
    queryKey: queryKeys.list("admin", "analytics", { part: "sales-today", from: day, to: day }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/analytics/sales", {
          params: { query: { from: day, to: day, interval: "day" } },
        })
      ).data!,
    enabled: canSales,
    staleTime: STALE_TIME.live,
  });

  const label = (key: string) => (t.has(`queues.${key}`) ? t(`queues.${key}`) : key);
  const [showEmpty, setShowEmpty] = useState(false);
  // Read once: "due within a day" is a colour, not a countdown (SlaTimer ticks on its own).
  const [now] = useState(() => Date.now());
  const notifications = useNotifications("admin");

  // A queue that opens one of the work lists counts that list's rows (the same read as its tab), so "รอชำระ 4"
  // opens four rows; any other queue keeps the dashboard's count.
  const all = data?.queues ?? [];
  const sources = all.map((queue) => rowsSourceAt(browserPath(queue.path)));
  const totals = useQueries({
    queries: sources.map((source, index) =>
      source
        ? listTotalQuery(source)
        : { queryKey: ["admin", "dashboard-count", all[index]?.key], queryFn: () => null, enabled: false },
    ),
  });
  const counted = all.map((queue, index) => {
    const rows = totals[index]?.data;
    const count = typeof rows === "number" ? rows : queue.count;
    return { ...queue, count, overdueCount: Math.min(queue.overdueCount, count) };
  });

  // What to do today first — the queues with work, most urgent first (late ones, then the soonest SLA): four as
  // figures, every other queue with work as one row, empty queues folded away.
  const busy = counted
    .filter((queue) => queue.count > 0)
    .sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        (a.nextDueAt ? Date.parse(a.nextDueAt) : Number.POSITIVE_INFINITY) -
          (b.nextDueAt ? Date.parse(b.nextDueAt) : Number.POSITIVE_INFINITY),
    );
  const today = busy.slice(0, 4);
  const others = busy.slice(4);
  const empty = counted.filter((queue) => queue.count === 0);
  const totalToday = busy.reduce((sum, queue) => sum + queue.count, 0);
  const totalOverdue = busy.reduce((sum, queue) => sum + queue.overdueCount, 0);
  const soon = (queue: { nextDueAt: string | null }) =>
    queue.nextDueAt !== null && Date.parse(queue.nextDueAt) - now < 24 * 60 * 60 * 1000;
  const tagged = (notifications.data?.items ?? []).filter((item) => /mention|tag/i.test(item.eventType));
  const feed = (tagged.length > 0 ? tagged : (notifications.data?.items ?? [])).slice(0, 5);

  const figures: SummaryItem[] = today.map((queue) => {
    const late = queue.overdueCount > 0;
    return {
      key: queue.key,
      label: label(queue.key),
      icon: QUEUE_ICONS[queue.key.split(".")[0] ?? ""] ?? "inbox",
      value: format.number(queue.count),
      tone: late ? "danger" : soon(queue) ? "warning" : "neutral",
      hint: late ? (
        t("overdue", { count: queue.overdueCount })
      ) : queue.nextDueAt ? (
        <SlaTimer dueAt={queue.nextDueAt} format={sla} />
      ) : (
        t("nothingDue")
      ),
      href: browserPath(queue.path),
    };
  });

  // A system alert names its signal by key ("แจ้งเตือนระบบ: acceptance_overdue") with an English body: the desk reads
  // the signal's Thai name and opens /ops for the figures.
  const describe = (item: (typeof feed)[number]) => {
    const signal = item.title?.match(/:\s*([a-z][a-z0-9_]+)\s*$/)?.[1];
    if (signal && tOps.has(`signals.${signal}`)) {
      const kind = locale === "en" ? item.eventTypeLabelEn : item.eventTypeLabelTh;
      return { title: `${kind}: ${tOps(`signals.${signal}`)}`, body: null, href: item.url ?? "/ops" };
    }
    const body = item.body.replace(DECISION_REF, "");
    return { title: item.title ?? body, body: item.title ? body : null, href: item.url };
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("hello", { name: actor.displayName })}
        description={
          <>
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
          </>
        }
      />

      <DeskSection id="dashboard-queues" title={t("todayTitle")}>
        {queues.isError && !data ? (
          <QueryError error={queues.error} onRetry={() => void queues.refetch()} />
        ) : !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : data.queues.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={t("noQueuesTitle")}
            description={t("noQueuesBody")}
            action={
              <Button asChild variant="secondary">
                <Link href="/approvals">{t("allApprovals")}</Link>
              </Button>
            }
          />
        ) : today.length === 0 ? (
          <EmptyState
            icon="success"
            title={t("allClearTitle")}
            description={t("allClearBody")}
            action={
              <Button asChild variant="secondary">
                <Link href="/orders">{t("openQueue")}</Link>
              </Button>
            }
          />
        ) : (
          <StatsRow label={t("todayTitle")} items={figures} columns={figures.length === 3 ? 3 : 4} />
        )}
        {data && (others.length > 0 || empty.length > 0) ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-muted text-sm font-medium">{t("otherQueues")}</h3>
            {others.length > 0 || showEmpty ? (
              <RowList label={t("otherQueues")}>
                {[...others, ...(showEmpty ? empty : [])].map((queue) => (
                  <Row
                    key={queue.key}
                    href={browserPath(queue.path)}
                    icon={QUEUE_ICONS[queue.key.split(".")[0] ?? ""] ?? "inbox"}
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
          </div>
        ) : null}
      </DeskSection>

      {canSales && sales.data ? (
        <DeskSection
          id="dashboard-figures"
          title={t("figuresTitle")}
          actions={
            <Button variant="link" size="sm" asChild>
              <Link href="/analytics">{t("figuresLink")}</Link>
            </Button>
          }
        >
          <StatsRow
            label={t("figuresTitle")}
            columns={3}
            items={[
              { key: "gmv", label: tAnalytics("kpis.gmv"), value: format.thb(sales.data.totals.gmv) },
              {
                key: "placed",
                label: tAnalytics("trend.groupsPlaced"),
                value: format.number(sales.data.totals.groupsPlaced),
              },
              { key: "paid", label: tAnalytics("kpis.groupsPaid"), value: format.number(sales.data.totals.groupsPaid) },
            ]}
          />
        </DeskSection>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-2">
        {canAct ? (
          <DeskSection
            id="dashboard-approvals"
            title={t("approvalsTitle")}
            actions={
              <Button variant="link" size="sm" asChild>
                <Link href="/approvals">{t("allApprovals")}</Link>
              </Button>
            }
          >
            {inbox.data && inbox.data.length === 0 ? (
              <p className="border-border bg-surface text-muted rounded-xl border px-4 py-3 text-sm">
                {t("noApprovals")}
              </p>
            ) : (
              <RowList label={t("approvalsTitle")}>
                {(inbox.data ?? []).slice(0, 5).map((item) => (
                  <Row
                    key={item.id}
                    href={`/approvals/${item.id}`}
                    title={t.has(`policies.${item.policy}`) ? t(`policies.${item.policy}`) : item.policy}
                    meta={item.requester.displayName}
                    aside={item.amount ? format.thb(item.amount) : undefined}
                  />
                ))}
              </RowList>
            )}
          </DeskSection>
        ) : null}

        <DeskSection id="dashboard-tagged" title={tagged.length > 0 ? t("taggedTitle") : t("latestTitle")}>
          {feed.length === 0 ? (
            <p className="border-border bg-surface text-muted rounded-xl border px-4 py-3 text-sm">{t("taggedNone")}</p>
          ) : (
            <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
              {feed.map((item) => {
                const shown = describe(item);
                return (
                  <li key={item.id} className="px-4 py-3 text-sm">
                    {shown.href ? (
                      <Link href={browserPath(shown.href)} className="font-medium hover:underline">
                        {shown.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{shown.title}</span>
                    )}
                    {shown.body ? <p className="text-muted mt-0.5 line-clamp-2">{shown.body}</p> : null}
                    <p className="text-muted mt-1 text-xs">{format.relative(item.createdAt)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </DeskSection>
      </div>
    </div>
  );
}
