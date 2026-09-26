"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { QueryError } from "../console";

/**
 * The production board (F2 2.6, D-074, D-075): every live job in the column of its current
 * milestone, the at-risk ones marked by the API's SLA engine (predicted finish past the promise).
 * `?atRisk=true` shows only those — the link the dashboard's queue points at.
 */
export function ProductionBoard() {
  const t = useTranslations("production.board");
  const format = useFormat();
  const params = useSearchParams();
  const atRisk = params.get("atRisk") === "true";
  const board = useQuery({
    queryKey: queryKeys.list("admin", "production_board", { atRisk }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/production-board", { query: atRisk ? { atRisk: "true" } : {} }),
    staleTime: STALE_TIME.live,
  });
  if (board.isError) return <QueryError error={board.error} onRetry={() => void board.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={atRisk ? "secondary" : "primary"} asChild>
          <Link href="/production">{t("all")}</Link>
        </Button>
        <Button size="sm" variant={atRisk ? "primary" : "secondary"} iconStart="warning" asChild>
          <Link href="/production?atRisk=true">{t("atRiskOnly")}</Link>
        </Button>
      </div>
      <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={t("title")} tabIndex={0}>
        <ol className="flex min-w-max gap-3">
          {(board.data?.columns ?? []).map((column) => (
            <li key={column.key} className="w-64 shrink-0">
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>{column.name}</span>
                <span className="text-muted flex items-center gap-2 text-xs font-normal">
                  {t("count", { count: column.total })}
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
                          href={`/orders/${job.order.id}?tab=production`}
                          className="text-primary font-mono hover:underline"
                        >
                          {job.jobNo}
                        </Link>
                        {job.inspectionRequired ? (
                          <Icon name="clipboard-check" size={16} label={t("inspection")} />
                        ) : null}
                      </p>
                      <p className="text-muted truncate text-xs">{job.factory.name}</p>
                      <p className="text-xs">
                        {job.productType.name} · {format.number(job.quantity)}
                      </p>
                      <p className="mt-1 text-xs">
                        {t("promised")} {format.date(job.promisedShipDate)}
                      </p>
                      {job.atRisk ? (
                        <p className="text-danger mt-1 flex items-start gap-1 text-xs font-medium">
                          <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
                          {job.riskReason ?? t("atRisk")}
                          {job.predictedFinishOn
                            ? ` · ${t("predicted", { date: format.date(job.predictedFinishOn) })}`
                            : null}
                        </p>
                      ) : null}
                    </Card>
                  </li>
                ))}
                {column.jobs.length === 0 ? <li className="text-muted text-xs">{t("empty")}</li> : null}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
