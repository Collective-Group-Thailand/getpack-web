"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { SHIPMENT_STATUSES, shipmentsList, type Shipment } from "./resources";

/** Pieces in the shipment, over its items — a count, never money. */
export const piecesOf = (shipment: Pick<Shipment, "items">) =>
  shipment.items.reduce((sum, item) => sum + item.quantity, 0);

/**
 * The logistics desk (F2 2.8, D-013, D-114): shipments by status. The published list has no
 * queues (awaiting pick-up, exceptions, POD review), no carrier or factory filter, no exception
 * text or POD review state and no province on the destination (CONTRACT-GAP admin.shipments), so
 * the tabs are the statuses and the row shows the shipment's own note.
 */
export function ShipmentsList({ initial }: { initial: InitialPage<Shipment> | null }) {
  const t = useTranslations("logistics.shipments");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<Shipment>[] = [
    {
      id: "shipmentNo",
      header: t("columns.shipment"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/shipments/${row.id}`} className="text-primary font-mono hover:underline">
            {row.shipmentNo}
          </Link>
          <p className="text-muted text-xs">{[...new Set(row.items.map((item) => item.orderCode))].join(", ")}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={SHIPMENT_STATUS} value={row.status} />,
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
          <p className="text-muted text-xs">{row.destination.postcode}</p>
        </div>
      ),
    },
    {
      id: "factory",
      header: t("columns.factory"),
      cell: (row) => <span className="font-mono text-sm">{row.factoryCode}</span>,
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      numeric: true,
      cell: (row) => t("quantity", { quantity: format.number(piecesOf(row)), cartons: row.cartonsCount }),
    },
    {
      id: "lastEvent",
      header: t("columns.lastEvent"),
      cell: (row) => {
        const last = row.events.at(-1);
        return (
          <span className="text-sm">
            {last ? <When at={last.occurredAt} /> : "–"}
            {last?.location ? <span className="text-muted block text-xs">{last.location}</span> : null}
            {row.note ? <span className="text-warning-subtle-fg block text-xs">{row.note}</span> : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...SHIPMENT_STATUSES.map((status) => ({ value: status, label: tStatus(SHIPMENT_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={shipmentsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        rowTone={(row) => (row.status === "failed" || row.status === "returned" ? "danger" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
