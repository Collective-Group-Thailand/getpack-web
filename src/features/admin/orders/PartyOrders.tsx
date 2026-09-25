"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";

import { QueryError, StatusChip, useProductTypes } from "../console";
import type { OrderSummary } from "./resources";

/**
 * The orders of one customer or one company, newest first — the "orders" tab of the customer
 * and company screens (F2 2.7). The full list with filters is the orders desk; this links there.
 */
export function PartyOrders({ customerId, companyId }: { customerId?: string; companyId?: string }) {
  const t = useTranslations("orders.party");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const orders = useQuery({
    queryKey: queryKeys.list("admin", "order", { customerId, companyId, perPage: 50 }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/orders", {
        query: { customerId, companyId, perPage: 50, sort: "createdAt", order: "desc" },
      }),
  });
  if (orders.isError) return <QueryError error={orders.error} onRetry={() => void orders.refetch()} />;

  const columns: DataTableColumn<OrderSummary>[] = [
    {
      id: "orderCode",
      header: t("order"),
      cell: (row) => (
        <Link href={`/orders/${row.id}`} className="text-primary font-mono hover:underline">
          {row.orderCode}
        </Link>
      ),
    },
    { id: "productType", header: t("productType"), cell: (row) => labelOf(row.productType.code) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={ORDER_STATUS} value={row.status} /> },
    { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    ...(companyId
      ? [{ id: "customer", header: t("placedBy"), cell: (row: OrderSummary) => row.customer.displayName }]
      : []),
    { id: "createdAt", header: t("created"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <DataTable
      caption={t("title")}
      columns={columns}
      rows={orders.data?.data ?? []}
      getRowId={(row) => row.id}
      loading={orders.isPending}
      density="compact"
      empty={<EmptyState icon="package" title={t("empty")} />}
    />
  );
}
