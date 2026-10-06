"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ARTWORK_STATUS, ORDER_STATUS, statusMeta } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import {
  adminBrowserApis,
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  useProductTypes,
  useSlaFormat,
  type FilterDef,
  type InitialPage,
} from "../console";
import {
  ALL_ORDERS,
  allOrdersList,
  ORDER_QUEUES,
  ordersList,
  type OrderListItem,
  type OrderQueueItem,
} from "./resources";

export type OrdersInitial =
  | { view: "queue"; page: InitialPage<OrderQueueItem> | null }
  | { view: "all"; page: InitialPage<OrderListItem> | null };

/**
 * Orders, queue first (F2 2.2, A.3 "work queues first"). Each tab is a URL — `?queue=late` can
 * be bookmarked or sent — and its count and overdue state come from the dashboard summary, so
 * the badge and the list agree with the home page.
 *
 * The queues are packio-api's (`admin.orderOperations.queue`); slips waiting for review are the
 * Finance slip queue, not an order queue. The last tab is every order (`admin.orders.list`), with
 * the desk's filters and the richer row: customer and factory, quantity, the group's next
 * instalment and a slip waiting for Finance with its review deadline. A queue row is lean, and no
 * row says how urgent the order is (CONTRACT-GAP admin.orders: order `urgency` is left out until an
 * order SLA is decided); the queue itself is the SLA order.
 */
export function OrdersList({ initial }: { initial: OrdersInitial }) {
  const t = useTranslations("orders.list");
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
          { value: ALL_ORDERS, label: t("queues.all") },
        ]}
      />
      {initial.view === "all" ? <AllOrders initial={initial.page} /> : <QueueOrders initial={initial.page} />}
    </div>
  );
}

/**
 * Reminds the customers of the chosen orders (`admin.orders.sendPaymentReminders`; packio-api
 * sends one per group per hour and lists the ones it refused). One key per selection, so pressing
 * again for the same rows after a timeout replays the request rather than reminding twice.
 */
function ReminderButton({ ids, clear }: { ids: string[]; clear: () => void }) {
  const t = useTranslations("orders.list");
  const tProblems = useTranslations("problems");
  const queryClient = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const remind = useMutation({
    mutationFn: async () => {
      const selection = [...ids].sort().join(",");
      const key = keys.current.get(selection) ?? newIdempotencyKey();
      keys.current.set(selection, key);
      return (
        await adminBrowserApis().contract.POST("/v1/admin/orders/actions/send-payment-reminders", {
          params: { header: { "Idempotency-Key": key } },
          body: { orderIds: ids },
        })
      ).data!;
    },
    onSuccess: (result) => {
      toast.success(t("remindersSent", { count: result.sent }));
      if (result.skipped.length > 0) {
        // Each refusal is a problem code (`payments.nothing_due`, `payments.reminder_recent`).
        const reasons = [...new Set(result.skipped.map((skip) => skip.reason))].map((reason) =>
          tProblems.has(reason) ? tProblems(reason) : reason,
        );
        toast.warning(t("remindersSkipped", { count: result.skipped.length }), { description: reasons.join(" · ") });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
      clear();
    },
    onError: (error) => toast.error(problemMessage(error, t("remindersFailed"))),
  });
  return (
    <Button size="sm" variant="secondary" iconStart="send" loading={remind.isPending} onClick={() => remind.mutate()}>
      {t("sendReminders")}
    </Button>
  );
}

function CreateButton() {
  const t = useTranslations("orders.list");
  const canCreate = useCan("carts.manage_on_behalf");
  return canCreate ? (
    <Button size="sm" iconStart="plus" asChild>
      <Link href="/cs">{t("create")}</Link>
    </Button>
  ) : null;
}

function OrderCode({
  orderId,
  orderCode,
  productTypeCode,
}: {
  orderId: string;
  orderCode: string;
  productTypeCode: string;
}) {
  const { labelOf } = useProductTypes();
  return (
    <div>
      <Link
        href={`/orders/${orderId}`}
        className="text-primary font-mono text-sm font-medium whitespace-nowrap hover:underline"
      >
        {orderCode}
      </Link>
      <p className="text-muted text-xs whitespace-nowrap">{labelOf(productTypeCode)}</p>
    </div>
  );
}

function QueueOrders({ initial }: { initial: InitialPage<OrderQueueItem> | null }) {
  const t = useTranslations("orders.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canManage = useCan("orders.manage");

  const columns: DataTableColumn<OrderQueueItem>[] = [
    { id: "orderCode", header: t("columns.order"), sortable: true, cell: (row) => <OrderCode {...row} /> },
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
      // One chip; the artwork's own state is the sub-status, on hover and for screen readers
      // (UX audit: "chip เดียว + sub-status เป็น tooltip").
      cell: (row) => {
        const artwork = statusMeta(ARTWORK_STATUS, row.artworkStatus);
        return (
          <span title={`${t("artworkStatus")}: ${tStatus(artwork.labelKey)}`}>
            <StatusChip map={ORDER_STATUS} value={row.status} />
            <span className="sr-only">
              {" "}
              {t("artworkStatus")}: {tStatus(artwork.labelKey)}
            </span>
          </span>
        );
      },
    },
    {
      id: "promisedShipDate",
      header: t("columns.ship"),
      sortable: true,
      cell: (row) => <DueDate date={row.promisedShipDate} />,
    },
    {
      id: "groupExpiresAt",
      header: t("columns.expires"),
      hideable: true,
      cell: (row) => (row.groupExpiresAt ? <When at={row.groupExpiresAt} /> : "–"),
    },
    {
      id: "placedAt",
      header: t("columns.created"),
      sortable: true,
      hideable: true,
      cell: (row) => <When at={row.placedAt} />,
    },
  ];

  return (
    <ResourceList
      resource={ordersList}
      exportResource="orders"
      columns={columns}
      caption={t("title")}
      initial={initial}
      searchLabel={t("search")}
      searchPlaceholder={t("searchPlaceholder")}
      bulkActions={canManage ? (ids, clear) => <ReminderButton ids={ids} clear={clear} /> : undefined}
      toolbarEnd={<CreateButton />}
      rowHref={(row) => `/orders/${row.orderId}`}
      empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
    />
  );
}

/**
 * A promised date on one line — "20 ต.ค." in the current year — coloured as it nears: amber within
 * three days, red once it has passed (UX audit, /orders).
 */
function DueDate({ date }: { date: string | null }) {
  const format = useFormat();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  if (!date) return <span className="text-muted">–</span>;
  const days = Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        days < 0 ? "text-danger-subtle-fg font-semibold" : days <= 3 ? "text-warning-subtle-fg font-medium" : undefined,
      )}
      title={format.date(date, { style: "long" })}
    >
      {format.date(date, { style: date.slice(0, 4) === today.slice(0, 4) ? "dayMonth" : "short" })}
    </span>
  );
}

