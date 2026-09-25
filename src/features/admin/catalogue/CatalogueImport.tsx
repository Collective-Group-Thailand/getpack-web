"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, download, problemMessage, QueryError, useCan } from "../console";
import { adminBrowserApis } from "../console/api";

type Kind = Schemas["CatalogImportKind"];
type Preview = Schemas["ImportPreviewDto"];
type Column = Schemas["ImportColumnDto"];

/**
 * The catalogue's Excel import (B2.1, D-005, D-170): pick a kind, see its sheets and columns,
 * download the current data as the template, upload a workbook, read the preview — what would
 * be created, updated, left alone, and every invalid row — and only then confirm that exact
 * preview (its hash goes back with the confirmation, one idempotency key per preview).
 */
export function CatalogueImport({ initialKind }: { initialKind: Kind | null }) {
  const t = useTranslations("catalogue.import");
  const format = useFormat();
  const canImport = useCan("catalog.import");
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind | null>(initialKind);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [applied, setApplied] = useState<Preview | null>(null);

  const kinds = useQuery({
    queryKey: queryKeys.list("admin", "catalog_import_kind", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/catalog/imports")).data!,
    staleTime: STALE_TIME.reference,
    enabled: canImport,
  });
  const current = kinds.data?.find((item) => item.kind === kind) ?? null;

  const exportKind = useMutation({
    mutationFn: async (chosen: Kind) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/catalog/exports/{kind}", {
          params: { path: { kind: chosen } },
        })
      ).data!,
    onSuccess: (result) => {
      download(result.url);
      toast.success(t("exported", { rows: result.rows }));
    },
    onError: (error) => toast.error(problemMessage(error, t("exportFailed"))),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadFile("admin", file, "import");
      return (
        await adminBrowserApis().contract.POST("/v1/admin/catalog/imports/{kind}/actions/preview", {
          params: { path: { kind: kind! } },
          body: { fileId: uploaded.id },
        })
      ).data!;
    },
    onSuccess: (result) => {
      setPreview(result);
      setApplied(null);
      setConfirmKey(newIdempotencyKey());
    },
    onError: (error) => toast.error(problemMessage(error, t("previewFailed"))),
  });

  if (!canImport) return <Callout tone="warning" title={t("forbidden")} />;
  if (kinds.isError) return <QueryError error={kinds.error} onRetry={() => void kinds.refetch()} />;

  const columnColumns: DataTableColumn<Column>[] = [
    { id: "header", header: t("column"), cell: (row) => <span className="font-mono text-sm">{row.header}</span> },
    { id: "type", header: t("type"), cell: (row) => (t.has(`types.${row.type}`) ? t(`types.${row.type}`) : row.type) },
    {
      id: "required",
      header: t("required"),
      cell: (row) =>
        row.required ? <Badge size="sm">{t("requiredYes")}</Badge> : <span className="text-muted">–</span>,
    },
    { id: "values", header: t("values"), cell: (row) => (row.values?.length ? row.values.join(", ") : "–") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>{t("chooseTitle")}</CardTitle>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_auto] sm:items-end">
          <Field label={t("kind")}>
            <Select
              value={kind ?? undefined}
              onValueChange={(value) => {
                setKind(value as Kind);
                setPreview(null);
                setApplied(null);
              }}
              placeholder={t("chooseKind")}
              options={(kinds.data ?? []).map((item) => ({ value: item.kind, label: item.label }))}
            />
          </Field>
          {kind ? (
            <Button
              variant="secondary"
              iconStart="download"
              loading={exportKind.isPending}
              onClick={() => exportKind.mutate(kind)}
            >
              {t("export")}
            </Button>
          ) : null}
        </div>
        <p className="text-muted mt-3 text-sm">{t("rules")}</p>
      </Card>

      {current ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("sheetsTitle", { label: current.label })}</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            {current.sheets.map((sheet) => (
              <div key={sheet.name}>
                <p className="mb-2 text-sm font-medium">
                  {t("sheet", { name: sheet.name })}{" "}
                  <span className="text-muted font-normal">{t("key", { columns: sheet.key.join(" + ") })}</span>
                </p>
                <DataTable
                  caption={t("sheet", { name: sheet.name })}
                  columns={columnColumns}
                  rows={sheet.columns}
                  getRowId={(row) => row.header}
                  density="compact"
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {kind ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("uploadTitle")}</CardTitle>
          </CardHeader>
          <FileDropzone
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            maxBytes={20 * 1024 * 1024}
            disabled={upload.isPending}
            onFiles={([file]) => file && upload.mutate(file)}
            labels={{
              prompt: upload.isPending ? t("checking") : t("drop"),
              browse: t("browse"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
        </Card>
      ) : null}

      {preview ? (
        <Card padding="lg">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("previewTitle")}</CardTitle>
            {preview.canConfirm && !applied ? (
              <ConfirmTrigger
                preview={preview}
                idempotencyKey={confirmKey!}
                onApplied={(result) => {
                  setApplied(result);
                  // Every catalogue list may have changed.
                  void queryClient.invalidateQueries({
                    queryKey: ["admin"],
                    predicate: (query) => String(query.queryKey[1]).startsWith("catalog_"),
                  });
                }}
              />
            ) : null}
          </CardHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["create", "update", "unchanged", "invalid"] as const).map((key) => (
              <div key={key} className="rounded-md border p-3">
                <p className="text-muted text-xs">{t(`counts.${key}`)}</p>
                <p
                  className={
                    key === "invalid" && preview.totals.invalid > 0
                      ? "text-danger text-xl font-semibold"
                      : "text-xl font-semibold"
                  }
                >
                  {format.number(preview.totals[key])}
                </p>
              </div>
            ))}
          </div>
          <DataTable
            className="mt-4"
            caption={t("perSheet")}
            showCaption
            columns={[
              {
                id: "name",
                header: t("sheetColumn"),
                cell: (row) => <span className="font-mono text-sm">{row.name}</span>,
              },
              ...(["create", "update", "unchanged", "invalid"] as const).map((key) => ({
                id: key,
                header: t(`counts.${key}`),
                numeric: true,
                cell: (row: Schemas["ImportSheetDto"]) => format.number(row[key]),
              })),
            ]}
            rows={preview.sheets}
            getRowId={(row) => row.name}
            density="compact"
          />
          {preview.errors.length > 0 ? (
            <div className="mt-4">
              <Callout tone="danger" title={t("errorsTitle", { count: preview.totals.invalid })}>
                {t("errorsBody")}
              </Callout>
              <ul className="divide-border mt-3 divide-y rounded-md border text-sm">
                {preview.errors.map((error, index) => (
                  <li key={index} className="flex flex-wrap gap-2 px-3 py-2">
                    <span className="font-mono text-xs">
                      {t("errorAt", { sheet: error.sheet, row: error.row, column: error.column ?? "–" })}
                    </span>
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>
              {preview.errorsTruncated ? <p className="text-muted mt-2 text-xs">{t("truncated")}</p> : null}
            </div>
          ) : null}
          {!preview.canConfirm && preview.errors.length === 0 ? (
            <p className="text-muted mt-3 text-sm">{t("nothingToDo")}</p>
          ) : null}
          {applied ? (
            <Callout tone="success" className="mt-4" title={t("appliedTitle")}>
              {t("appliedBody", { create: applied.totals.create, update: applied.totals.update })}
            </Callout>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function ConfirmTrigger({
  preview,
  idempotencyKey,
  onApplied,
}: {
  preview: Preview;
  idempotencyKey: string;
  onApplied: (result: Preview) => void;
}) {
  const t = useTranslations("catalogue.import");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button iconStart="check" onClick={() => setOpen(true)}>
        {t("confirm")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle")}
        description={t("confirmBody", { create: preview.totals.create, update: preview.totals.update })}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          try {
            const result = (
              await adminBrowserApis().contract.POST("/v1/admin/catalog/imports/{kind}/actions/confirm", {
                params: { path: { kind: preview.kind }, header: { "Idempotency-Key": idempotencyKey } },
                body: { fileId: preview.fileId, previewSha256: preview.previewSha256 },
              })
            ).data!;
            toast.success(t("applied"));
            onApplied(result);
          } catch (error) {
            toast.error(problemMessage(error, t("confirmFailed")));
            throw error;
          }
        }}
      />
    </>
  );
}
