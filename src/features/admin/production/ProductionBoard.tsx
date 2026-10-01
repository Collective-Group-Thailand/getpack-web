"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { JOB_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Select } from "@/ui/components/Select";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, StatusChip } from "../console";
import { useProductTypes } from "../console/useProductTypes";
import { AWAITING_ACCEPTANCE, boardColumns } from "./board";
import { useFactoryOptions } from "./factories";

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
  if (board.isError) return <QueryError error={board.error} onRetry={() => void board.refetch()} />;
  if (jobs.isError) return <QueryError error={jobs.error} onRetry={() => void jobs.refetch()} />;
  const columns = boardColumns(board.data?.columns ?? [], jobs.data?.data ?? []).filter(
    (column) => !atRisk || column.atRisk > 0,
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
      <div className="flex flex-wrap items-end gap-3">
        <Button size="sm" variant={atRisk ? "secondary" : "primary"} asChild>
          <Link href={href({ atRisk: undefined })}>{t("all")}</Link>
        </Button>
        <Button size="sm" variant={atRisk ? "primary" : "secondary"} iconStart="warning" asChild>
          <Link href={href({ atRisk: "true" })}>{t("atRiskOnly")}</Link>
        </Button>
        {factories.length ? (
          <Field label={t("factory")} className="w-56">
            <Select
              value={factoryId ?? ALL}
              onValueChange={(value) => router.replace(href({ factoryId: value === ALL ? undefined : value }))}
              options={[{ value: ALL, label: t("allFactories") }, ...factories]}
            />
          </Field>
        ) : null}
        {productTypes.options.length ? (
          <Field label={t("productType")} className="w-56">
            <Select
              value={productTypeCode ?? ALL}
              onValueChange={(value) => router.replace(href({ productTypeCode: value === ALL ? undefined : value }))}
              options={[{ value: ALL, label: t("allProductTypes") }, ...productTypes.options]}
            />
          </Field>
        ) : null}
        {board.data ? (
          <span className="text-muted text-sm">
            {t("totals", { total: board.data.total, atRisk: board.data.atRisk })}
          </span>
        ) : null}
        {truncated ? <span className="text-muted text-xs">{t("truncated", { count: PER_PAGE })}</span> : null}
      </div>
      <div className="-mx-4 overflow-x-auto px-4" role="region" aria-label={t("title")} tabIndex={0}>
        {board.data && columns.length === 0 ? <p className="text-muted text-sm">{t("empty")}</p> : null}
        <ol className="flex min-w-max gap-3">
          {columns.map((column) => (
            <li key={column.key} className="w-64 shrink-0">
              <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>
                  {column.key === AWAITING_ACCEPTANCE
                    ? t("awaiting")
                    : locale === "en"
                      ? column.labelEn
                      : column.labelTh}
                </span>
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
                      <p className="truncate text-xs">
                        {job.productTypeNameTh ?? productTypes.labelOf(job.productTypeCode)} ·{" "}
                        {t("pieces", { quantity: format.number(job.quantityOrdered) })}
                      </p>
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
                          {job.riskReason ? t(`riskReasons.${job.riskReason}`) : t("atRisk")}
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
