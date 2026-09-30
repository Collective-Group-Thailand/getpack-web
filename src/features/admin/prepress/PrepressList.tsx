"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { PREFLIGHT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";

import { QueueTabs, ResourceList, StatusChip, useSlaFormat, type InitialPage } from "../console";
import { PREPRESS_QUEUES, prepressList, type PrepressQueueItem } from "./resources";

/**
 * The prepress desk (F2 2.4): packio-api's three queues — files to review (preflighted, oldest
 * first), proofs the customer sent back, proofs with the customer — each row with the prepress SLA
 * the API computes on the business calendar (D-175). Proofs with the customer wait on the customer,
 * so they carry no due time and never tint the row.
 *
 * CONTRACT-GAP admin.prepress — the rows are lean: no customer, product type, artwork status,
 * latest proof, design round, mockup or assignee, and the template and design stages are not
 * queues of their own. What a row lost is on the order's workspace.
 */
export function PrepressList({ initial }: { initial: InitialPage<PrepressQueueItem> | null }) {
  const t = useTranslations("prepress.list");
  const format = useFormat();
  const sla = useSlaFormat();

  const columns: DataTableColumn<PrepressQueueItem>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      cell: (row) => (
        <Link
          href={`/prepress/${row.orderId}${row.kind === "submissions" ? "" : "?tab=proofs"}`}
          className="text-primary font-mono text-sm font-medium whitespace-nowrap hover:underline"
        >
          {row.orderCode}
        </Link>
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
        rowTone={(row) => (row.kind !== "proofs_waiting" && row.overdue ? "danger" : undefined)}
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
