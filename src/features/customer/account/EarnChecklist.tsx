"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { queryKeys } from "@/lib/api/query-keys";
import { browserApi } from "@/lib/api/browser";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { checklistView, newlyDone, taskLink } from "./earn-tasks";
import type { LoyaltyTask, LoyaltyTasks } from "./loyalty-types";

/** Under the `loyalty` resource, so a realtime `loyalty.points_awarded` invalidates it (`src/lib/realtime/events.ts`). */
export const LOYALTY_TASKS_KEY = queryKeys.list("customer", "loyalty", { view: "tasks" });

/** How many rows the compact (LINE) variant shows before "ดูทั้งหมด". */
const COMPACT_ROWS = 5;

/** Codes already announced in this page's life, so a refetch and a realtime event never toast twice. */
const announced = new Set<string>();

export type EarnChecklistVariant = "full" | "compact";

/**
 * "ทำสิ่งนี้รับแต้ม" (loyalty P1, PLAN §3): the earn checklist on `/account/points` and, compact, `/liff/points`.
 * Reads `store.loyalty.tasks` (server-rendered first, then refetched on focus and when realtime invalidates the
 * `loyalty` resource) and toasts "+40 แต้ม — <task>" when a task turns done. The order is the API's.
 */
export function EarnChecklist({
  initial,
  variant = "full",
  lineOaId,
  className,
}: {
  initial?: LoyaltyTasks;
  variant?: EarnChecklistVariant;
  lineOaId?: string | null;
  className?: string;
}) {
  const t = useTranslations("account.points");
  const format = useFormat();
  const query = useQuery<LoyaltyTasks>({
    queryKey: LOYALTY_TASKS_KEY,
    // P2 task codes are wider than the published enum (CONTRACT-REQUEST store.loyalty.p2-fields).
    queryFn: async () => (await browserApi().GET("/v1/store/loyalty/tasks")).data! as LoyaltyTasks,
    initialData: initial,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const previous = useRef<LoyaltyTasks | undefined>(query.data);
  useEffect(() => {
    if (!query.data) return;
    for (const task of newlyDone(previous.current, query.data)) {
      if (announced.has(task.code)) continue;
      announced.add(task.code);
      toast(t("earn.awarded", { points: format.number(task.points), task: t(`tasks.${task.code}.title`) }));
    }
    previous.current = query.data;
  }, [query.data, t, format]);

  return (
    <EarnChecklistView
      data={query.data}
      state={query.data ? "ready" : query.isError ? "error" : "loading"}
      onRetry={() => void query.refetch()}
      variant={variant}
      lineOaId={lineOaId}
      className={className}
    />
  );
}

/** The card itself, from data already read — Storybook and the tests render this. */
export function EarnChecklistView({
  data,
  state = "ready",
  onRetry,
  variant = "full",
  lineOaId,
  className,
}: {
  data?: LoyaltyTasks;
  state?: "loading" | "error" | "ready";
  onRetry?: () => void;
  variant?: EarnChecklistVariant;
  lineOaId?: string | null;
  className?: string;
}) {
  const t = useTranslations("account.points.earn");
  const format = useFormat();
  const compact = variant === "compact";
  const pad = compact ? "px-4" : "px-4 sm:px-5.5";

  const frame = (children: React.ReactNode, busy = false) => (
    <section
      id={compact ? undefined : "earn"}
      aria-labelledby="earn-title"
      aria-busy={busy || undefined}
      className={cn("border-border bg-surface rounded-panel scroll-mt-24 overflow-hidden border", className)}
    >
      {children}
    </section>
  );
  const title = (
    <h2 id="earn-title" className={cn("font-semibold", compact ? "text-base" : "text-[1.0625rem]")}>
      {t("title")}
    </h2>
  );

  if (state === "loading" || (state === "ready" && !data)) {
    return frame(
      <div className={cn(pad, "py-4")}>
        {title}
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="mt-4" lines={4} />
      </div>,
      true,
    );
  }
  if (state === "error" || !data) {
    return frame(
      <div className={cn(pad, "flex flex-wrap items-center justify-between gap-3 py-4")}>
        <div>
          {title}
          <p className="text-muted text-sm" role="status">
            {t("failed")}
          </p>
        </div>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null}
      </div>,
    );
  }

  const view = checklistView(data);
  if (view.total === 0) return null;
  if (view.allDone) {
    return frame(
      <div className={cn(pad, "flex items-center gap-3 py-4")}>
        <span className="bg-success-subtle text-success grid size-7 shrink-0 place-items-center rounded-full">
          <Icon name="check" size={16} aria-hidden="true" />
        </span>
        <div>
          <h2 id="earn-title" className="font-semibold">
            {t("allDone")}
          </h2>
          <p className="text-muted text-[0.8125rem]">
            {t("allDoneBody", { points: format.number(data.earnedPoints) })}
          </p>
        </div>
      </div>,
    );
  }

  const shown = compact ? view.rows.slice(0, COMPACT_ROWS) : view.rows;
  const percent = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const summary = view.capReached
    ? t("summaryCapped", { done: view.done, total: view.total })
    : compact
      ? t("summaryCompact", { points: format.number(data.remainingPoints) })
      : t("summary", { points: format.number(data.remainingPoints), done: view.done, total: view.total });

  return frame(
    <>
      <div className={cn(pad, compact ? "pt-3.5 pb-3" : "pt-4 pb-3.5 sm:pt-4.5 sm:pb-4")}>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-3">
          {title}
          <p className="text-muted text-[0.8125rem] tabular-nums sm:text-[0.84375rem]">{summary}</p>
        </div>
        <div
          role="progressbar"
          aria-label={t("progress", { done: view.done, total: view.total })}
          aria-valuemin={0}
          aria-valuemax={view.total}
          aria-valuenow={view.done}
          className="bg-bg-subtle rounded-control mt-3 h-1 overflow-hidden"
        >
          <div
            className="bg-primary rounded-control h-full motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {view.recommended ? <NextTask task={view.recommended} compact={compact} lineOaId={lineOaId} /> : null}

      <ul className={cn("divide-border divide-y", view.recommended && "mt-1.5")}>
        {shown.map((task) => (
          <li key={task.code}>
            <TaskRow task={task} compact={compact} capReached={view.capReached} lineOaId={lineOaId} />
          </li>
        ))}
      </ul>

      {compact && view.rows.length > shown.length ? (
        <Link
          href="/account/points#earn"
          className="border-border text-primary focus-visible:ring-focus-ring flex min-h-11 items-center justify-center border-t text-[0.84375rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          {t("seeAll", { count: view.total })}
        </Link>
      ) : null}

      <p className={cn("border-border text-muted border-t pt-2.5 pb-3 text-xs tabular-nums", pad)}>
        {view.capReached
          ? t("capReached", { cap: format.number(data.capPoints) })
          : t("cap", { cap: format.number(data.capPoints), left: format.number(data.capRemainingPoints) })}
      </p>
    </>,
  );
}

/** "แนะนำถัดไป": the recommended task with the card's one primary button. */
function NextTask({ task, compact, lineOaId }: { task: LoyaltyTask; compact: boolean; lineOaId?: string | null }) {
  const t = useTranslations("account.points");
  const format = useFormat();
  const link = taskLink(task.code, lineOaId);
  const action = t(`tasks.${task.code}.action`);
  return (
    <div
      className={cn(
        "bg-primary-subtle rounded-card grid gap-x-6 gap-y-0.5",
        compact
          ? "mx-4 p-3.5"
          : "mx-4 px-4 py-3.5 sm:mx-5.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4.5 sm:py-4",
      )}
    >
      <p className="text-primary-subtle-fg text-[0.8125rem] font-semibold">{t("earn.next")}</p>
      <p className="font-semibold sm:text-base">{t(`tasks.${task.code}.title`)}</p>
      <p className="text-muted text-[0.84375rem]">{t(`tasks.${task.code}.description`)}</p>
      <div
        className={cn(
          "mt-2.5 flex items-center justify-between gap-4",
          !compact && "sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:mt-0 sm:justify-end",
        )}
      >
        <span className="text-primary-subtle-fg text-[1.0625rem] font-semibold tabular-nums">
          {t("earn.nextPoints", { points: format.number(task.points) })}
        </span>
        <Button asChild size="nav" className={cn("flex-1", !compact && "sm:flex-none")}>
          {link.external ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer">
              {action}
              <span className="sr-only"> {t("earn.newTab")}</span>
            </a>
          ) : (
            <Link href={link.href}>{action}</Link>
          )}
        </Button>
      </div>
    </div>
  );
}

