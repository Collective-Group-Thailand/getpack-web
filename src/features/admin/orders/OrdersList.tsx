"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { ARTWORK_STATUS, INSTALMENT_STATUS, ORDER_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import {
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  useSlaFormat,
  type InitialPage,
} from "../console";
import { ordersList, type OrderSummary } from "./resources";

const QUEUES = ["waiting_payment", "slip_review", "awaiting_artwork", "ready_to_produce", "due_soon", "late"] as const;

/**
 * Orders, queue first (F2 2.2, A.3 "work queues first"). Each tab is a URL — `?queue=late` can
 * be bookmarked or sent — and its count and overdue state come from the dashboard summary, so
 * the badge and the list agree with the home page.
 */
export function OrdersList({ initial }: { initial: InitialPage<OrderSummary> | null }) {
  const t = useTranslations("orders.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const canManage = useCan("orders.manage");
  const canCreate = useCan("orders.create_on_behalf");
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

  const columns: DataTableColumn<OrderSummary>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      sortable: true,
      cell: (row) => (
        <div>
          <Link
            href={`/orders/${row.id}`}
            className="text-primary font-mono text-sm font-medium whitespace-nowrap hover:underline"
          >
            {row.orderCode}
          </Link>
          <p className="text-muted text-xs whitespace-nowrap">{row.productType.name}</p>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.customer.displayName}</p>
          {row.customer.companyName ? <p className="text-muted truncate text-xs">{row.customer.companyName}</p> : null}
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) => `${format.number(row.quantity)} ${row.unit}`,
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
          {row.nextInstalment ? <StatusChip map={INSTALMENT_STATUS} value={row.nextInstalment.status} /> : null}
          {row.hasSlipToReview ? (
            <span className="text-warning-subtle-fg inline-flex items-center gap-1 text-xs font-medium">
              <Icon name="receipt" size={14} />
              {t("slipWaiting")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "factory",
      header: t("columns.factory"),
      hideable: true,
      cell: (row) => row.factory?.name ?? <span className="text-muted">{t("noFactory")}</span>,
    },
    {
      id: "promisedShipDate",
      header: t("columns.ship"),
      sortable: true,
      cell: (row) => (
        <div>
          <p>{format.date(row.promisedShipDate)}</p>
          {row.urgency !== "normal" ? (
            <p
              className={
                row.urgency === "late"
                  ? "text-danger text-xs font-medium"
                  : "text-warning-subtle-fg text-xs font-medium"
              }
            >
              {t(`urgency.${row.urgency}`)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "sla",
      header: t("columns.sla"),
      cell: (row) => (
        <SlaTimer
          dueAt={row.slaDueAt}
          format={sla}
          absolute={row.slaDueAt ? format.dateTime(row.slaDueAt) : undefined}
        />
      ),
    },
    { id: "createdAt", header: t("columns.created"), sortable: true, cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        tabs={[
          { value: null, label: t("queues.all") },
          ...QUEUES.map((queue) => ({ value: queue, label: t(`queues.${queue}`), countKey: `orders.${queue}` })),
        ]}
      />
      <ResourceList
        resource={ordersList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        exportable
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(ORDER_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
          {
            id: "channel",
            label: t("channel"),
            kind: "select",
            options: (["web", "cs", "line", "b2b"] as const).map((value) => ({ value, label: t(`channels.${value}`) })),
          },
          { id: "createdFrom", label: t("createdFrom"), kind: "date" },
          { id: "createdTo", label: t("createdTo"), kind: "date" },
        ]}
        rowTone={(row) => (row.urgency === "late" ? "danger" : row.urgency === "due_soon" ? "warning" : undefined)}
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
