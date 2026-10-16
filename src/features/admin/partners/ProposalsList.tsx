"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { PROPOSAL_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, useProductTypes, type InitialPage } from "../console";
import { proposalsList, type ProposalSummary } from "./resources";

/** Price proposals (D-040, D-042): factories' proposals to review, and getpack's rate cards out for acceptance. */
export function ProposalsList({ initial }: { initial: InitialPage<ProposalSummary> | null }) {
  const t = useTranslations("partners.proposals");
  const { labelOf } = useProductTypes();
  const tStatus = useTranslations("status");

  const columns: DataTableColumn<ProposalSummary>[] = [
    {
      id: "factory",
      header: t("columns.proposal"),
      cell: (row) => (
        <div>
          <Link href={`/partners/proposals/${row.id}`} className="text-primary font-medium hover:underline">
            {row.factoryCode} · {labelOf(row.productTypeCode)}
          </Link>
          {row.comment ? <p className="text-muted max-w-72 truncate text-xs">{row.comment}</p> : null}
        </div>
      ),
    },
    { id: "direction", header: t("columns.direction"), cell: (row) => t(`directions.${row.direction}`) },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={PROPOSAL_STATUS} value={row.status} />,
    },
    {
      id: "lines",
      header: t("columns.lines"),
      cell: (row) => t("lineCounts", { total: row.lineCounts.total, pending: row.lineCounts.pending }),
    },
    {
      id: "effective",
      header: t("columns.effective"),
      cell: (row) => <When at={row.proposedEffectiveFrom} absoluteOnly />,
    },
    {
      id: "submittedAt",
      header: t("columns.submitted"),
      cell: (row) => (row.submittedAt ? <When at={row.submittedAt} /> : "–"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("directionsLabel")}
        param="direction"
        tabs={[
          { value: null, label: t("all") },
          { value: "factory_to_getpack", label: t("directions.factory_to_getpack"), countKey: "partners.proposals" },
          { value: "getpack_to_factory", label: t("directions.getpack_to_factory") },
        ]}
      />
      <ResourceList
        resource={proposalsList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            kind: "select",
            options: Object.entries(PROPOSAL_STATUS).map(([value, meta]) => ({ value, label: tStatus(meta.labelKey) })),
          },
        ]}
        empty={{ title: t("emptyTitle") }}
      />
    </div>
  );
}
