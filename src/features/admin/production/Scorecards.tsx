"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useCan } from "../console";

type Scorecard = Schemas["ScorecardDto"];
type MonthCard = Schemas["FactoryScorecardDto"];
const METRICS = [
  "onTimeAcceptancePct",
  "onTimeShippingPct",
  "qcFirstPassPct",
  "onTimeUpdatesPct",
  "claimRatePct",
] as const;

/**
 * Factory scorecards (D-155, D-075): a factory's on-time acceptance, on-time shipping, QC first
 * pass, on-time updates and claim rate, month by month — the same card the factory sees, and what
 * allocation leans on when several factories can take a job.
 *
 * One factory's latest 12 months (`admin.inspections.scorecards`, `?factoryId=`, the first one by
 * default), and every factory side by side for one of those months
 * (`admin.inspections.monthScorecards`, `?month=`, the latest by default) — for allocation and
 * the partner team.
 */
export function Scorecards() {
  const t = useTranslations("production.scorecards");
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const factories = useQuery({
    queryKey: queryKeys.list("admin", "factory", { perPage: 100, sort: "code" }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories", {
          params: { query: { perPage: 100, sort: "code", order: "asc" } },
        })
      ).data!.data,
    staleTime: STALE_TIME.reference,
  });
  const factoryId = params.get("factoryId") ?? factories.data?.[0]?.id ?? null;
  const factory = factories.data?.find((candidate) => candidate.id === factoryId);
  const queryClient = useQueryClient();
  const canRecompute = useCan("production.manage");
  // After a correction (a job's dates, a claim) — the monthly job computes last month on the 1st (D-155).
  const recompute = useMutation({
    mutationFn: async (month: string) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/scorecards/actions/recompute", {
          params: { path: { factoryId: factoryId! } },
          body: { month },
        })
      ).data!,
    onSuccess: () => {
      toast.success(t("recomputed"));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.related("admin", "factory", factoryId ?? "", "scorecards"),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "scorecard") });
    },
    onError: (error) => toast.error(problemMessage(error, t("recomputeFailed"))),
  });
  const cards = useQuery({
    queryKey: queryKeys.related("admin", "factory", factoryId ?? "", "scorecards"),
    enabled: Boolean(factoryId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/factories/{factoryId}/scorecards", {
          params: { path: { factoryId: factoryId! } },
        })
      ).data!,
  });
  const month = params.get("month") ?? cards.data?.[0]?.month ?? null;
  const monthCards = useQuery({
    queryKey: queryKeys.list("admin", "scorecard", { month }),
    enabled: Boolean(month),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/scorecards", { params: { query: { month: month! } } })).data!,
  });
  const go = (next: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) query.set(key, value);
    router.replace(`${pathname}?${query.toString()}`);
  };
  if (monthCards.isError) return <QueryError error={monthCards.error} onRetry={() => void monthCards.refetch()} />;
  if (factories.isError) return <QueryError error={factories.error} onRetry={() => void factories.refetch()} />;
  if (cards.isError) return <QueryError error={cards.error} onRetry={() => void cards.refetch()} />;

  const columns: DataTableColumn<Scorecard>[] = [
    { id: "month", header: t("monthColumn"), cell: (row) => <span className="tabular-nums">{row.month}</span> },
    ...METRICS.map((metric) => ({
      id: metric,
      header: t(`metrics.${metric}`),
      numeric: true,
      cell: (row: Scorecard) => (row[metric] === null ? "–" : format.percent(row[metric])),
    })),
    { id: "jobs", header: t("jobs"), numeric: true, cell: (row) => format.number(row.jobsCount) },
  ];
  const monthColumns: DataTableColumn<MonthCard>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => (
        <Link href={`/partners/${row.factory.id}`} className="text-primary hover:underline">
          <span className="font-mono">{row.factory.code}</span> · {row.factory.name}
        </Link>
      ),
    },
    ...METRICS.map((metric) => ({
      id: metric,
      header: t(`metrics.${metric}`),
      numeric: true,
      cell: (row: MonthCard) => (row[metric] === null ? "–" : format.percent(row[metric])),
    })),
    { id: "jobs", header: t("jobs"), numeric: true, cell: (row) => format.number(row.jobsCount) },
    ...(canRecompute && factoryId
      ? [
          {
            id: "recompute",
            header: <span className="sr-only">{t("recompute")}</span>,
            cell: (row: MonthCard) => (
              <Button
                size="sm"
                variant="ghost"
                iconStart="refresh"
                loading={recompute.isPending && recompute.variables === row.month}
                onClick={() => recompute.mutate(row.month)}
              >
                {t("recompute")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t("factory")} className="w-full max-w-sm">
          <SearchableSelect
            value={factoryId ?? undefined}
            onValueChange={(value) => go({ factoryId: value })}
            options={(factories.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.code} · ${item.tradeName ?? item.legalName}`,
            }))}
          />
        </Field>
        {factory ? (
          <Link href={`/partners/${factory.id}`} className="text-primary text-sm hover:underline">
            {t("openFactory", { code: factory.code })}
          </Link>
        ) : null}
      </div>
      <DataTable
        caption={factory ? t("caption", { code: factory.code }) : t("title")}
        columns={columns}
        rows={cards.data ?? []}
        getRowId={(row) => row.month}
        loading={factories.isPending || (Boolean(factoryId) && cards.isPending)}
      />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("byMonth")}</h2>
        {cards.data?.length ? (
          <Field label={t("month")} className="w-48">
            <SearchableSelect
              value={month ?? undefined}
              onValueChange={(value) => go({ month: value })}
              options={cards.data.map((card) => ({ value: card.month, label: card.month }))}
            />
          </Field>
        ) : null}
      </div>
      <DataTable
        caption={month ? t("monthCaption", { month }) : t("byMonth")}
        columns={monthColumns}
        rows={monthCards.data ?? []}
        getRowId={(row) => row.factory.id}
        loading={Boolean(month) && monthCards.isPending}
      />
    </div>
  );
}