function AllOrders({ initial }: { initial: InitialPage<OrderListItem> | null }) {
  const t = useTranslations("orders.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const { options: productTypes } = useProductTypes();
  const canManage = useCan("orders.manage");

  const filters: FilterDef[] = [
    {
      id: "status",
      label: t("columns.status"),
      kind: "select",
      options: Object.entries(ORDER_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
    },
    {
      id: "artworkStatus",
      label: t("artworkStatus"),
      kind: "select",
      options: Object.entries(ARTWORK_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
    },
    {
      id: "channel",
      label: t("channel"),
      kind: "select",
      options: (["web", "cs", "line", "b2b"] as const).map((value) => ({ value, label: t(`channels.${value}`) })),
    },
    ...(productTypes.length > 0
      ? [{ id: "productTypeCode", label: t("productType"), kind: "select" as const, options: productTypes }]
      : []),
    { id: "placedFrom", label: t("createdFrom"), kind: "date" },
    { id: "placedTo", label: t("createdTo"), kind: "date" },
  ];

  const columns: DataTableColumn<OrderListItem>[] = [
    { id: "orderCode", header: t("columns.order"), cell: (row) => <OrderCode {...row} /> },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.customer.displayName}</p>
          <p className="text-muted truncate text-xs">
            {[row.customer.customerCode, row.customer.companyName].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) =>
        t("quantityValue", {
          quantity: format.number(row.quantity),
          unit: t.has(`units.${row.unit}`) ? t(`units.${row.unit}`) : row.unit,
        }),
    },
    { id: "grossAmount", header: t("columns.amount"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    {
      id: "status",
      header: t("columns.status"),
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
    {
      id: "nextInstalment",
      header: t("columns.nextInstalment"),
      cell: (row) =>
        row.nextInstalment ? (
          <div className="text-sm">
            <p className="tabular-nums">
              {t("instalmentValue", {
                seq: row.nextInstalment.seq,
                amount: format.thb(row.nextInstalment.openAmount),
              })}
            </p>
            {row.nextInstalment.dueAt ? (
              <p className="text-muted text-xs">
                <When at={row.nextInstalment.dueAt} absoluteOnly />
              </p>
            ) : null}
          </div>
        ) : (
          "–"
        ),
    },
    {
      id: "slipReviewDueAt",
      header: t("columns.sla"),
      cell: (row) =>
        row.slipReviewDueAt ? (
          <SlaTimer dueAt={row.slipReviewDueAt} format={sla} absolute={format.dateTime(row.slipReviewDueAt)} />
        ) : (
          "–"
        ),
    },
    {
      id: "factory",
      header: t("columns.factory"),
      hideable: true,
      cell: (row) => (row.factory ? <span title={row.factory.name}>{row.factory.code}</span> : t("noFactory")),
    },
    {
      id: "promisedShipDate",
      header: t("columns.ship"),
      hideable: true,
      cell: (row) => format.date(row.promisedShipDate),
    },
    { id: "channel", header: t("channel"), hideable: true, cell: (row) => t(`channels.${row.channel}`) },
    { id: "placedAt", header: t("columns.created"), cell: (row) => <When at={row.placedAt} /> },
  ];

  return (
    <ResourceList
      resource={allOrdersList}
      exportResource="orders"
      columns={columns}
      caption={t("title")}
      initial={initial}
      filters={filters}
      searchLabel={t("search")}
      searchPlaceholder={t("searchPrefix")}
      rowTone={(row) => (row.hasSlipToReview ? "warning" : undefined)}
      bulkActions={canManage ? (ids, clear) => <ReminderButton ids={ids} clear={clear} /> : undefined}
      toolbarEnd={<CreateButton />}
      empty={{ title: t("emptyAllTitle"), description: t("emptyAllBody") }}
    />
  );
}
