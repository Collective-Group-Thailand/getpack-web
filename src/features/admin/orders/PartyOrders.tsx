"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";

import { adminBrowserApis, QueryError, StatusChip, useProductTypes } from "../console";
import type { Order, OrderGroup } from "./resources";

type Row = { order: Order; group: OrderGroup };

/**
 * The orders of one customer, newest first — the "orders" tab of the customer screen (F2 2.7).
 *
 * The published contract has no orders filter by customer or company (CONTRACT-GAP admin.orders).
 * The group list's `q` matches a customer code, so a customer's orders are its groups' orders,
 * kept to the groups that are really theirs. A company's orders cannot be listed yet.
 */
export function PartyOrders({
  customer,
  companyId,
}: {
  customer?: { id: string; customerCode: string | null };
  companyId?: string;
}) {
  const t = useTranslations("orders.party");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const code = customer?.customerCode ?? null;
  const groups = useQuery({
    queryKey: queryKeys.list("admin", "order_group", { q: code, perPage: 50 }),
    enabled: Boolean(code),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/order-groups", {
          params: { query: { q: code!, perPage: 50 } },
        })
      ).data!,
  });
  if (companyId || !code)
    return <EmptyState icon="package" title={t("unavailable")} description={t("unavailableBody")} />;
  if (groups.isError) return <QueryError error={groups.error} onRetry={() => void groups.refetch()} />;

  const rows: Row[] = (groups.data?.data ?? [])
    .filter((group) => group.customerId === customer!.id)
    .flatMap((group) => group.orders.map((order) => ({ order, group })));

  const columns: DataTableColumn<Row>[] = [
    {
      id: "orderCode",
      header: t("order"),
      cell: ({ order }) => (
        <Link href={`/orders/${order.id}`} className="text-primary font-mono hover:underline">
          {order.orderCode}
        </Link>
      ),
    },
    { id: "productType", header: t("productType"), cell: ({ order }) => labelOf(order.productTypeCode) },
    { id: "status", header: t("status"), cell: ({ order }) => <StatusChip map={ORDER_STATUS} value={order.status} /> },
    { id: "amount", header: t("amount"), numeric: true, cell: ({ order }) => format.thb(order.totals.grossAmount) },
    { id: "created", header: t("created"), cell: ({ group }) => <When at={group.placedAt} /> },
  ];

  return (
    <DataTable
      caption={t("title")}
      columns={columns}
      rows={rows}
      getRowId={({ order }) => order.id}
      loading={groups.isPending}
      density="compact"
      empty={<EmptyState icon="package" title={t("empty")} />}
    />
  );
}