const ROW = "grid min-h-14 grid-cols-[1.25rem_minmax(0,1fr)_auto_1rem] items-center gap-3 py-3";

function TaskRow({
  task,
  compact,
  capReached,
  lineOaId,
}: {
  task: LoyaltyTask;
  compact: boolean;
  capReached: boolean;
  lineOaId?: string | null;
}) {
  const t = useTranslations("account.points");
  const format = useFormat();
  const pad = compact ? "px-4" : "px-4 sm:min-h-16 sm:gap-3.5 sm:px-5.5";
  const title = t(`tasks.${task.code}.title`);
  const points = (
    <span
      className={cn(
        "min-w-10 text-end text-sm tabular-nums",
        task.status === "todo" && !capReached ? "font-semibold" : "text-subtle font-medium",
        task.status === "held" && "text-muted",
      )}
    >
      {t("earn.rowPoints", { points: format.number(task.points) })}
    </span>
  );

  if (task.status === "todo") {
    const link = taskLink(task.code, lineOaId);
    const body = (
      <>
        <span
          aria-hidden="true"
          className="border-border-strong size-4 justify-self-center rounded-full border-[1.5px]"
        />
        <span className="min-w-0">
          <span className="block text-[0.90625rem] font-medium">
            {title}
            <span className="sr-only">, {t("earn.statusTodo")}</span>
          </span>
          {/* Phone: the title says enough, and the Thai descriptions wrapped into single orphaned words at 390. */}
          <span className={cn("text-muted text-[0.8125rem]", compact ? "hidden" : "hidden sm:block")}>
            {t(`tasks.${task.code}.description`)}
          </span>
        </span>
        {points}
        <Icon name="chevron-right" size={16} aria-hidden="true" className="text-subtle group-hover:text-fg" />
      </>
    );
    const classes = cn(
      ROW,
      pad,
      "group hover:bg-bg focus-visible:ring-focus-ring outline-none focus-visible:ring-2 focus-visible:ring-inset",
    );
    return link.external ? (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={classes}>
        {body}
        <span className="sr-only">{t("earn.newTab")}</span>
      </a>
    ) : (
      <Link href={link.href} className={classes}>
        {body}
      </Link>
    );
  }

  const held = task.status === "held";
  return (
    <div className={cn(ROW, pad)}>
      <Icon
        name={held ? "clock" : "check"}
        size={16}
        aria-hidden="true"
        className={cn("justify-self-center", held ? "text-warning" : "text-success")}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.90625rem]",
            held ? "font-medium" : "text-muted",
          )}
        >
          {title}
          {held ? (
            <Badge tone="neutral" size="sm">
              {t("earn.statusHeld")}
            </Badge>
          ) : (
            <span className="sr-only">, {t("earn.statusDone")}</span>
          )}
        </span>
        <span className="text-muted block text-[0.8125rem]">
          {held ? t("earn.heldNote") : t("earn.doneOn", { date: format.date(task.doneAt) })}
        </span>
      </span>
      {points}
      <span aria-hidden="true" />
    </div>
  );
}
