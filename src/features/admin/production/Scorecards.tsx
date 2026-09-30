"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Select } from "@/ui/components/Select";

import { adminBrowserApis, QueryError } from "../console";

type Scorecard = Schemas["ScorecardDto"];
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
 * `admin.inspections.scorecards` answers one factory's latest 12 months, so the screen picks a
 * factory (`?factoryId=`, the first one by default). CONTRACT-GAP admin.scorecards — no
 * all-factories view of one month (U-B0.2).
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t("factory")} className="w-full max-w-sm">
          <Select
            value={factoryId ?? undefined}
            onValueChange={(value) => router.replace(`${pathname}?factoryId=${encodeURIComponent(value)}`)}
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
    </div>
  );
}
