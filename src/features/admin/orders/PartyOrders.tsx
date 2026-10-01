"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ARTWORK_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";

import { adminBrowserApis, QueryError, StatusChip, useProductTypes } from "../console";
import type { OrderListItem } from "./resources";

/**
 * The orders of one customer or one company, newest placed first — the "orders" tab of the
 * customer and company screens (F2 2.7), from `admin.orders.list?customerId` / `?companyId`
 * (v0.5.0). The latest 50; the order desk's "all orders" tab pages through the rest.
 */
export function PartyOrders({ customer, companyId }: { customer?: { id: string }; companyId?: string }) {
  const t = useTranslations("orders.party");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const party = customer ? { customerId: customer.id } : companyId ? { companyId } : null;
  const orders = useQuery({
    queryKey: queryKeys.list("admin", "order", { ...party, perPage: 50 }),
    enabled: Boolean(party),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/orders", { params: { query: { ...party, perPage: 50 } } }))
        .data!,
  });
  if (orders.isError) return <QueryError error={orders.error} onRetry={() => void orders.refetch()} />;

  const columns: DataTableColumn<OrderListItem>[] = [
    {
      id: "orderCode",
      header: t("order"),
      cell: (row) => (
        <Link href={`/orders/${row.orderId}`} className="text-primary font-mono hover:underline">
          {row.orderCode}
        </Link>
      ),
    },
    // A company's orders are its members' (D-120): say who placed each.
    ...(companyId
      ? [{ id: "customer", header: t("placedBy"), cell: (row: OrderListItem) => row.customer.displayName }]
      : []),
    { id: "productType", header: t("productType"), cell: (row) => labelOf(row.productTypeCode) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusChip map={ORDER_STATUS} value={row.status} />
          <StatusChip map={ARTWORK_STATUS} value={row.artworkStatus} />
          {row.hasSlipToReview ? (
            <Badge size="sm" tone="warning" icon="receipt">
              {t("slipWaiting")}
            </Badge>
          ) : null}
        </div>
      ),
    },
    { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "created", header: t("created"), cell: (row) => <When at={row.placedAt} /> },
  ];

  return (
    <DataTable
      caption={t("title")}
      columns={columns}
      rows={orders.data?.data ?? []}
      getRowId={(row) => row.orderId}
      loading={orders.isPending}
      density="compact"
      empty={<EmptyState icon="package" title={t("empty")} />}
    />
  );
}
