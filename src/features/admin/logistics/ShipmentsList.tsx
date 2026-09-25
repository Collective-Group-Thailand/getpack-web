"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { SHIPMENT_QUEUES, shipmentsList, type ShipmentRow } from "./resources";

/**
 * The logistics desk (F2 2.8, D-013, D-114): shipments by queue — waiting for pick-up, on the
 * road, exceptions (a failed attempt, an area the factory cannot serve) and PODs to review.
 */
export function ShipmentsList({ initial }: { initial: InitialPage<ShipmentRow> | null }) {
  const t = useTranslations("logistics.shipments");
  const format = useFormat();

  const columns: DataTableColumn<ShipmentRow>[] = [
    {
      id: "shipmentNo",
      header: t("columns.shipment"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/shipments/${row.id}`} className="text-primary font-mono hover:underline">
            {row.shipmentNo}
          </Link>
          <p className="text-muted text-xs">
            <Link href={`/orders/${row.order.id}`} className="hover:underline">
              {row.order.orderCode}
            </Link>
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip map={SHIPMENT_STATUS} value={row.status} />
          {row.podReview ? <StatusChip map={POD_REVIEW_STATUS} value={row.podReview} /> : null}
        </div>
      ),
    },
    {
      id: "carrier",
      header: t("columns.carrier"),
      cell: (row) => (
        <div className="text-sm">
          <Badge size="sm" tone={row.carrier === "factory_fleet" ? "neutral" : "info"}>
            {t(`carriers.${row.carrier}`)}
          </Badge>
          {row.trackingNo ? <p className="text-muted mt-1 font-mono text-xs">{row.trackingNo}</p> : null}
        </div>
      ),
    },
    {
      id: "destination",
      header: t("columns.destination"),
      cell: (row) => (
        <div className="text-sm">
          <p>{row.destination.recipientName}</p>
          <p className="text-muted text-xs">
            {row.destination.province} {row.destination.postcode}
          </p>
        </div>
      ),
    },
    {
      id: "factory",
      header: t("columns.factory"),
      cell: (row) => <span className="font-mono text-sm">{row.factory.code}</span>,
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) => t("quantity", { quantity: format.number(row.quantity), cartons: row.cartons }),
    },
    {
      id: "lastEvent",
      header: t("columns.lastEvent"),
      cell: (row) =>
        row.exception ? (
          <span className="text-danger text-sm">{row.exception}</span>
        ) : row.lastEvent ? (
          <span className="text-sm">
            <When at={row.lastEvent.occurredAt} />
            {row.lastEvent.location ? <span className="text-muted block text-xs">{row.lastEvent.location}</span> : null}
          </span>
        ) : (
          "–"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        tabs={[
          { value: null, label: t("all") },
          ...SHIPMENT_QUEUES.map((queue) => ({
            value: queue,
            label: t(`queues.${queue}`),
            ...(queue === "exceptions" ? { countKey: "logistics.exceptions" } : {}),
            ...(queue === "pod_review" ? { countKey: "logistics.pod_review" } : {}),
          })),
        ]}
      />
      <ResourceList
        resource={shipmentsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowTone={(row) => (row.exception || row.status === "failed" ? "danger" : undefined)}
        filters={[
          {
            id: "carrier",
            label: t("columns.carrier"),
            kind: "select",
            options: (["factory_fleet", "flash_express", "deliveree"] as const).map((value) => ({
              value,
              label: t(`carriers.${value}`),
            })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
