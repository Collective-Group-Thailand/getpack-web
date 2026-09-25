"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";

import { problemMessage, StatusChip } from "../console";

/** Thrown by a form's own check (a missing file): its message is shown as is. */
export class FormError extends Error {}

export function Section({
  title,
  actions,
  children,
  description,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-2">{title}</CardTitle>
        {actions}
      </CardHeader>
      {description ? <p className="text-muted -mt-2 mb-3 text-sm">{description}</p> : null}
      {children}
    </Card>
  );
}

/**
 * A dialog around a small form: submit runs the request and closes on success; on failure the
 * dialog stays open with its fields, and the API's message is shown.
 */
export function FormDialog({
  title,
  description,
  submitLabel,
  onSubmit,
  onClose,
  children,
  destructive,
}: {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  const t = useTranslations("partners.form");
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={title}
      description={description}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" form="partner-form" variant={destructive ? "destructive" : "primary"} loading={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="partner-form"
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await onSubmit();
            onClose();
          } catch (error) {
            // A check the form made itself throws a FormError with the message to show.
            toast.error(error instanceof FormError ? error.message : problemMessage(error, t("failed")));
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </form>
    </Dialog>
  );
}

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
