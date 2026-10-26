"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { ARTWORK_STATUS, PREFLIGHT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";

import {
  QueueTabs,
  ResourceList,
  StatusChip,
  useActor,
  useProductTypes,
  useSlaFormat,
  type InitialPage,
} from "../console";
import { PREPRESS_QUEUES, prepressList, type PrepressQueueItem } from "./resources";

/**
 * The prepress desk (F2 2.4): getpack-api's three queues — files to review (preflighted, oldest
 * first), proofs the customer sent back, proofs with the customer — each row with the prepress SLA
 * the API computes on the business calendar (D-175). Proofs with the customer wait on the customer,
 * so they carry no due time and never tint the row.
 *
 * Each row names the customer, the product type, the order's artwork status and its owner.
 * CONTRACT-GAP admin.prepress — no latest proof, design round or mockup on a row, and the template
 * and design stages are not queues of their own; they are on the order's workspace.
 */
export function PrepressList({ initial }: { initial: InitialPage<PrepressQueueItem> | null }) {
  const t = useTranslations("prepress.list");
  const format = useFormat();
  const sla = useSlaFormat();
  const tStatus = useTranslations("status");
  const actor = useActor();
  const productTypes = useProductTypes();

  const columns: DataTableColumn<PrepressQueueItem>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      cell: (row) => (
        <Link
          href={`/prepress/${row.orderId}${row.kind === "submissions" ? "" : "?tab=proofs"}`}
          className="text-primary text-sm font-medium whitespace-nowrap tabular-nums hover:underline"
        >
          {row.orderCode}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.customer.displayName}</p>
          <p className="text-muted truncate text-xs">{productTypes.labelOf(row.productTypeCode)}</p>
        </div>
      ),
    },
    {
      id: "stage",
      header: t("columns.stage"),
      cell: (row) => <span className="text-sm font-medium whitespace-nowrap">{t(`queues.${row.kind}`)}</span>,
    },
    {
      id: "progress",
      header: t("columns.progress"),
      cell: (row) =>
        row.kind === "submissions" ? (
          <span className="flex items-center gap-1 text-xs whitespace-nowrap">
            {t("fileVersion", { version: row.versionNo })}
            {row.preflightStatus ? <StatusChip map={PREFLIGHT_STATUS} value={row.preflightStatus} /> : null}
          </span>
        ) : (
          <span className="text-xs whitespace-nowrap">{t("proofVersion", { version: row.versionNo })}</span>
        ),
    },
    {
      id: "artworkStatus",
      header: t("columns.artwork"),
      cell: (row) => <StatusChip map={ARTWORK_STATUS} value={row.artworkStatus} />,
    },
    {
      id: "assignee",
      header: t("columns.assignee"),
      hideable: true,
      cell: (row) =>
        row.assignee ? (
          <span className="block max-w-40 truncate" title={row.assignee.displayName}>
            {row.assignee.id === actor.id ? t("you") : row.assignee.displayName}
          </span>
        ) : (
          <span className="text-warning-subtle-fg text-xs font-medium">{t("unassigned")}</span>
        ),
    },
    { id: "since", header: t("columns.since"), cell: (row) => <When at={row.since} /> },
    {
      id: "dueAt",
      header: t("columns.sla"),
      cell: (row) =>
        row.kind === "proofs_waiting" ? (
          <span className="text-muted text-xs">{t("withCustomer")}</span>
        ) : row.dueAt ? (
          <SlaTimer dueAt={row.dueAt} format={sla} absolute={format.dateTime(row.dueAt)} />
        ) : (
          <span className="text-muted text-xs">{t("noSla")}</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        param="kind"
        tabs={
          // No `?kind=` is the first queue, so the desk opens on it.
          PREPRESS_QUEUES.map((kind, index) => ({
            value: index === 0 ? null : kind,
            label: t(`queues.${kind}`),
            countKey: `prepress.${kind}`,
          }))
        }
      />
      <ResourceList
        resource={prepressList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          {
            id: "assigneeId",
            label: t("columns.assignee"),
            kind: "select",
            options: [
              { value: actor.id, label: t("mine") },
              { value: "none", label: t("unassigned") },
            ],
          },
          ...(productTypes.options.length > 0
            ? [
                {
                  id: "productTypeCode",
                  label: t("productType"),
                  kind: "select" as const,
                  options: productTypes.options,
                },
              ]
            : []),
          {
            id: "artworkStatus",
            label: t("columns.artwork"),
            kind: "select",
            options: Object.entries(ARTWORK_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
        ]}
        rowTone={(row) => (row.kind !== "proofs_waiting" && row.overdue ? "danger" : undefined)}
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
