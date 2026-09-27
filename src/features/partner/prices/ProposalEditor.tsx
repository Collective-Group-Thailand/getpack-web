"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import type { LineInput, SheetProblem } from "./lines";
import {
  cellText,
  columnsOf,
  referenceLookup,
  type PriceComponentDef,
  type PriceReference,
  type Values,
} from "./values";

type Component = Schemas["PriceComponent"];
type Row = Schemas["PriceRowDto"];

export interface DraftLine {
  input: LineInput;
  label: string;
  summary: string;
}

const NEW = "__new__";

/**
 * Builds a draft proposal (D-040) line by line — pick a line of the price list and change or
 * remove it, or add one — or all at once from a sheet: download the current prices as CSV, edit
 * them in Excel, upload the file back, check the preview, then use it. Every change replaces the
 * draft's lines on the API (`PUT …/lines`), which validates them and is what the page shows.
 */
export function ProposalEditor({
  proposalId,
  versionId,
  definitions,
  references,
  draft,
}: {
  proposalId: string;
  /** The version in force the lines apply to; `null` for a first price list. */
  versionId: string | null;
  definitions: PriceComponentDef[];
  references: PriceReference[];
  draft: DraftLine[];
}) {
  const t = useTranslations("partnerPrices.editor");
  const tComponents = useTranslations("partnerPrices.components");
  const tColumns = useTranslations("partnerPrices.columns");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [component, setComponent] = useState<Component>(definitions[0]?.component ?? "material_prices");
  const [rowKey, setRowKey] = useState<string>(NEW);
  const [edits, setEdits] = useState<Values>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ lines: LineInput[]; problems: SheetProblem[]; name: string } | null>(null);
  const referenceName = useMemo(() => referenceLookup(references), [references]);
  const columns = columnsOf(definitions, component);
  const label = (key: string) => (tColumns.has(key) ? tColumns(key) : key);
  const labels = { yes: t("yes"), no: t("no"), open: t("open") };

  const rows = useQuery({
    queryKey: [...queryKeys.related("partner", "price_version", versionId ?? "none", "lines"), component],
    enabled: versionId !== null,
    queryFn: async () =>
      (
        await browserApi().GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/lines", {
          params: { path: { factoryId, versionId: versionId! }, query: { component, perPage: 100 } },
        })
      ).data?.data ?? [],
  });

  if (!can("factory_prices.propose")) return null;
  const row: Row | undefined = rows.data?.find((item) => item.lineKey === rowKey);
  const describe = (values: Values, keys: { key: string; type: Schemas["PriceColumnType"] }[]) =>
    keys
      .map((column) => `${label(column.key)} ${cellText(values[column.key], column, referenceName, labels)}`)
      .join(" · ");

  async function replace(lines: LineInput[], success: string) {
    setBusy(true);
    try {
      await browserApi().PUT("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/lines", {
        params: { path: { factoryId, proposalId } },
        body: { lines },
      });
      toast.success(success);
      setEdits({});
      setRowKey(NEW);
      setPreview(null);
      refresh();
    } catch (error) {
      const detail =
        isApiError(error) && error.errors.length ? error.errors.map((item) => item.message).join(" · ") : null;
      toast.error(detail ?? problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  function addLine(action: LineInput["action"]) {
    const base = draft.map((line) => line.input);
    if (action === "remove" && row)
      return void replace([...base, { action, component, lineKey: row.lineKey }], t("added"));
    const values: Values = row ? { ...(row.values as Values), ...edits } : { ...edits };
    const missing = (row ? columns.values : columns.all).filter(
      (column) => !column.nullable && (values[column.key] === undefined || values[column.key] === ""),
    );
    if (missing.length)
      return toast.error(t("missing", { columns: missing.map((column) => label(column.key)).join(", ") }));
    const typed = Object.fromEntries(
      Object.entries(values).map(([key, value]) => {
        const column = columns.all.find((item) => item.key === key);
        return [key, column?.type === "integer" && typeof value === "string" ? Number(value) : value];
      }),
    );
    void replace([...base, { action, component, ...(row ? { lineKey: row.lineKey } : {}), values: typed }], t("added"));
  }

  async function upload(file: File) {
    try {
      const [{ readSheet }, { sheetToLines }] = await Promise.all([import("./sheet"), import("./lines")]);
      const result = sheetToLines(await readSheet(file), definitions);
      setPreview({ ...result, name: file.name });
    } catch {
      toast.error(t("unreadable", { name: file.name }));
    }
  }

  async function download() {
    const [{ templateCsv }] = await Promise.all([import("./lines")]);
    const csv = templateCsv(
      component,
      definitions,
      (rows.data ?? []).map((item) => ({ lineKey: item.lineKey, values: item.values as Values })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${component}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {draft.length ? (
        <ul className="flex flex-col gap-2" aria-label={t("draftLines")}>
          {draft.map((line, index) => (
            <li key={`${line.input.lineKey ?? "new"}-${index}`}>
              <Card padding="md" className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.label}</p>
                  <p className="text-muted text-sm tabular-nums">{line.summary}</p>
                </div>
                <Button
                  size="lg"
                  variant="ghost"
                  iconStart="trash"
                  disabled={busy}
                  onClick={() =>
                    void replace(
                      draft.filter((_, at) => at !== index).map((item) => item.input),
                      t("removed"),
                    )
                  }
                >
                  {t("removeFromDraft")}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t("noLines")}</p>
      )}

      <Card padding="lg" className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">{t("changeTitle")}</h3>
        <Field label={t("component")}>
          <Select
            value={component}
            onValueChange={(value) => {
              setComponent(value);
              setRowKey(NEW);
              setEdits({});
            }}
            options={definitions.map((item) => ({ value: item.component, label: tComponents(item.component) }))}
          />
        </Field>
        {versionId ? (
          <Field label={t("line")} hint={rows.isPending ? t("loadingLines") : undefined}>
            <Select
              value={rowKey}
              onValueChange={(value) => {
                setRowKey(value);
                setEdits({});
              }}
              options={[
                { value: NEW, label: t("newLine") },
                ...(rows.data ?? []).map((item) => ({
                  value: item.lineKey,
                  label: describe(item.values as Values, columns.dimensions),
                })),
              ]}
            />
          </Field>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {(row ? columns.values : columns.all).map((column) => {
            const current = row ? (row.values as Values)[column.key] : undefined;
            const value = edits[column.key] ?? current ?? "";
            const options = references.filter((item) => item.column === column.key);
            return (
              <Field
                key={column.key}
                label={label(column.key)}
                hint={
                  current !== undefined
                    ? t("now", { value: cellText(current, column, referenceName, labels) })
                    : undefined
                }
              >
                {column.type === "ref" ? (
                  <Select
                    value={String(value)}
                    placeholder={t("choose")}
                    onValueChange={(next) => setEdits({ ...edits, [column.key]: next })}
                    options={options.map((item) => ({ value: item.id, label: item.name }))}
                  />
                ) : column.type === "boolean" ? (
                  <Select
                    value={value === "" ? "" : String(value)}
                    placeholder={t("choose")}
                    onValueChange={(next) => setEdits({ ...edits, [column.key]: next === "true" })}
                    options={[
                      { value: "true", label: labels.yes },
                      { value: "false", label: labels.no },
                    ]}
                  />
                ) : (
                  <Input
                    inputSize="lg"
                    inputMode={column.type === "text" ? "text" : "decimal"}
                    value={String(value ?? "")}
                    onChange={(event) => setEdits({ ...edits, [column.key]: event.target.value })}
                  />
                )}
              </Field>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xl" iconStart="plus" loading={busy} onClick={() => addLine(row ? "change" : "add")}>
            {row ? t("addChange") : t("addNew")}
          </Button>
          {row ? (
            <Button size="xl" variant="secondary" iconStart="trash" disabled={busy} onClick={() => addLine("remove")}>
              {t("addRemove")}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card padding="lg" className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">{t("sheetTitle")}</h3>
        <p className="text-muted text-sm">{t("sheetBody")}</p>
        <Button
          size="lg"
          variant="secondary"
          iconStart="download"
          onClick={() => void download()}
          className="self-start"
        >
          {t("downloadTemplate", { component: tComponents(component) })}
        </Button>
        <FileDropzone
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          maxBytes={5 * 1024 * 1024}
          onFiles={(files) => files[0] && void upload(files[0])}
          labels={{
            prompt: t("drop"),
            browse: t("browse"),
            hint: t("sheetRules"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
        {preview ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className="font-medium">{t("previewTitle", { name: preview.name, count: preview.lines.length })}</p>
            {preview.problems.length ? (
              <ul className="text-danger list-disc ps-5 text-sm" role="alert">
                {preview.problems.slice(0, 20).map((problem) => (
                  <li key={`${problem.row}-${problem.column}`}>
                    {t(`problems.${problem.code}`, { row: problem.row, column: label(problem.column) })}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm">
              {preview.lines.slice(0, 50).map((line, index) => (
                <li key={index} className="border-border border-b py-1">
                  {t(`actions.${line.action}`)} · {tComponents(line.component)} ·{" "}
                  {describe((line.values ?? {}) as Values, columnsOf(definitions, line.component).all)}
                </li>
              ))}
            </ul>
            <Button
              size="xl"
              iconStart="check"
              loading={busy}
              disabled={preview.problems.length > 0 || preview.lines.length === 0}
              onClick={() => void replace(preview.lines, t("sheetUsed", { count: preview.lines.length }))}
              className="self-start"
            >
              {t("useSheet", { count: preview.lines.length })}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
