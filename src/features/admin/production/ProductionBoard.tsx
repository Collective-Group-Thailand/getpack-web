"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { JOB_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, StatusChip } from "../console";
import { boardColumns } from "./board";

/** The most jobs one page of `admin.production.list` holds. */
const PER_PAGE = 100;

/**
 * The production board (F2 2.6, D-074, D-075): every live job in the column of its current
 * milestone, the at-risk ones marked by the API's SLA engine (predicted finish past the promise).
 * `?atRisk=true` shows only those (`queue=at_risk`) — the link the dashboard's queue points at.
 *
 * Read from `admin.production.list` and grouped here (`./board.ts`). Not published (CONTRACT-GAP
 * admin.production-board): the grouped board with the API's column totals — the board shows the
 * first 100 jobs it reads — the factory and product-type filters, the product type and the risk
 * reason of a job.
 */
export function ProductionBoard() {
  const t = useTranslations("production.board");
  const locale = useLocale();
  const format = useFormat();
  const params = useSearchParams();
  const atRisk = params.get("atRisk") === "true";
  const jobs = useQuery({
    queryKey: queryKeys.list("admin", "production_job", { atRisk, perPage: PER_PAGE }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/production-jobs", {
          params: { query: { perPage: PER_PAGE, ...(atRisk ? { queue: "at_risk" as const } : {}) } },
        })
      ).data!,
    staleTime: STALE_TIME.live,
  });
  if (jobs.isError) return <QueryError error={jobs.error} onRetry={() => void jobs.refetch()} />;
  const columns = boardColumns(jobs.data?.data ?? []);
  const truncated = (jobs.data?.meta.total ?? 0) > PER_PAGE;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={atRisk ? "secondary" : "primary"} asChild>
          <Link href="/production">{t("all")}</Link>
        </Button>
        <Button size="sm" variant={atRisk ? "primary" : "secondary"} iconStart="warning" asChild>
          <Link href="/production?atRisk=true">{t("atRiskOnly")}</Link>
        </Button>
        {truncated ? <span className="text-muted text-xs">{t("truncated", { count: PER_PAGE })}</span> : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={t("title")} tabIndex={0}>
        {jobs.data && columns.length === 0 ? <p className="text-muted text-sm">{t("empty")}</p> : null}
        <ol className="flex min-w-max gap-3">
          {columns.map((column) => (
            <li key={column.key ?? "awaiting"} className="w-64 shrink-0">
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>{column.key === null ? t("awaiting") : locale === "en" ? column.nameEn : column.nameTh}</span>
                <span className="text-muted flex items-center gap-2 text-xs font-normal">
                  {t("count", { count: column.jobs.length })}
                  {column.atRisk > 0 ? (
                    <Badge tone="danger" size="sm">
                      {t("risky", { count: column.atRisk })}
                    </Badge>
                  ) : null}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {column.jobs.map((job) => (
                  <li key={job.id}>
                    <Card padding="sm" className={cn(job.atRisk && "border-danger")}>
                      <p className="flex items-center justify-between gap-2 text-sm">
                        <Link
                          href={`/orders/${job.orderId}?tab=production`}
                          className="text-primary font-mono hover:underline"
                        >
                          {job.jobNo}
                        </Link>
                        {job.inspectionRequired ? (
                          <Icon name="clipboard-check" size={16} label={t("inspection")} />
                        ) : null}
                      </p>
                      <p className="text-muted truncate text-xs">
                        {job.factoryCode} · {job.orderCode}
                      </p>
                      <p className="text-xs">{t("pieces", { quantity: format.number(job.quantityOrdered) })}</p>
                      {job.promisedShipDate ? (
                        <p className="mt-1 text-xs">
                          {t("promised")} {format.date(job.promisedShipDate)}
                        </p>
                      ) : null}
                      {job.status === "on_hold" ? (
                        <div className="mt-1">
                          <StatusChip map={JOB_STATUS} value={job.status} />
                        </div>
                      ) : null}
                      {job.atRisk ? (
                        <p className="text-danger mt-1 flex items-start gap-1 text-xs font-medium">
                          <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
                          {t("atRisk")}
                          {job.predictedFinishOn
                            ? ` · ${t("predicted", { date: format.date(job.predictedFinishOn) })}`
                            : null}
                        </p>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
