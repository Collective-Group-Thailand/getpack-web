"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip, useProductTypes } from "../console";
import { STRUCTURAL_QUEUE, structuralRequestsList, type StructuralRequest } from "./resources";

type Row = StructuralRequest;

/**
 * Structural design requests (U3.6, D-273): what customers asked for that the library lacks, by
 * step — new ones for CS to assign, the designer's, the delivered ones for Prepress to approve.
 */
export function StructuralRequests() {
  const t = useTranslations("catalogue.structural");
  const tStatus = useTranslations("status");
  const productTypes = useProductTypes();

  const columns: DataTableColumn<Row>[] = [
    {
      id: "request",
      header: t("columns.request"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/structural-requests/${row.id}`} className="text-primary line-clamp-2 hover:underline">
            {row.description}
          </Link>
          <p className="text-muted text-xs">{productTypes.labelOf(row.productTypeCode)}</p>
        </div>
      ),
    },
    { id: "customer", header: t("columns.customer"), cell: (row) => row.customer.displayName },
    { id: "assignee", header: t("columns.assignee"), cell: (row) => row.assignedTo?.displayName ?? "—" },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={STRUCTURAL_REQUEST_STATUS} value={row.status} />,
    },
    { id: "createdAt", header: t("columns.created"), cell: (row) => <When at={row.createdAt} /> },
  ];

  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={structuralRequestsList}
          label={t("statusesLabel")}
          param="status"
          tabs={[
            { value: null, label: t("all") },
            ...STRUCTURAL_QUEUE.map((s) => ({ value: s, label: tStatus(STRUCTURAL_REQUEST_STATUS[s].labelKey) })),
          ]}
        />
      }
      resource={structuralRequestsList}
      columns={columns}
      caption={t("title")}
      savedViews={false}
      rowHref={(row) => `/structural-requests/${row.id}`}
      empty={{
        title: t("empty"),
        action: (
          <Button asChild variant="secondary" iconEnd="arrow-right">
            <Link href="/style-library">{t("emptyAction")}</Link>
          </Button>
        ),
      }}
    />
  );
}
