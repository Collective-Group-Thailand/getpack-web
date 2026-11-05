"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { FundingRow, FundingSplit } from "@/lib/api/requests/admin-loyalty-p4";
import { Button } from "@/ui/components/Button";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { EmptyState } from "@/ui/components/EmptyState";

import { adminBrowserApis, QueryError } from "../console";

/**
 * "แหล่งเงินส่วนลดดีล" on `/marketing/loyalty/analytics` (loyalty P4, D-506): per capacity deal, its orders and
 * discount, what the factories and getpack each funded and what was reversed — `admin.loyaltyAnalytics.funding`. A
 * read for Marketing and Finance; nothing here is editable.
 */
export function FundingSplitSection({ range }: { range: { from: string; to: string } }) {
  const t = useTranslations("marketing.fundingSplit");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "loyalty_funding", range),
    queryFn: async () =>
      adminBrowserApis().requests.call("GET /v1/admin/loyalty/analytics/funding", {
        query: { ...range, perPage: 100 },
      }),
    staleTime: 5 * 60_000,
  });
  return (
    <DeskSection title={t("title")} description={t("note")}>
      {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      <FundingSplitTable data={query.data} loading={query.isPending} />
    </DeskSection>
  );
}

export function FundingSplitTable({ data, loading = false }: { data?: FundingSplit; loading?: boolean }) {
  const t = useTranslations("marketing.fundingSplit");
  const format = useFormat();
  const totals = data?.meta.totals;
  return (
    <div className="flex flex-col gap-2">
      <DataTable<FundingRow>
        caption={t("title")}
        rows={data?.data ?? []}
        loading={loading}
        getRowId={(row) => row.promotionId}
        empty={
          <EmptyState
            icon="handshake"
            title={t("empty")}
            action={
              <Button asChild variant="secondary">
                <Link href="/marketing/promotions?origin=capacity_deal">{t("allDeals")}</Link>
              </Button>
            }
          />
        }
        columns={[
          {
            id: "deal",
            header: t("columns.deal"),
            cell: (row) => (
              <span className="block min-w-0">
                <Link
                  href={`/marketing/promotions/${row.promotionId}`}
                  className="text-primary font-medium hover:underline"
                >
                  {row.productTypeName}
                </Link>
                <span className="text-muted block text-xs">{row.name}</span>
              </span>
            ),
          },
          {
            id: "week",
            header: t("columns.week"),
            cell: (row) => <span className="tabular-nums">{format.date(row.weekStart)}</span>,
          },
          { id: "orders", header: t("columns.orders"), numeric: true, cell: (row) => format.number(row.orders) },
          {
            id: "discount",
            header: t("columns.discount"),
            numeric: true,
            cell: (row) => format.thb(row.discountTotal),
          },
          { id: "getpack", header: t("columns.getpack"), numeric: true, cell: (row) => format.thb(row.getpackShare) },
          {
            id: "factory",
            header: t("columns.factory"),
            numeric: true,
            cell: (row) => (
              <span>
                {format.thb(row.factoryShare)}
                {row.factoryCount ? (
                  <span className="text-muted block text-xs">{t("factories", { count: row.factoryCount })}</span>
                ) : null}
              </span>
            ),
          },
          { id: "reversed", header: t("columns.reversed"), numeric: true, cell: (row) => format.thb(row.reversed) },
        ]}
      />
      {totals ? (
        <p className="text-muted flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm tabular-nums">
          <span>{t("totals.discount", { amount: format.thb(totals.discountTotal) })}</span>
          <span>{t("totals.getpack", { amount: format.thb(totals.getpackShare) })}</span>
          <span className="text-fg font-medium">
            {t("totals.factory", { amount: format.thb(totals.factoryShare) })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
