"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { problemMessage, QueryError, useCan } from "../console";
import { adminBrowserApis } from "../console/api";

/** This month, in Bangkok, as `YYYY-MM`. */
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/**
 * Material price and cost-driver indices (D-040): the monthly series price suggestions are
 * computed from. A month without a value is a gap the suggestions flag (`index_point_missing`),
 * so the current month is the one to record.
 */
export function IndexSeries() {
  const t = useTranslations("partners.indices");
  const format = useFormat();
  const canManage = useCan("index_series.manage");
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [point, setPoint] = useState({ period: thisMonth(), value: "", sourceRef: "" });

  const series = useQuery({
    queryKey: queryKeys.list("admin", "index_series", {}),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/index-series", { params: { query: { perPage: 100 } } })).data!,
  });
  const current = selected ?? series.data?.data[0]?.id ?? null;
  const points = useQuery({
    queryKey: queryKeys.related("admin", "index_series", current ?? "none", "points"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/index-series/{seriesId}/points", {
          params: { path: { seriesId: current! } },
        })
      ).data!,
    enabled: Boolean(current),
  });

  const record = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.PUT("/v1/admin/index-series/{seriesId}/points/{period}", {
          params: { path: { seriesId: current!, period: point.period } },
          body: { value: point.value.trim(), sourceRef: point.sourceRef.trim() || null },
        })
      ).data!,
    onSuccess: () => {
      toast.success(t("recorded"));
      setPoint({ ...point, value: "", sourceRef: "" });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "index_series") });
    },
    onError: (error) => toast.error(problemMessage(error, t("recordFailed"))),
  });

  if (series.isError) return <QueryError error={series.error} onRetry={() => void series.refetch()} />;
  const chosen = series.data?.data.find((item) => item.id === current);
  const rows = points.data ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("series")}</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-1">
          {(series.data?.data ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.id === current ? "true" : undefined}
                onClick={() => setSelected(item.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-start text-sm",
                  item.id === current ? "bg-primary-subtle text-primary-subtle-fg" : "hover:bg-surface-subtle",
                )}
              >
                <span className="block font-medium">{item.nameTh}</span>
                <span className="text-muted flex flex-wrap items-center gap-2 text-xs">
                  <span className="tabular-nums">{item.code}</span>
                  <Badge size="sm">{t(`kinds.${item.kind}`)}</Badge>
                  {item.latestPoint ? t("latest", { period: item.latestPoint.period }) : t("noPoints")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {chosen ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{chosen.nameTh}</CardTitle>
          </CardHeader>
          <p className="text-muted mb-3 text-sm">{t("unit", { unit: chosen.unit })}</p>
          <DataTable
            caption={t("pointsOf", { name: chosen.nameTh })}
            columns={[
              { id: "period", header: t("period"), cell: (row) => <span className="tabular-nums">{row.period}</span> },
              {
                id: "value",
                header: t("value"),
                numeric: true,
                cell: (row) => format.number(Number(row.value), { maximumFractionDigits: 3 }),
              },
              { id: "source", header: t("source"), cell: (row) => row.sourceRef ?? "–" },
            ]}
            rows={rows}
            getRowId={(row) => row.period}
            loading={points.isPending}
            density="compact"
          />
          {canManage ? (
            <form
              className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[10rem_12rem_minmax(0,1fr)_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (point.value.trim()) record.mutate();
              }}
            >
              <Field label={t("period")}>
                <Input
                  type="month"
                  value={point.period}
                  onChange={(event) => setPoint({ ...point, period: event.target.value })}
                />
              </Field>
              <Field label={t("value")}>
                <Input
                  inputMode="decimal"
                  value={point.value}
                  onChange={(event) => setPoint({ ...point, value: event.target.value })}
                />
              </Field>
              <Field label={t("source")}>
                <Input
                  value={point.sourceRef}
                  onChange={(event) => setPoint({ ...point, sourceRef: event.target.value })}
                />
              </Field>
              <Button type="submit" iconStart="save" loading={record.isPending} disabled={!point.value.trim()}>
                {t("record")}
              </Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
