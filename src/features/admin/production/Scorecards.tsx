"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { z } from "zod";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { scorecard } from "@/lib/api/requests/admin-partners";
import { browserRequests } from "@/lib/api/requests/browser";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";

import { QueryError } from "../console";

type Scorecard = z.output<typeof scorecard>;
const METRICS = [
  "onTimeAcceptancePct",
  "onTimeShippingPct",
  "qcFirstPassPct",
  "onTimeUpdatesPct",
  "claimRatePct",
] as const;

/**
 * Factory scorecards (D-155, D-075): the month's on-time acceptance, on-time shipping, QC first
 * pass, on-time updates and claim rate per factory — the same card the factory sees, and what
 * allocation leans on when several factories can take a job.
 */
export function Scorecards() {
  const t = useTranslations("production.scorecards");
  const format = useFormat();
  const cards = useQuery({
    queryKey: queryKeys.list("admin", "scorecard", {}),
    queryFn: () => browserRequests().call("GET /v1/admin/scorecards", { query: {} }),
  });
  if (cards.isError) return <QueryError error={cards.error} onRetry={() => void cards.refetch()} />;

  const columns: DataTableColumn<Scorecard>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => (
        <Link href={`/partners/${row.factory.id}`} className="text-primary hover:underline">
          {row.factory.name}
        </Link>
      ),
    },
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
      {cards.data ? <p className="text-muted text-sm">{t("month", { month: cards.data.month })}</p> : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={cards.data?.data ?? []}
        getRowId={(row) => row.factory.id}
        loading={cards.isPending}
      />
    </div>
  );
}
