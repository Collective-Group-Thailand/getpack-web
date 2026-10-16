"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { INSTALMENT_STATUS, ORDER_GROUP_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";

import { Callout } from "@/ui/components/Callout";

import { adminBrowserApis, QueryError, StatusChip, useProductTypes } from "../console";
import { useGroupSchedule } from "./data";
import { GroupActions } from "./OrderExtras";

/**
 * One checkout (B3.1): its orders — one per configuration — and its payment schedule. The group
 * names its customer and who placed it (v0.5.0), and says when a slip waits for Finance.
 */
export function OrderGroup({ groupId }: { groupId: string }) {
  const t = useTranslations("orders.group");
  const tDetail = useTranslations("orders.detail");
  const format = useFormat();
  const locale = useLocale();
  const { labelOf } = useProductTypes();
  const group = useQuery({
    queryKey: queryKeys.detail("admin", "order_group", groupId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/order-groups/{groupId}", { params: { path: { groupId } } }))
        .data!,
  });
  const schedule = useGroupSchedule(group.data?.id);
  if (group.isError) return <QueryError error={group.error} onRetry={() => void group.refetch()} />;
  const data = group.data;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("orders"), href: "/orders" }, { label: data.groupCode }]}
          />
        }
        title={<span className="font-mono">{data.groupCode}</span>}
        meta={<StatusChip map={ORDER_GROUP_STATUS} value={data.status} size="md" />}
        actions={<GroupActions group={data} />}
        description={t("headline", {
          customer: data.customer.displayName,
          amount: format.thb(data.totals.grossAmount),
        })}
      />
      {data.hasSlipToReview ? <Callout tone="warning" title={t("slipWaiting")} /> : null}
      <Card padding="lg">
        <DescriptionList
          columns={3}
          items={[
            {
              term: t("customer"),
              description: (
                <Link href={`/customers/${data.customer.id}`} className="text-primary hover:underline">
                  {data.customer.displayName}
                </Link>
              ),
            },
            {
              term: t("customerCode"),
              description: <span className="font-mono">{data.customer.customerCode ?? "—"}</span>,
            },
            ...(data.customer.companyName ? [{ term: t("company"), description: data.customer.companyName }] : []),
            { term: t("placedBy"), description: data.placedBy.displayName },
            { term: t("placedAt"), description: <When at={data.placedAt} /> },
            { term: t("channel"), description: tDetail(`channels.${data.channel}`) },
            { term: t("po"), description: data.poNumber ?? "—" },
            { term: t("expiresAt"), description: <When at={data.expiresAt} absoluteOnly /> },
            {
              term: t("total"),
              description: <span className="tabular-nums">{format.thb(data.totals.grossAmount)}</span>,
            },
          ]}
        />
      </Card>
      <DataTable
        caption={t("ordersTitle")}
        showCaption
        rows={data.orders}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "orderCode",
            header: t("order"),
            cell: (row) => (
              <Link href={`/orders/${row.id}`} className="text-primary font-mono hover:underline">
                {row.orderCode}
              </Link>
            ),
          },
          { id: "product", header: t("product"), cell: (row) => labelOf(row.productTypeCode) },
          { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.totals.grossAmount) },
          { id: "status", header: t("status"), cell: (row) => <StatusChip map={ORDER_STATUS} value={row.status} /> },
        ]}
      />
      <Card padding="lg">
        <CardHeader>
          <CardTitle>{t("schedule")}</CardTitle>
        </CardHeader>
        <DataTable
          caption={t("schedule")}
          rows={schedule.data?.instalments ?? []}
          loading={schedule.isPending}
          getRowId={(row) => row.id}
          density="compact"
          columns={[
            {
              id: "label",
              header: t("instalment"),
              cell: (row) => (locale === "en" ? row.labelEn : row.labelTh),
            },
            { id: "gross", header: t("amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
            { id: "paid", header: t("paid"), numeric: true, cell: (row) => format.thb(row.paidAmount) },
            {
              id: "status",
              header: t("status"),
              cell: (row) => <StatusChip map={INSTALMENT_STATUS} value={row.status} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
