"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ARTWORK_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { toast } from "@/ui/components/Toast";

import {
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  useProductTypes,
  type InitialPage,
} from "../console";
import { ORDER_QUEUES, ordersList, type OrderQueueItem } from "./resources";

/**
 * Orders, queue first (F2 2.2, A.3 "work queues first"). Each tab is a URL — `?queue=late` can
 * be bookmarked or sent — and its count and overdue state come from the dashboard summary, so
 * the badge and the list agree with the home page.
 *
 * The queues are packio-api's (`admin.orderOperations.queue`). Slips waiting for review are the
 * Finance slip queue, not an order queue. The published row carries no quantity, factory, next
 * instalment, urgency or SLA timer, and a queue filters by nothing but `q` (CONTRACT-GAP
 * admin.orders).
 */
export function OrdersList({ initial }: { initial: InitialPage<OrderQueueItem> | null }) {
  const t = useTranslations("orders.list");
  const format = useFormat();
  const { labelOf } = useProductTypes();
  const canManage = useCan("orders.manage");
  const canCreate = useCan("carts.manage_on_behalf");
  const queryClient = useQueryClient();

  const remind = useMutation({
    mutationFn: (orderIds: string[]) =>
      browserRequests().call("POST /v1/admin/orders/actions/send-payment-reminders", { body: { orderIds } }),
    onSuccess: (result) => {
      toast.success(t("remindersSent", { count: result.sent }));
      if (result.skipped.length > 0) toast.warning(t("remindersSkipped", { count: result.skipped.length }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
    },
    onError: (error) => toast.error(problemMessage(error, t("remindersFailed"))),
  });

  const columns: DataTableColumn<OrderQueueItem>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      sortable: true,
      cell: (row) => (
        <div>
          <Link
            href={`/orders/${row.orderId}`}
            className="text-primary font-mono text-sm font-medium whitespace-nowrap hover:underline"
          >
            {row.orderCode}
          </Link>
          <p className="text-muted text-xs whitespace-nowrap">{labelOf(row.productTypeCode)}</p>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => <p className="truncate">{row.customerName}</p>,
    },
    {
      id: "grossAmount",
      header: t("columns.amount"),
      numeric: true,
      sortable: true,
      cell: (row) => format.thb(row.grossAmount),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusChip map={ORDER_STATUS} value={row.status} />
          <StatusChip map={ARTWORK_STATUS} value={row.artworkStatus} />
        </div>
      ),
    },
    {
      id: "promisedShipDate",
      header: t("columns.ship"),
      sortable: true,
      cell: (row) => format.date(row.promisedShipDate),
    },
    {
      id: "groupExpiresAt",
      header: t("columns.expires"),
      hideable: true,
      cell: (row) => (row.groupExpiresAt ? <When at={row.groupExpiresAt} /> : "–"),
    },
    { id: "placedAt", header: t("columns.created"), sortable: true, cell: (row) => <When at={row.placedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        tabs={[
          // No `?queue=` is the first queue, so the desk opens on it.
          ...ORDER_QUEUES.map((queue, index) => ({
            value: index === 0 ? null : queue,
            label: t(`queues.${queue}`),
            countKey: `orders.${queue}`,
          })),
        ]}
      />
      <ResourceList
        resource={ordersList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        bulkActions={
          canManage
            ? (ids, clear) => (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="send"
                  loading={remind.isPending}
                  onClick={() => remind.mutate(ids, { onSuccess: clear })}
                >
                  {t("sendReminders")}
                </Button>
              )
            : undefined
        }
        toolbarEnd={
          canCreate ? (
            <Button size="sm" iconStart="plus" asChild>
              <Link href="/cs">{t("create")}</Link>
            </Button>
          ) : null
        }
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
