"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { adminBrowserApis, QueryError, StatusChip } from "../console";

type Row = Schemas["AdminStructuralRequestDto"];

/** The statuses as the desk's tabs show them: the work first (D-273). */
const QUEUE = ["submitted", "assigned", "quoted", "delivered", "approved"] as const;

/**
 * Structural design requests (U3.6, D-273): what customers asked for that the library lacks, by
 * step — new ones for CS to assign, the designer's, the delivered ones for Prepress to approve.
 */
export function StructuralRequests() {
  const t = useTranslations("catalogue.structural");
  const tStatus = useTranslations("status");
  const [status, setStatus] = useState<string>("all");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "structural-requests", { status }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/structural-requests", {
          params: { query: status === "all" ? {} : { status: status as Row["status"] } },
        })
      ).data!,
  });

  const columns: DataTableColumn<Row>[] = [
    {
      id: "request",
      header: t("columns.request"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/structural-requests/${row.id}`} className="text-primary line-clamp-2 hover:underline">
            {row.description}
          </Link>
          <p className="text-muted text-xs">{row.productTypeCode}</p>
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
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("statusesLabel")}
        value={status}
        onValueChange={setStatus}
        options={[
          { value: "all", label: t("all") },
          ...QUEUE.map((s) => ({ value: s, label: tStatus(STRUCTURAL_REQUEST_STATUS[s].labelKey) })),
        ]}
      />
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="inbox" title={t("empty")} />}
        />
      )}
    </div>
  );
}
