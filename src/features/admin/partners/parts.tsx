"use client";

import { useTranslations } from "next-intl";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";

import { StatusChip } from "../console";

// The dialog and card moved to the console in 2.7 (marketing and companies use them too).
export { FormDialog, FormError, Section } from "../console";

export interface VersionRow {
  versionNo: number;
  status: keyof typeof SETTING_VERSION_STATUS;
  effectiveFrom: string;
  reason: string;
  approvalRequestId: string | null;
  summary: React.ReactNode;
}

/**
 * A term's versions — the one in force and those scheduled (D-063): which values, from when,
 * why, and the approval a proposed one waits on (D-173).
 */
export function VersionTable({ caption, rows }: { caption: string; rows: readonly VersionRow[] }) {
  const t = useTranslations("partners.versions");
  const format = useFormat();
  const columns: DataTableColumn<VersionRow>[] = [
    { id: "versionNo", header: t("version"), numeric: true, cell: (row) => row.versionNo },
    { id: "summary", header: t("values"), cell: (row) => row.summary },
    { id: "effectiveFrom", header: t("from"), cell: (row) => format.date(row.effectiveFrom) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />,
    },
    {
      id: "reason",
      header: t("reason"),
      cell: (row) => (
        <div className="max-w-64">
          <p className="truncate" title={row.reason}>
            {row.reason}
          </p>
          {row.approvalRequestId ? (
            <a href={`/approvals/${row.approvalRequestId}`} className="text-primary text-xs hover:underline">
              {t("approval")}
            </a>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.versionNo)}
      density="compact"
      empty={<p className="text-muted p-3 text-sm">{t("none")}</p>}
    />
  );
}
