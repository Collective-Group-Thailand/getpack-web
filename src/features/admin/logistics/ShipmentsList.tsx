"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { POD_REVIEW_STATUS, SHIPMENT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Badge } from "@/ui/components/Badge";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { useFactoryOptions } from "../production/factories";
import { SHIPMENT_QUEUES, SHIPMENT_STATUSES, shipmentsList, type Shipment } from "./resources";

/** Pieces in the shipment, over its items — a count, never money. */
export const piecesOf = (shipment: Pick<Shipment, "items">) =>
  shipment.items.reduce((sum, item) => sum + item.quantity, 0);

const CARRIERS = ["factory_fleet", "flash_express", "deliveree"] as const;

/** The dashboard queue each desk tab counts, where the dashboard has one. */
const QUEUE_COUNTS: Partial<Record<(typeof SHIPMENT_QUEUES)[number], string>> = {
  exceptions: "logistics.exceptions",
  pod_review: "logistics.pod_review",
};

/**
 * The logistics desk (F2 2.8, D-013, D-114, D-229, D-230): shipments by queue — awaiting pick-up,
 * on the road, exceptions, POD to review — filtered by status, carrier and factory. A row shows
 * the destination's province, the trip's note, the before-shipping hold, a failed or returned
 * trip and the POD's review state.
 */
export function ShipmentsList({ initial }: { initial: InitialPage<Shipment> | null }) {
  const t = useTranslations("logistics.shipments");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const locale = useLocale();
  const factories = useFactoryOptions();

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
          {row.splitFrom ? (
            <p className="text-muted text-xs">{t("splitFrom", { no: row.splitFrom.shipmentNo })}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip map={SHIPMENT_STATUS} value={row.status} />
          {row.podReview ? <StatusChip map={POD_REVIEW_STATUS} value={row.podReview.state} /> : null}
          {row.blockedByPayment ? (
            <Badge size="sm" tone="warning" icon="hourglass">
              {t("paymentHold")}
            </Badge>
          ) : null}
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
          {row.carrierRequest ? <p className="text-warning-subtle-fg mt-1 text-xs">{t("carrierRequested")}</p> : null}
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
            {locale === "en" ? row.destination.province.nameEn : row.destination.province.nameTh}{" "}
            {row.destination.postcode}
          </p>
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
            {row.exception?.note ? (
              <span className="text-danger block text-xs">{row.exception.note}</span>
            ) : row.note ? (
              <span className="text-warning-subtle-fg block text-xs">{row.note}</span>
            ) : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        param="queue"
        tabs={[
          { value: null, label: t("all") },
          ...SHIPMENT_QUEUES.map((queue) => ({
            value: queue,
            label: t(`queues.${queue}`),
            countKey: QUEUE_COUNTS[queue],
          })),
        ]}
      />
      <ResourceList
        resource={shipmentsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: SHIPMENT_STATUSES.map((status) => ({
              value: status,
              label: tStatus(SHIPMENT_STATUS[status].labelKey),
            })),
          },
          {
            id: "carrier",
            label: t("columns.carrier"),
            kind: "select",
            options: CARRIERS.map((carrier) => ({ value: carrier, label: t(`carriers.${carrier}`) })),
          },
          ...(factories.length
            ? [{ id: "factoryId", label: t("columns.factory"), kind: "select" as const, options: factories }]
            : []),
        ]}
        rowTone={(row) => (row.status === "failed" || row.status === "returned" ? "danger" : undefined)}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
