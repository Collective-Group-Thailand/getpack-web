"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { RFQ_STATUS, RFQ_QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { cn } from "@/ui/lib/cn";

import { QueueTabs, ResourceList, StatusChip, useActor, useSlaFormat, type InitialPage } from "../console";
import { latestQuotation, RFQ_QUEUES, rfqList, type Rfq } from "./resources";

const COUNTED = new Set<string>(["new", "mine", "overdue"]);

/**
 * The RFQ desk (F2 2.3, D-100): queues first, each a URL with its SLA state. Each row runs a timer
 * to the first-response deadline the API computed, until the first response stops it.
 *
 * The published row (`admin.rfqs.list`) is the whole RFQ; the factories' answers and the latest
 * quotation are read from its consultations and quotations. CONTRACT-GAP admin.rfqs — no SLA target
 * per category, no "due soon" urgency, no company, province or calculator routing, and no product
 * type, channel or date filters.
 */
export function RfqList({ initial }: { initial: InitialPage<Rfq> | null }) {
  const t = useTranslations("rfq.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();

  const columns: DataTableColumn<Rfq>[] = [
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
          <p className="text-muted text-xs whitespace-nowrap">{row.productTypeName}</p>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: (row) => <p className="truncate">{row.customer.displayName}</p>,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => {
        const latest = latestQuotation(row);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <StatusChip map={RFQ_STATUS} value={row.status} />
            {latest ? <StatusChip map={RFQ_QUOTE_STATUS} value={latest.status} /> : null}
          </div>
        );
      },
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
          <SlaTimer
            dueAt={row.slaDueAt}
            format={sla}
            absolute={row.slaDueAt ? format.dateTime(row.slaDueAt) : undefined}
          />
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
      cell: (row) => {
        const asked = row.consultations.filter((item) => item.status === "requested" || item.status === "responded");
        const responded = asked.filter((item) => item.status === "responded").length;
        return asked.length === 0 ? (
          <span className="text-muted">{t("noConsultations")}</span>
        ) : (
          <span className="text-sm whitespace-nowrap">{t("consultations", { responded, total: asked.length })}</span>
        );
      },
    },
    {
      id: "assignee",
      header: t("columns.assignee"),
      hideable: true,
      cell: (row) =>
        row.assignedTo ? (
          <span
            className={cn("block max-w-40 truncate", row.assignedTo.id === actor.id && "font-medium")}
            title={row.assignedTo.displayName}
          >
            {row.assignedTo.id === actor.id ? t("you") : row.assignedTo.displayName}
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
      cell: (row) => (row.targetDate ? format.date(row.targetDate) : t("noTarget")),
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
        exportable
        searchLabel={t("search")}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(RFQ_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
        ]}
        rowTone={(row) => (row.overdue ? "danger" : undefined)}
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
