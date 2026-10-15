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
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Sheet } from "@/ui/components/Sheet";
import { Field } from "@/ui/components/Field";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, StatusChip } from "../console";
import { useProductTypes } from "../console/useProductTypes";
import { stageColumns } from "./board";
import { useFactoryOptions } from "./factories";
import { JobPanel } from "./JobPanel";

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
  const href = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const text = query.toString();
    return text ? `${pathname}?${text}` : pathname;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant={atRisk ? "secondary" : "primary"} asChild>
          <Link href={href({ atRisk: undefined })}>{t("all")}</Link>
        </Button>
        <Button size="sm" variant={atRisk ? "primary" : "secondary"} iconStart="warning" asChild>
          <Link href={href({ atRisk: "true" })}>{t("atRiskOnly")}</Link>
        </Button>
        {factories.length ? (
          <Field label={t("factory")} labelHidden className="w-56">
            <SearchableSelect
              value={factoryId ?? ALL}
              onValueChange={(value) => router.replace(href({ factoryId: value === ALL ? undefined : value }))}
              options={[{ value: ALL, label: t("allFactories") }, ...factories]}
            />
          </Field>
        ) : null}
        {productTypes.options.length ? (
          <Field label={t("productType")} labelHidden className="w-56">
            <SearchableSelect
              value={productTypeCode ?? ALL}
              onValueChange={(value) => router.replace(href({ productTypeCode: value === ALL ? undefined : value }))}
              options={[{ value: ALL, label: t("allProductTypes") }, ...productTypes.options]}
            />
          </Field>
        ) : null}
        {board.data ? (
          <span className="text-muted ms-auto text-sm">
            {t("totals", { total: board.data.total, atRisk: board.data.atRisk })}
          </span>
        ) : null}
        {truncated ? <span className="text-muted text-xs">{t("truncated", { count: PER_PAGE })}</span> : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={t("title")} tabIndex={0}>
        <ol className="flex min-w-max gap-3 pb-2">
          {columns.map((column) => {
            const shown = atRisk ? column.jobs.filter((job) => job.atRisk) : column.jobs;
            return (
              <li key={column.stage} className="bg-surface-subtle rounded-card flex w-72 shrink-0 flex-col p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
                  <span>{t(`stages.${column.stage}`)}</span>
                  <span className="text-muted flex items-center gap-2 text-xs font-normal">
                    {t("count", { count: column.total })}
                    {column.atRisk > 0 ? (
                      <Badge tone="danger" size="sm">
                        {t("risky", { count: column.atRisk })}
                      </Badge>
                    ) : null}
                  </span>
                </h2>
                {shown.length === 0 ? (
                  <p className="border-border text-muted rounded-control border border-dashed px-3 py-6 text-center text-sm">
                    {t("noJobs")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {shown.map((job) => {
                      const done = job.milestones.filter((milestone) => milestone.status === "completed").length;
                      const total = job.milestones.filter((milestone) => milestone.status !== "skipped").length;
                      const step = job.currentMilestoneKey ? stepLabel.get(job.currentMilestoneKey) : undefined;
                      return (
                        <li key={job.id}>
                          <Card padding="sm" className={cn("flex flex-col gap-1.5", job.atRisk && "border-danger")}>
                            <p className="flex items-center justify-between gap-2 text-sm">
                              {/* Opens the job beside the board, not a new page (UX audit, /production). */}
                              <button
                                type="button"
                                onClick={() => setOpened(job.id)}
                                className="text-primary font-mono font-medium hover:underline"
                                aria-haspopup="dialog"
                              >
                                {job.jobNo}
                              </button>
                              {job.inspectionRequired ? (
                                <Icon name="clipboard-check" size={16} label={t("inspection")} />
                              ) : null}
                            </p>
                            <p className="truncate text-sm">
                              {job.productTypeNameTh ?? productTypes.labelOf(job.productTypeCode)} ·{" "}
                              {t("pieces", { quantity: format.number(job.quantityOrdered) })}
                            </p>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs">
                              <Badge size="sm">{job.factoryCode}</Badge>
                              <span className="text-muted">{job.orderCode}</span>
                              {step && column.stage !== "awaiting" ? (
                                <span className="text-muted">· {step}</span>
                              ) : null}
                            </p>
                            {job.promisedShipDate ? (
                              <p
                                className={cn(
                                  "text-xs",
                                  job.atRisk ? "text-danger-subtle-fg font-medium" : "text-muted",
                                )}
                              >
                                {t("promised")} {format.date(job.promisedShipDate)}
                              </p>
                            ) : null}
                            {total > 0 ? (
                              <div
                                className="bg-border rounded-control h-1 overflow-hidden"
                                role="progressbar"
                                aria-label={t("progress")}
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={done}
                              >
                                <div
                                  className={cn("rounded-control h-full", job.atRisk ? "bg-danger" : "bg-primary")}
                                  style={{ width: `${(done / total) * 100}%` }}
                                />
                              </div>
                            ) : null}
                            {job.status === "on_hold" ? <StatusChip map={JOB_STATUS} value={job.status} /> : null}
                            {job.atRisk ? (
                              <p className="text-danger-subtle-fg flex items-start gap-1 text-xs font-medium">
                                <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
                                {job.riskReason ? t(`riskReasons.${job.riskReason}`) : t("atRisk")}
                                {job.predictedFinishOn
                                  ? ` · ${t("predicted", { date: format.date(job.predictedFinishOn) })}`
                                  : null}
                              </p>
                            ) : null}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>

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
