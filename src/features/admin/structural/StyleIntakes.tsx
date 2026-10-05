"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { STYLE_INTAKE_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { adminBrowserApis, QueryError, StatusChip } from "../console";

type Row = Schemas["StyleIntakeDto"];
const QUEUE = ["submitted", "matched", "approved_recipe", "approved_template", "rejected"] as const;

/** Dieline offers from factories (U3.6, D-272), newest first, by status: the ones to review first. */
export function StyleIntakes() {
  const t = useTranslations("catalogue.intakes");
  const tStatus = useTranslations("status");
  const [status, setStatus] = useState<string>("submitted");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "style-intakes", { status }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/style-intakes", {
          params: { query: status === "all" ? {} : { status: status as Row["status"] } },
        })
      ).data!,
  });
  const columns: DataTableColumn<Row>[] = [
    {
      id: "title",
      header: t("columns.title"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/style-intakes/${row.id}`} className="text-primary hover:underline">
            {row.title}
          </Link>
          <p className="text-muted text-xs">{row.file.originalName}</p>
        </div>
      ),
    },
    { id: "factory", header: t("columns.factory"), cell: (row) => `${row.factory.code} · ${row.factory.name}` },
    { id: "base", header: t("columns.base"), cell: (row) => row.proposedBaseCode ?? "—" },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={STYLE_INTAKE_STATUS} value={row.status} />,
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
          ...QUEUE.map((s) => ({ value: s, label: tStatus(STYLE_INTAKE_STATUS[s].labelKey) })),
          { value: "all", label: t("all") },
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
