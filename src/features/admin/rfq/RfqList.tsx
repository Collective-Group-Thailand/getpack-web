"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { RFQ_STATUS, RFQ_QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Icon } from "@/ui/icons";
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
import { RFQ_QUEUES, rfqList, type RfqSummary } from "./resources";

const COUNTED = new Set<string>(["new", "mine", "awaiting_factory", "overdue"]);

/**
 * The RFQ desk (F2 2.3, D-100): queues first, each a URL with its SLA state. The SLA belongs to
 * the category — each row says its target in business hours and runs a timer to the deadline
 * the API computed, until the first response stops it.
 */
export function RfqList({ initial }: { initial: InitialPage<RfqSummary> | null }) {
  const t = useTranslations("rfq.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const productTypes = useProductTypes();

  const columns: DataTableColumn<RfqSummary>[] = [
    {
      id: "rfqCode",
      header: t("columns.rfq"),
      sortable: true,
      cell: (row) => (
        <div>
          <Link
            href={`/rfq/${row.id}`}
            className="text-primary font-mono text-sm font-medium whitespace-nowrap hover:underline"
          >
            {row.rfqCode}
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
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusChip map={RFQ_STATUS} value={row.status} />
          {row.latestQuote ? <StatusChip map={RFQ_QUOTE_STATUS} value={row.latestQuote.status} /> : null}
          {row.routedFromCalculator ? (
            <span className="text-muted inline-flex items-center gap-1 text-xs">
              <Icon name="calculator" size={14} />
              {t("routed")}
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
        row.firstResponseAt ? (
          <span className="text-muted text-xs">
            {t(
              row.slaDueAt && Date.parse(row.firstResponseAt) > Date.parse(row.slaDueAt)
                ? "respondedLate"
                : "respondedInTime",
            )}
          </span>
        ) : (
          <div>
            <SlaTimer
              dueAt={row.slaDueAt}
              format={sla}
              absolute={row.slaDueAt ? format.dateTime(row.slaDueAt) : undefined}
            />
            <p className="text-muted text-xs whitespace-nowrap">{t("slaTarget", { hours: row.slaTargetHours })}</p>
          </div>
        ),
    },
    {
      id: "quantities",
      header: t("columns.quantities"),
      numeric: true,
      cell: (row) => (
        <span className="whitespace-nowrap">
          {row.quantities.map((quantity) => format.number(quantity)).join(" / ")}
        </span>
      ),
    },
    {
      id: "factories",
      header: t("columns.factories"),
      cell: (row) =>
        row.consultationCounts.requested + row.consultationCounts.responded === 0 ? (
          <span className="text-muted">{t("noConsultations")}</span>
        ) : (
          <span className="text-sm whitespace-nowrap">
            {t("consultations", {
              responded: row.consultationCounts.responded,
              total: row.consultationCounts.requested + row.consultationCounts.responded,
            })}
          </span>
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
    {
      id: "targetDate",
      header: t("columns.target"),
      sortable: true,
      hideable: true,
      cell: (row) => (
        <div>
          <p>{row.targetDate ? format.date(row.targetDate) : t("noTarget")}</p>
          {row.province ? <p className="text-muted text-xs">{row.province}</p> : null}
        </div>
      ),
    },
    { id: "submittedAt", header: t("columns.submitted"), sortable: true, cell: (row) => <When at={row.submittedAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("queuesLabel")}
        tabs={[
          { value: null, label: t("queues.all") },
          ...RFQ_QUEUES.map((queue) => ({
            value: queue,
            label: t(`queues.${queue}`),
            ...(COUNTED.has(queue) ? { countKey: `rfq.${queue}` } : {}),
          })),
        ]}
      />
      <ResourceList
        resource={rfqList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(RFQ_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
          ...(productTypes.options.length > 0
            ? [{ id: "productType", label: t("productType"), kind: "select" as const, options: productTypes.options }]
            : []),
          {
            id: "channel",
            label: t("channel"),
            kind: "select",
            options: (["web", "cs", "line", "b2b"] as const).map((value) => ({ value, label: t(`channels.${value}`) })),
          },
          { id: "submittedFrom", label: t("submittedFrom"), kind: "date" },
          { id: "submittedTo", label: t("submittedTo"), kind: "date" },
        ]}
        rowTone={(row) => (row.urgency === "late" ? "danger" : row.urgency === "due_soon" ? "warning" : undefined)}
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
