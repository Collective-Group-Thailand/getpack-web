"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { ARTWORK_STATUS, DESIGN_SERVICE_STATUS, JOB_STATUS, PREFLIGHT_STATUS, PROOF_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { cn } from "@/ui/lib/cn";

import {
  QueueTabs,
  ResourceList,
  StatusChip,
  useActor,
  useProductTypes,
  useSlaFormat,
  type InitialPage,
} from "../console";
import { PREPRESS_QUEUES, prepressList, type PrepressItem } from "./resources";

const COUNTED = new Set<string>(["preflight", "proof", "changes_requested", "template", "design"]);

/**
 * The prepress desk (F2 2.4): orders by the stage prepress owes them — a preflight to review,
 * a proof to prepare, changes the customer asked for, a template to send, a design round, a
 * mockup — each with the stage's SLA timer. Proofs with the customer are listed for follow-up
 * but wait on the customer, so their timer does not tint the row.
 */
export function PrepressList({ initial }: { initial: InitialPage<PrepressItem> | null }) {
  const t = useTranslations("prepress.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const productTypes = useProductTypes();

  const columns: DataTableColumn<PrepressItem>[] = [
    {
      id: "orderCode",
      header: t("columns.order"),
      sortable: true,
      cell: (row) => (
        <div>
          <Link
            href={`/prepress/${row.orderId}`}
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
      cell: (row) => <p className="max-w-56 truncate">{row.customer.displayName}</p>,
    },
    {
      id: "stage",
      header: t("columns.stage"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm font-medium whitespace-nowrap">{t(`queues.${row.stage}`)}</span>
          <StatusChip map={ARTWORK_STATUS} value={row.artworkStatus} />
        </div>
      ),
    },
    {
      id: "progress",
      header: t("columns.progress"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1 text-xs">
          {row.latestSubmission ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              {t("fileVersion", { version: row.latestSubmission.versionNo })}
              <StatusChip map={PREFLIGHT_STATUS} value={row.latestSubmission.preflightStatus} />
            </span>
          ) : null}
          {row.latestProof ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              {t("proofVersion", { version: row.latestProof.versionNo })}
              <StatusChip map={PROOF_STATUS} value={row.latestProof.status} />
            </span>
          ) : null}
          {row.design ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              {t("designRound", { round: row.design.roundNo, free: row.design.freeRounds })}
              <StatusChip map={DESIGN_SERVICE_STATUS} value={row.design.status} />
            </span>
          ) : null}
          {row.mockup ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              {t("mockup")}
              <StatusChip map={JOB_STATUS} value={row.mockup.status} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "slaDueAt",
      header: t("columns.sla"),
      sortable: true,
      cell: (row) =>
        row.stage === "awaiting_customer" ? (
          <span className="text-muted text-xs">{t("withCustomer")}</span>
        ) : (
          <SlaTimer
            dueAt={row.slaDueAt}
            format={sla}
            absolute={row.slaDueAt ? format.dateTime(row.slaDueAt) : undefined}
          />
        ),
    },
    {
      id: "assignee",
      header: t("columns.assignee"),
      hideable: true,
      cell: (row) =>
        row.assignee ? (
          <span
            className={cn("block max-w-40 truncate", row.assignee.id === actor.id && "font-medium")}
            title={row.assignee.displayName}
          >
            {row.assignee.id === actor.id ? t("you") : row.assignee.displayName}
          </span>
        ) : (
          <span className="text-warning-subtle-fg text-xs font-medium">{t("unassigned")}</span>
        ),
    },
    { id: "updatedAt", header: t("columns.updated"), hideable: true, cell: (row) => <When at={row.updatedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        tabs={[
          { value: null, label: t("queues.all") },
          ...PREPRESS_QUEUES.map((queue) => ({
            value: queue,
            label: t(`queues.${queue}`),
            ...(COUNTED.has(queue) ? { countKey: `prepress.${queue}` } : {}),
          })),
        ]}
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
            id: "artworkStatus",
            label: t("artworkStatus"),
            kind: "select",
            options: Object.entries(ARTWORK_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
          ...(productTypes.options.length > 0
            ? [{ id: "productType", label: t("productType"), kind: "select" as const, options: productTypes.options }]
            : []),
        ]}
        rowTone={(row) =>
          row.stage === "awaiting_customer"
            ? undefined
            : row.urgency === "late"
              ? "danger"
              : row.urgency === "due_soon"
                ? "warning"
                : undefined
        }
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
