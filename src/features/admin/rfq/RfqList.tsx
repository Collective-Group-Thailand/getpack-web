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
import { latestQuotation, RFQ_QUEUES, rfqList, type Rfq } from "./resources";

const COUNTED = new Set<string>(["new", "mine", "awaiting_factory", "overdue"]);
const CHANNELS = ["web", "cs", "line", "b2b"] as const;

/**
 * The RFQ desk (F2 2.3, D-100): queues first, each a URL with its SLA state. Each row runs a timer
 * to the first-response deadline the API computed, until the first response stops it.
 *
 * The published row (`admin.rfqs.list`) is the whole RFQ; the factories' answers and the latest
 * quotation are read from its consultations and quotations. Each row says its category's SLA
 * target and whether a calculator routed it here (D-102). CONTRACT-GAP admin.rfqs — no "due soon"
 * urgency (only `overdue`), and no company or province.
 */
export function RfqList({ initial }: { initial: InitialPage<Rfq> | null }) {
  const t = useTranslations("rfq.list");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const productTypes = useProductTypes();

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
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.customer.displayName}</p>
          {row.customerCode ? <p className="text-muted truncate font-mono text-xs">{row.customerCode}</p> : null}
        </div>
      ),
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
            {row.routedFromCalculator ? (
              <span className="text-muted inline-flex items-center gap-1 text-xs">
                <Icon name="calculator" size={14} />
                {t("routed")}
              </span>
            ) : null}
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
          <div>
            <SlaTimer
              dueAt={row.slaDueAt}
              format={sla}
              absolute={row.slaDueAt ? format.dateTime(row.slaDueAt) : undefined}
            />
            {row.slaTargetHours !== null ? (
              <p className="text-muted text-xs whitespace-nowrap">{t("slaTarget", { hours: row.slaTargetHours })}</p>
            ) : null}
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
            id: "channel",
            label: t("channel"),
            kind: "select",
            options: CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) })),
          },
          { id: "submittedFrom", label: t("submittedFrom"), kind: "date" },
          { id: "submittedTo", label: t("submittedTo"), kind: "date" },
        ]}
        rowTone={(row) => (row.overdue ? "danger" : undefined)}
        empty={{ title: t("emptyTitle"), description: t("emptyBody") }}
      />
    </div>
  );
}
