"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { z } from "zod";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { importJob } from "@/lib/api/requests/admin-console";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Spinner } from "@/ui/components/Spinner";
import { Stat } from "@/ui/components/Stat";

import { problemMessage } from "./QueryError";

type ImportJob = z.output<typeof importJob>;
type PreviewRow = ImportJob["preview"][number];

/** 10 MB — a technical ceiling for a spreadsheet, not a business value; the API has its own. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * The Excel import pattern F2 §2 fixes for every large table: **upload → preview → confirm**.
 *
 * Nothing is written until the person has seen what will be created, updated and skipped, with
 * every invalid row's reason. Apply carries an idempotency key minted when the preview appeared,
 * so a double click or a retry after a timeout applies the file once
 * (CONTRACT-REQUEST `admin.imports`).
 */
export function ImportWizard({
  resource,
  invalidates,
  templateUrl,
}: {
  /** The resource the API imports into, e.g. `stock_product`. */
  resource: string;
  /** The query-key resource to refresh once applied. */
  invalidates: string;
  /** Where a blank template can be downloaded, when the API offers one. */
  templateUrl?: string;
}) {
  const t = useTranslations("console.import");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [applyKey, setApplyKey] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadFile("admin", file, "import");
      return browserRequests().call("POST /v1/admin/imports", { body: { resource, fileId: uploaded.id } });
    },
    onSuccess: (created) => {
      setJob(created);
      setApplyKey(newIdempotencyKey());
    },
  });

  const apply = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/imports/{importId}/actions/apply", {
        path: { importId: job!.id },
        idempotencyKey: applyKey!,
      }),
    onSuccess: (applied) => {
      setJob(applied);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", invalidates) });
    },
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setJob(null);
      setApplyKey(null);
      upload.reset();
      apply.reset();
    }
  }

  const columnsInFile = [...new Set((job?.preview ?? []).flatMap((row) => Object.keys(row.values)))];
  const columns: DataTableColumn<PreviewRow>[] = [
    { id: "rowNo", header: t("row"), cell: (row) => row.rowNo, numeric: true },
    {
      id: "action",
      header: t("action"),
      cell: (row) =>
        row.errors.length > 0 ? (
          <Badge tone="danger" icon="error" size="sm">
            {t("invalid")}
          </Badge>
        ) : (
          <Badge tone={row.action === "create" ? "success" : row.action === "update" ? "info" : "neutral"} size="sm">
            {t(`actions.${row.action}`)}
          </Badge>
        ),
    },
    ...columnsInFile.map((column) => ({
      id: `v:${column}`,
      header: column,
      cell: (row: PreviewRow) => row.values[column] ?? "",
    })),
    {
      id: "errors",
      header: t("problems"),
      cell: (row) =>
        row.errors.length > 0 ? (
          <ul className="text-danger text-xs">
            {row.errors.map((error, index) => (
              <li key={index}>{error.column ? `${error.column}: ${error.message}` : error.message}</li>
            ))}
          </ul>
        ) : null,
    },
  ];

  const writable = job ? job.totals.create + job.totals.update : 0;
  const applied = job?.status === "applied";

  return (
    <>
      <Button variant="secondary" size="sm" iconStart="upload" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={reset}
        size="xl"
        title={t("title")}
        description={t("description")}
        closeLabel={tCommon("actions.close")}
        footer={
          job && !applied ? (
            <>
              <Button variant="secondary" onClick={() => setJob(null)} disabled={apply.isPending}>
                {t("chooseAnother")}
              </Button>
              <Button
                onClick={() => apply.mutate()}
                loading={apply.isPending}
                disabled={writable === 0 || job.status !== "ready"}
              >
                {t("apply", { count: writable })}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => reset(false)}>
              {tCommon("actions.close")}
            </Button>
          )
        }
      >
        {applied ? (
          <Callout tone="success" title={t("appliedTitle")}>
            {t("appliedBody", { create: job!.totals.create, update: job!.totals.update })}
          </Callout>
        ) : job ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t("totals.rows")} value={format.number(job.totals.rows)} />
              <Stat label={t("totals.create")} value={format.number(job.totals.create)} tone="success" icon="plus" />
              <Stat label={t("totals.update")} value={format.number(job.totals.update)} icon="edit" />
              <Stat
                label={t("totals.invalid")}
                value={format.number(job.totals.invalid)}
                tone={job.totals.invalid > 0 ? "danger" : "neutral"}
                icon="warning"
              />
            </div>
            {job.totals.invalid > 0 ? (
              <Callout tone="warning" title={t("invalidTitle")}>
                {t("invalidBody")}
              </Callout>
            ) : null}
            {apply.error ? <Callout tone="danger" title={problemMessage(apply.error, t("applyFailed"))} /> : null}
            <DataTable
              caption={t("previewCaption", { file: job.fileName })}
              showCaption
              columns={columns}
              rows={job.preview}
              getRowId={(row) => String(row.rowNo)}
              density="compact"
              rowTone={(row) => (row.errors.length > 0 ? "danger" : undefined)}
            />
          </div>
        ) : upload.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner label={t("checking")} />
          </div>
        ) : (
          <div className="space-y-3">
            {upload.error ? <Callout tone="danger" title={problemMessage(upload.error, t("uploadFailed"))} /> : null}
            <FileDropzone
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              maxBytes={MAX_BYTES}
              onFiles={([file]) => file && upload.mutate(file)}
              labels={{
                prompt: t("dropPrompt"),
                browse: t("browse"),
                hint: t("dropHint", { size: format.bytes(MAX_BYTES) }),
                tooLarge: (name) => t("tooLarge", { name, size: format.bytes(MAX_BYTES) }),
                wrongType: (name) => t("wrongType", { name }),
              }}
            />
            {templateUrl ? (
              <Button variant="link" size="sm" asChild>
                <a href={templateUrl}>{t("template")}</a>
              </Button>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
