"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { JOB_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ViewTabs";
import { Sheet } from "@/ui/components/Sheet";
import { Field } from "@/ui/components/Field";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, QueueTabs, StatusChip } from "../console";
import { useProductTypes } from "../console/useProductTypes";
import { stageColumns } from "./board";
import { useFactoryOptions } from "./factories";
import { JobPanel } from "./JobPanel";
import { productionBoardCount } from "./resources";

/** The most jobs one page of `admin.production.list` holds. */
const PER_PAGE = 100;
const ALL = "all";

/**
 * The production board (F2 2.6, D-074, D-075): every live job in the column of its current
 * milestone, the at-risk ones marked by the API's SLA engine with its reason. The columns, their
 * totals and at-risk counts are `admin.production.board`'s; the cards are the jobs
 * `admin.production.list` reads (the first 100). Filtered by factory and product type
 * (`?factoryId`, `?productTypeCode`); `?atRisk=true` shows only the at-risk jobs (`queue=at_risk`)
 * — the link the dashboard's queue points at.
 */
export function ProductionBoard() {
  const t = useTranslations("production.board");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const atRisk = params.get("atRisk") === "true";
  const factoryId = params.get("factoryId") ?? undefined;
  const productTypeCode = params.get("productTypeCode") ?? undefined;
  const factories = useFactoryOptions();
  const productTypes = useProductTypes();
  const filters = { ...(factoryId ? { factoryId } : {}), ...(productTypeCode ? { productTypeCode } : {}) };
  const board = useQuery({
    queryKey: queryKeys.list("admin", "production_board", filters),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/production-board", { params: { query: filters } })).data!,
    staleTime: STALE_TIME.live,
  });
  const jobs = useQuery({
    queryKey: queryKeys.list("admin", "production_job", { atRisk, perPage: PER_PAGE, ...filters }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/production-jobs", {
          params: { query: { perPage: PER_PAGE, ...filters, ...(atRisk ? { queue: "at_risk" as const } : {}) } },
        })
      ).data!,
    staleTime: STALE_TIME.live,
  });
  const [opened, setOpened] = useState<string | null>(null);
  if (board.isError) return <QueryError error={board.error} onRetry={() => void board.refetch()} />;
  if (jobs.isError) return <QueryError error={jobs.error} onRetry={() => void jobs.refetch()} />;
  const openedJob = (jobs.data?.data ?? []).find((job) => job.id === opened) ?? null;
  // Every stage, empty or not, in the order work flows (UX audit, /production).
  const columns = stageColumns(board.data?.columns ?? [], jobs.data?.data ?? []);
  const stepLabel = new Map(
    (board.data?.columns ?? []).map((column) => [column.key, locale === "en" ? column.labelEn : column.labelTh]),
  );
  const truncated = (jobs.data?.meta.total ?? 0) > PER_PAGE;
  const loading = board.isPending || jobs.isPending;
  const shownTotal = board.data ? (atRisk ? board.data.atRisk : board.data.total) : null;
  const href = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const text = query.toString();
    return text ? `${pathname}?${text}` : pathname;
  };
  const narrowed = Boolean(factoryId || productTypeCode);

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar>
        {/* The board's two views, counted as its columns add up (`admin.production.board`), as the sidebar is. */}
        <QueueTabs
          label={t("viewsLabel")}
          param="atRisk"
          countFrom={productionBoardCount}
          tabs={[
            { value: null, label: t("all") },
            { value: "true", label: t("atRiskOnly") },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {factories.length ? (
            <Field label={t("factory")} labelHidden className="w-full sm:w-56">
              <SearchableSelect
                size="sm"
                value={factoryId ?? ALL}
                onValueChange={(value) => router.replace(href({ factoryId: value === ALL ? undefined : value }))}
                options={[{ value: ALL, label: t("allFactories") }, ...factories]}
              />
            </Field>
          ) : null}
          {productTypes.options.length ? (
            <Field label={t("productType")} labelHidden className="w-full sm:w-52">
              <SearchableSelect
                size="sm"
                value={productTypeCode ?? ALL}
                onValueChange={(value) => router.replace(href({ productTypeCode: value === ALL ? undefined : value }))}
                options={[{ value: ALL, label: t("allProductTypes") }, ...productTypes.options]}
              />
            </Field>
          ) : null}
        </div>
      </ListToolbar>

      {/* The board in its own box: six stages side by side; on a narrower desk the box scrolls sideways inside
          itself, never the page, and each column scrolls its own cards so every stage head stays in view. On a
          phone the stages stack, each head with its count over its cards. */}
      <section
        aria-label={t("title")}
        className="border-border bg-surface rounded-panel overflow-hidden border"
        aria-busy={loading}
      >
        <div
          className="relative overflow-x-auto overscroll-x-contain"
          role="region"
          aria-label={t("boardScroll")}
          tabIndex={0}
        >
          <ol className="divide-border grid grid-cols-1 divide-y md:min-w-max md:auto-cols-[minmax(11rem,1fr)] md:grid-flow-col md:grid-cols-none md:divide-x md:divide-y-0 lg:min-w-full">
            {columns.map((column) => {
              const shown = atRisk ? column.jobs.filter((job) => job.atRisk) : column.jobs;
              const count = atRisk ? column.atRisk : column.total;
              return (
                <li key={column.stage} className="flex min-w-0 flex-col">
                  <h2 className="border-border bg-surface-subtle flex min-h-11 items-center gap-2 border-b px-3 text-sm font-semibold">
                    <span className="min-w-0 flex-1 truncate">{t(`stages.${column.stage}`)}</span>
                    {board.data ? (
                      <span
                        className={cn("tabular-nums", count ? "text-fg" : "text-muted font-normal")}
                        aria-label={t("count", { count })}
                      >
                        {format.number(count)}
                      </span>
                    ) : null}
                    {!atRisk && column.atRisk > 0 ? (
                      <Badge tone="danger" size="sm" icon="warning">
                        {format.number(column.atRisk)}
                        <span className="sr-only">{t("risky", { count: column.atRisk })}</span>
                      </Badge>
                    ) : null}
                  </h2>
                  {shown.length === 0 ? (
                    // An empty stage is a quiet dash on a desk; on a phone, where stages stack, it takes no room.
                    <p className="text-subtle hidden px-3 py-5 text-center text-sm md:block" aria-label={t("noJobs")}>
                      {loading ? "" : "—"}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 overflow-y-auto overscroll-y-contain p-2 lg:max-h-[calc(100dvh-17rem)]">
                      {shown.map((job) => (
                        <li key={job.id}>
                          <JobCard
                            job={job}
                            step={
                              job.currentMilestoneKey && column.stage !== "awaiting"
                                ? stepLabel.get(job.currentMilestoneKey)
                                : undefined
                            }
                            productLabel={job.productTypeNameTh ?? productTypes.labelOf(job.productTypeCode)}
                            onOpen={() => setOpened(job.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        {!loading && shownTotal === 0 ? (
          // One empty state for the whole board, not "ไม่มีงาน" in every column (UX audit, /production).
          <div className="border-border border-t">
            <EmptyState
              icon="factory"
              className="rounded-none border-0"
              title={atRisk ? t("emptyAtRiskTitle") : narrowed ? t("emptyFilteredTitle") : t("emptyTitle")}
              description={atRisk ? t("emptyAtRiskBody") : narrowed ? undefined : t("emptyBody")}
              action={
                atRisk || narrowed ? (
                  <Button asChild variant="secondary">
                    <Link href={pathname}>{t("showAll")}</Link>
                  </Button>
                ) : (
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href="/orders?queue=waiting_production">{t("emptyAction")}</Link>
                  </Button>
                )
              }
            />
          </div>
        ) : null}
      </section>
      {truncated ? <p className="text-muted text-sm">{t("truncated", { count: PER_PAGE })}</p> : null}

      <Sheet
        open={openedJob !== null}
        onOpenChange={(open) => (open ? undefined : setOpened(null))}
        side="end"
        title={openedJob ? openedJob.jobNo : ""}
        description={
          openedJob
            ? `${openedJob.productTypeNameTh ?? productTypes.labelOf(openedJob.productTypeCode)} · ${t("pieces", {
                quantity: format.number(openedJob.quantityOrdered),
              })} · ${openedJob.factoryCode}`
            : undefined
        }
        closeLabel={t("close")}
      >
        {openedJob ? (
          <div className="flex flex-col gap-5">
            {openedJob.promisedShipDate ? (
              <p className={cn("text-sm", openedJob.atRisk && "text-danger-subtle-fg font-medium")}>
                {t("promised")} {format.date(openedJob.promisedShipDate)}
                {openedJob.predictedFinishOn
                  ? ` · ${t("predicted", { date: format.date(openedJob.predictedFinishOn) })}`
                  : null}
              </p>
            ) : null}
            <section aria-labelledby="job-steps">
              <h3 id="job-steps" className="mb-2 text-sm font-semibold">
                {t("steps")}
              </h3>
              <ol className="flex flex-col gap-2">
                {openedJob.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Icon
                        name={
                          milestone.status === "completed"
                            ? "check"
                            : milestone.status === "in_progress"
                              ? "timer"
                              : milestone.status === "skipped"
                                ? "minus"
                                : "clock"
                        }
                        size={16}
                        className={milestone.status === "completed" ? "text-success" : "text-muted"}
                      />
                      {locale === "en" ? milestone.nameEn : milestone.nameTh}
                    </span>
                    <span className="text-muted text-xs">
                      {milestone.completedAt
                        ? format.date(milestone.completedAt)
                        : milestone.dueAt
                          ? t("dueOn", { date: format.date(milestone.dueAt) })
                          : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            {openedJob.inspection ? (
              <section aria-labelledby="job-qc" className="border-border rounded-control border p-3 text-sm">
                <h3 id="job-qc" className="mb-1 font-semibold">
                  {t("qc")}
                </h3>
                <p className="text-muted">
                  {t("qcSample", { size: format.number(openedJob.inspection.sampleSize) })} ·{" "}
                  {t(`qcStates.${openedJob.inspection.status}`)}
                </p>
              </section>
            ) : null}
            <JobPanel job={openedJob} />
            <Button asChild variant="secondary" iconEnd="arrow-right">
              <Link href={`/orders/${openedJob.orderId}?tab=production`}>{t("openOrder")}</Link>
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

type Job = Schemas["AdminJobDto"];

/**
 * One job on the board, compact: its number (opens it beside the board), the promised date, what and how many, the
 * factory and order, the steps done of its route, and — when the SLA engine flags it — why it is at risk.
 */
function JobCard({
  job,
  step,
  productLabel,
  onOpen,
}: {
  job: Job;
  step: string | undefined;
  productLabel: string;
  onOpen: () => void;
}) {
  const t = useTranslations("production.board");
  const format = useFormat();
  const done = job.milestones.filter((milestone) => milestone.status === "completed").length;
  const total = job.milestones.filter((milestone) => milestone.status !== "skipped").length;
  return (
    <article
      className={cn(
        "bg-surface rounded-control relative flex flex-col gap-1 border p-2.5 text-sm transition-colors",
        "hover:border-border-strong focus-within:ring-focus-ring focus-within:ring-2",
        job.atRisk ? "border-danger" : "border-border",
      )}
    >
      {/* Opens the job beside the board, not a new page (UX audit, /production); the whole card is the target. The
          number is never cut: it has the card's whole first line. */}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="text-primary self-start text-start font-semibold whitespace-nowrap tabular-nums outline-none after:absolute after:inset-0 hover:underline"
      >
        {job.jobNo}
      </button>
      <p className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate" title={productLabel}>
          {productLabel}
        </span>
        {job.inspectionRequired ? (
          <Icon name="clipboard-check" size={15} className="text-muted shrink-0" label={t("inspection")} />
        ) : null}
      </p>
      <p className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium whitespace-nowrap tabular-nums">
          {t("pieces", { quantity: format.number(job.quantityOrdered) })}
        </span>
        <span className="text-muted truncate tabular-nums" title={job.orderCode}>
          {job.factoryCode}
        </span>
      </p>
      <p className="text-muted truncate text-xs tabular-nums">{job.orderCode}</p>
      {step ? <p className="text-muted truncate text-xs">{step}</p> : null}
      <p className="border-border mt-1 flex items-baseline justify-between gap-2 border-t pt-1.5 text-xs">
        <span
          className={cn("whitespace-nowrap", job.atRisk ? "text-danger-subtle-fg font-medium" : "text-muted")}
          title={job.promisedShipDate ? `${t("promised")} ${format.date(job.promisedShipDate)}` : undefined}
        >
          {job.promisedShipDate
            ? t("promisedShort", { date: format.date(job.promisedShipDate, { style: "dayMonth" }) })
            : ""}
        </span>
        {total > 0 ? (
          <span className="text-muted whitespace-nowrap tabular-nums" title={t("progress")}>
            {t("stepsDone", { done, total })}
          </span>
        ) : null}
      </p>
      {job.status === "on_hold" ? <StatusChip map={JOB_STATUS} value={job.status} /> : null}
      {job.atRisk ? (
        <p className="text-danger-subtle-fg flex items-start gap-1 text-xs font-medium">
          <Icon name="warning" size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {job.riskReason ? t(`riskReasons.${job.riskReason}`) : t("atRisk")}
            {job.predictedFinishOn
              ? ` · ${t("predicted", { date: format.date(job.predictedFinishOn, { style: "dayMonth" }) })}`
              : null}
          </span>
        </p>
      ) : null}
    </article>
  );
}
