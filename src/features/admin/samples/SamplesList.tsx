"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, type InitialPage } from "../console";
import { SAMPLE_QUEUE, samplesList, type AdminSample } from "./resources";

/**
 * The sample queue (U2.F3, D-253): standalone samples to quote and attached samples of orders, by
 * status — requests to quote, paid ones to make, delivered ones waiting for the customer, changes
 * asked for (a new sample). Sample and bulk are told apart on every row.
 */
export function SamplesList({ initial }: { initial: InitialPage<AdminSample> | null }) {
  const t = useTranslations("orders.samples");
  const tStatus = useTranslations("status");
  const format = useFormat();

  const columns: DataTableColumn<AdminSample>[] = [
    {
      id: "sample",
      header: t("columns.sample"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/samples/${row.id}`} className="text-primary hover:underline">
            {t(`mockup.${row.mockupOption}`)}
          </Link>
          <p className="text-muted text-xs">{row.orderCode ?? t("noOrder")}</p>
        </div>
      ),
    },
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customerName ?? "—" },
    { id: "kind", header: t("columns.kind"), cell: (row) => <StatusChip map={SAMPLE_KIND} value={row.kind} /> },
    { id: "status", header: t("columns.status"), cell: (row) => <StatusChip map={SAMPLE_STATUS} value={row.status} /> },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (row) =>
        row.sellGrossAmount ? <span className="tabular-nums">{format.thb(row.sellGrossAmount)}</span> : "—",
    },
    { id: "createdAt", header: t("columns.created"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...SAMPLE_QUEUE.map((status) => ({ value: status, label: tStatus(SAMPLE_STATUS[status].labelKey) })),
        ]}
      />
      <ResourceList
        resource={samplesList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "kind",
            label: t("filters.kind"),
            kind: "select",
            options: (["attached", "standalone"] as const).map((value) => ({
              value,
              label: tStatus(SAMPLE_KIND[value].labelKey),
            })),
          },
        ]}
        empty={{ title: t("empty") }}
      />
    </div>
  );
}
