"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useRefresh } from "@/features/partner/client";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { IconButton } from "@/ui/components/IconButton";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SearchInput } from "@/ui/components/SearchInput";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { componentsFor } from "./components-by-type";
import { lineToInput, type LineInput, type SheetProblem } from "./lines";
import {
  cellText,
  columnsOf,
  decimalText,
  referenceLookup,
  sortRows,
  type PriceComponentDef,
  type PriceReference,
  type Values,
} from "./values";

type Component = Schemas["PriceComponent"];
type Row = Schemas["PriceRowDto"];
type Line = Schemas["PriceProposalLineDto"];
type Column = Schemas["PriceColumnDto"];

/** What the person has typed but not yet saved to the draft, per line of the price list. */
type Pending = Record<string, { values: Values; remove?: boolean }>;

const NUMERIC: readonly Schemas["PriceColumnType"][] = ["decimal", "integer"];
const same = (a: unknown, b: unknown) =>
  (a === "" || a === undefined ? null : a) === (b === "" || b === undefined ? null : b) ||
  JSON.stringify(a) === JSON.stringify(b) ||
  (typeof a === "string" && typeof b === "string" && a.trim() !== "" && Number(a) === Number(b));

/** A typed cell as the contract takes it: integers as numbers, decimals and text as strings, blank as null. */
function typedValue(column: Column, value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  if (column.type === "integer" && typeof value === "string") return Number(value.replace(/,/g, ""));
  if (column.type === "decimal" && typeof value === "string") {
    // As the sheet import does: the column's own scale, so "4.6" is sent as "4.600000".
    const [whole, fraction = ""] = value.replace(/,/g, "").trim().split(".");
    const scale = column.scale ?? fraction.length;
    return scale ? `${whole}.${fraction.padEnd(scale, "0").slice(0, scale)}` : whole;
  }
  return value;
}

function invalid(column: Column, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return !column.nullable;
  if (column.type === "integer") return !/^-?\d+$/.test(String(value).replace(/,/g, ""));
  if (column.type === "decimal") return !/^-?\d+(\.\d+)?$/.test(String(value).replace(/,/g, "").trim());
  return false;
}

/**
 * The draft of a factory's price proposal (D-040), edited like a spreadsheet: pick a part of the
 * price list, change prices in place (the old value stays visible under each changed cell), mark
 * a line to be dropped, or add new lines — then save them to the draft in one go. The draft's
 * changes are listed above the sheet, old → new, so the factory always sees what it will send.
 * A CSV round-trip remains for large changes, behind "advanced" because it replaces the draft.
 */
export function ProposalEditor({
  proposalId,
  versionId,
  productTypeCode,
  initialComponent,
  definitions: allDefinitions,
  references,
  lines,
}: {
  proposalId: string;
  /** The version in force the lines apply to; `null` for a first price list. */
  versionId: string | null;
  productTypeCode: string | null;
  initialComponent?: string;
  definitions: PriceComponentDef[];
  references: PriceReference[];
  /** The draft's lines as the API holds them. */
  lines: Line[];
}) {
  const t = useTranslations("partnerPrices.editor");
  const tActions = useTranslations("partnerPrices.lines.actions");
  const tComponents = useTranslations("partnerPrices.components");
  const tColumns = useTranslations("partnerPrices.columns");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const definitions = useMemo(() => componentsFor(allDefinitions, productTypeCode), [allDefinitions, productTypeCode]);
  const [component, setComponent] = useState<Component>(
    (definitions.find((item) => item.component === initialComponent)?.component ??
      definitions[0]?.component ??
      "material_prices") as Component,
  );
  const [pending, setPending] = useState<Pending>({});
  const [added, setAdded] = useState<Values[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ lines: LineInput[]; problems: SheetProblem[]; name: string } | null>(null);
  const referenceName = useMemo(() => referenceLookup(references), [references]);
  const { dimensions, values: valueColumns, all } = columnsOf(definitions, component);
  const label = (key: string) => (tColumns.has(key) ? tColumns(key) : key);
  const labels = { yes: t("yes"), no: t("no"), open: t("open") };
  const show = (column: Column, value: unknown) => cellText(value, column, referenceName, labels);
  const dirty = Object.keys(pending).length + added.length;

  // Leaving with unsaved cells loses them: let the browser ask first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const rows = useQuery({
    queryKey: [...queryKeys.related("partner", "price_version", versionId ?? "none", "lines"), component],
    enabled: versionId !== null,
    queryFn: async () =>
      (
        await browserApi().GET("/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/lines", {
          params: { path: { factoryId, versionId: versionId! }, query: { component, perPage: 500 } },
        })
      ).data?.data ?? [],
  });

  const draftByKey = useMemo(
    () => new Map(lines.filter((line) => line.action !== "add").map((line) => [line.lineKey, line])),
    [lines],
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line.component, (map.get(line.component) ?? 0) + 1);
    return map;
  }, [lines]);

  if (!can("factory_prices.propose")) return null;

  /** The value a cell starts from: the draft's proposal for that line, else the price in force. */
  const baseline = (row: Row): Values => {
    const draft = draftByKey.get(row.lineKey);
    const values = {
      ...(row.values as Values),
      ...((draft?.action === "change" ? draft.proposedValues : null) as Values | null),
    };
    // "4.600000" reads "4.60" in the cell; `same` compares numbers, so trimming is no change.
    for (const column of valueColumns)
      if (column.type === "decimal" && typeof values[column.key] === "string")
        values[column.key] = decimalText(values[column.key] as string);
    return values;
  };

  const needle = search.trim().toLocaleLowerCase();
  const sheet = sortRows(rows.data ?? [], dimensions, show).filter(
    (row) =>
      !needle ||
      all.some((column) =>
        show(column, (row.values as Values)[column.key])
          .toLocaleLowerCase()
          .includes(needle),
      ),
  );

  function edit(row: Row, key: string, value: unknown) {
    const start = baseline(row);
    const next = { ...(pending[row.lineKey]?.values ?? {}), [key]: value };
    if (same(start[key], value)) delete next[key];
    const copy = { ...pending };
    if (Object.keys(next).length || copy[row.lineKey]?.remove)
      copy[row.lineKey] = { ...copy[row.lineKey], values: next };
    else delete copy[row.lineKey];
    setPending(copy);
  }

  function toggleRemove(row: Row) {
    const copy = { ...pending };
    const now = copy[row.lineKey];
    if (now?.remove) {
      if (Object.keys(now.values).length) copy[row.lineKey] = { values: now.values };
      else delete copy[row.lineKey];
    } else copy[row.lineKey] = { values: now?.values ?? {}, remove: true };
    setPending(copy);
  }

  async function replace(next: LineInput[], success: string) {
    setBusy(true);
    try {
      await browserApi().PUT("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/lines", {
        params: { path: { factoryId, proposalId } },
        body: { lines: next },
      });
      toast.success(success);
      setPending({});
      setAdded([]);
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

  function save() {
    const byKey = new Map((rows.data ?? []).map((row) => [row.lineKey, row]));
    const touched = new Set(Object.keys(pending));
    const keep = lines.filter((line) => line.action === "add" || !touched.has(line.lineKey)).map(lineToInput);
    const next: LineInput[] = [...keep];
    for (const [lineKey, change] of Object.entries(pending)) {
      const row = byKey.get(lineKey);
      if (!row) continue;
      if (change.remove) {
        next.push({ action: "remove", component, lineKey });
        continue;
      }
      const merged = { ...baseline(row), ...change.values };
      const bad = valueColumns.filter((column) => invalid(column, merged[column.key]));
      if (bad.length)
        return void toast.error(t("invalid", { columns: bad.map((column) => label(column.key)).join(", ") }));
      // A change carries the whole line, its identifying columns included, as the API checks it.
      const typed = Object.fromEntries(all.map((column) => [column.key, typedValue(column, merged[column.key])]));
      // Back to the price in force: nothing to propose for this line.
      if (valueColumns.every((column) => same((row.values as Values)[column.key], typed[column.key]))) continue;
      next.push({ action: "change", component, lineKey, values: typed });
    }
    for (const values of added) {
      const bad = all.filter((column) => invalid(column, values[column.key]));
      if (bad.length)
        return void toast.error(t("invalid", { columns: bad.map((column) => label(column.key)).join(", ") }));
      next.push({
        action: "add",
        component,
        values: Object.fromEntries(all.map((column) => [column.key, typedValue(column, values[column.key])])),
      });
    }
    void replace(next, t("saved", { count: dirty }));
  }

  async function upload(file: File) {
    try {
      const [{ readSheet }, { sheetToLines }] = await Promise.all([import("./sheet"), import("./lines")]);
      setPreview({ ...sheetToLines(await readSheet(file), definitions), name: file.name });
    } catch {
      toast.error(t("unreadable", { name: file.name }));
    }
  }

  async function download() {
    const { templateCsv } = await import("./lines");
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

  const cellInput = (column: Column, value: unknown, onChange: (value: unknown) => void, changed: boolean) => {
    const bad = changed && invalid(column, value);
    const className = cn(
      "rounded-control border-border-strong bg-surface h-9 w-full min-w-24 border px-2 text-sm tabular-nums",
      NUMERIC.includes(column.type) && "text-end",
      changed && "border-warning bg-warning-subtle",
      bad && "border-danger",
    );
    if (column.type === "ref" || column.type === "boolean") {
      const options =
        column.type === "boolean"
          ? [
              { value: "true", label: labels.yes },
              { value: "false", label: labels.no },
            ]
          : references
              .filter((item) => item.column === column.key)
              .map((item) => ({ value: item.id, label: item.name }));
      return (
        <select
          aria-label={label(column.key)}
          className={cn(className, "min-w-32")}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? null
                : column.type === "boolean"
                  ? event.target.value === "true"
                  : event.target.value,
            )
          }
        >
          <option value="">{column.nullable ? labels.open : t("choose")}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        aria-label={label(column.key)}
        aria-invalid={bad || undefined}
        className={className}
        inputMode={column.type === "text" ? "text" : "decimal"}
        placeholder={column.nullable ? labels.open : undefined}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1 — what the draft holds now, old → new */}
      <section aria-labelledby="draft-changes" className="flex flex-col gap-2">
        <h3 id="draft-changes" className="font-semibold">
          {t("draftLinesCount", { count: lines.length })}
        </h3>
        {lines.length ? (
          <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
            {lines.map((line) => {
              const columns = columnsOf(allDefinitions, line.component);
              const current = (line.currentValues ?? {}) as Values;
              const proposed = (line.proposedValues ?? {}) as Values;
              const shown =
                line.action === "change"
                  ? columns.values.filter((column) => !same(current[column.key], proposed[column.key]))
                  : line.action === "add"
                    ? columns.values
                    : [];
              const where = columns.dimensions
                .map((column) => show(column, (line.action === "add" ? proposed : current)[column.key]))
                .join(" · ");
              return (
                <li key={line.id} className="flex flex-wrap items-start gap-3 p-3">
                  <Badge tone={line.action === "remove" ? "danger" : line.action === "add" ? "success" : "warning"}>
                    {tActions(line.action)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{tComponents(line.component)}</span>
                      {where ? <span className="text-muted"> · {where}</span> : null}
                    </p>
                    {shown.length ? (
                      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                        {shown.map((column) => {
                          const before = current[column.key];
                          const after = proposed[column.key];
                          const up =
                            line.action === "change" && NUMERIC.includes(column.type) && Number(after) > Number(before);
                          const down =
                            line.action === "change" && NUMERIC.includes(column.type) && Number(after) < Number(before);
                          return (
                            <li key={column.key}>
                              <span className="text-muted">{label(column.key)}</span>{" "}
                              {line.action === "change" ? (
                                <>
                                  <span className="text-muted line-through">{show(column, before)}</span> →{" "}
                                </>
                              ) : null}
                              <span className="font-semibold">{show(column, after)}</span>
                              {up ? (
                                <Icon
                                  name="trend-up"
                                  size={14}
                                  className="text-danger ms-1 inline"
                                  aria-label={t("up")}
                                />
                              ) : down ? (
                                <Icon
                                  name="trend-down"
                                  size={14}
                                  className="text-success ms-1 inline"
                                  aria-label={t("down")}
                                />
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : line.action === "change" ? (
                      <p className="text-warning-subtle-fg mt-1 text-sm">{t("unchanged")}</p>
                    ) : null}
                  </div>
                  <IconButton
                    name="trash"
                    variant="ghost"
                    size="md"
                    label={t("removeFromDraft")}
                    disabled={busy}
                    onClick={() =>
                      void replace(lines.filter((item) => item.id !== line.id).map(lineToInput), t("removed"))
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-border text-muted rounded-xl border border-dashed p-4 text-sm">{t("noLines")}</p>
        )}
      </section>

      {/* 2 — the price list as a sheet */}
      <section aria-labelledby="sheet-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h3 id="sheet-title" className="font-semibold">
              {t("changeTitle")}
            </h3>
            <p className="text-muted text-sm">{t("changeBody")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium">
            {t("component")}
            <NativeSelect
              value={component}
              disabled={dirty > 0}
              onValueChange={(value) => {
                setComponent(value as Component);
                setSearch("");
              }}
              options={definitions.map((item) => ({
                value: item.component,
                label: counts.get(item.component)
                  ? `${tComponents(item.component)} — ${t("inDraft", { count: counts.get(item.component)! })}`
                  : tComponents(item.component),
              }))}
            />
          </label>
          <label className="flex min-w-56 flex-col gap-1 text-sm font-medium">
            {t("search")}
            <SearchInput
              value={search}
              onValueChange={setSearch}
              clearLabel={t("clear")}
              placeholder={t("searchHint")}
            />
          </label>
        </div>
        {dirty > 0 ? <p className="text-muted text-xs">{t("saveFirst")}</p> : null}

        {versionId && rows.isPending ? (
          <p className="text-muted">{t("loadingLines")}</p>
        ) : (
          <div className="border-border bg-surface max-h-[65vh] overflow-auto rounded-xl border" tabIndex={0}>
            <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
              <thead className="sticky top-0 z-10">
                <tr>
                  {all.map((column, index) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "border-border border-b px-2 py-2 text-start align-bottom font-medium",
                        index < dimensions.length ? "bg-surface-subtle" : "bg-sage-subtle",
                        index === dimensions.length && "border-s",
                      )}
                    >
                      {label(column.key)}
                    </th>
                  ))}
                  <th scope="col" className="bg-surface-subtle border-border border-b px-2 py-2">
                    <span className="sr-only">{t("rowActions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((row) => {
                  const start = baseline(row);
                  const change = pending[row.lineKey];
                  const inDraft = draftByKey.get(row.lineKey);
                  const removing = change?.remove ?? (inDraft?.action === "remove" && !change);
                  return (
                    <tr key={row.lineKey} className={cn(removing && "bg-danger-subtle/40")}>
                      {dimensions.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            "border-border border-b px-2 py-1.5 whitespace-nowrap",
                            removing && "line-through",
                          )}
                        >
                          {show(column, (row.values as Values)[column.key])}
                        </td>
                      ))}
                      {valueColumns.map((column, index) => {
                        const value = change?.values[column.key] ?? start[column.key];
                        const original = (row.values as Values)[column.key];
                        const changed = !same(original, value);
                        return (
                          <td
                            key={column.key}
                            className={cn("border-border border-b px-2 py-1.5 align-top", index === 0 && "border-s")}
                          >
                            {removing ? (
                              <span className="text-muted line-through">{show(column, original)}</span>
                            ) : (
                              <>
                                {cellInput(column, value, (next) => edit(row, column.key, next), changed)}
                                {changed ? (
                                  <span className="text-muted mt-0.5 block text-xs">
                                    {t("was", { value: show(column, original) })}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-border border-b px-1 py-1.5 text-end whitespace-nowrap">
                        {change && !change.remove ? (
                          <IconButton
                            name="undo"
                            variant="ghost"
                            size="sm"
                            label={t("revert")}
                            onClick={() => {
                              const copy = { ...pending };
                              delete copy[row.lineKey];
                              setPending(copy);
                            }}
                          />
                        ) : null}
                        <IconButton
                          name={removing ? "undo" : "trash"}
                          variant="ghost"
                          size="sm"
                          label={removing ? t("keepLine") : t("addRemove")}
                          onClick={() => toggleRemove(row)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {added.map((values, at) => (
                  <tr key={`new-${at}`} className="bg-success-subtle/40">
                    {all.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          "border-border border-b px-2 py-1.5 align-top",
                          index === dimensions.length && "border-s",
                        )}
                      >
                        {cellInput(
                          column,
                          values[column.key],
                          (next) =>
                            setAdded(added.map((item, i) => (i === at ? { ...item, [column.key]: next } : item))),
                          true,
                        )}
                      </td>
                    ))}
                    <td className="border-border border-b px-1 py-1.5 text-end">
                      <IconButton
                        name="close"
                        variant="ghost"
                        size="sm"
                        label={t("dropNew")}
                        onClick={() => setAdded(added.filter((_, i) => i !== at))}
                      />
                    </td>
                  </tr>
                ))}
                {!sheet.length && !added.length ? (
                  <tr>
                    <td colSpan={all.length + 1} className="text-muted p-6 text-center">
                      {needle ? t("noMatch") : t("noRows")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        <Button
          variant="secondary"
          size="md"
          iconStart="plus"
          className="self-start"
          onClick={() => setAdded([...added, {}])}
        >
          {t("addNew")}
        </Button>
      </section>

      {/* 3 — a whole sheet at once, for many changes */}
      <details className="border-border rounded-xl border">
        <summary className="hover:bg-surface-subtle flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-4 font-medium">
          <Icon name="spreadsheet" size={18} />
          {t("sheetTitle")}
        </summary>
        <Card padding="lg" className="flex flex-col gap-4 border-0">
          <Callout tone="warning" title={t("sheetWarnTitle")}>
            {t("sheetBody")}
          </Callout>
          <Button
            size="md"
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
                    {tActions(line.action)} · {tComponents(line.component)} ·{" "}
                    {columnsOf(definitions, line.component)
                      .all.map(
                        (column) =>
                          `${label(column.key)} ${show(column, (line.values as Values | undefined)?.[column.key])}`,
                      )
                      .join(" · ")}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
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
      </details>

      {/* The save bar follows the sheet while anything is unsaved. */}
      {dirty > 0 ? (
        <div
          role="region"
          aria-label={t("unsavedRegion")}
          className="border-border bg-surface shadow-overlay sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border p-3"
        >
          <Icon name="edit" size={18} className="text-warning" />
          <p className="min-w-0 flex-1 text-sm font-medium">{t("unsaved", { count: dirty })}</p>
          <Button
            variant="ghost"
            size="md"
            disabled={busy}
            onClick={() => {
              setPending({});
              setAdded([]);
            }}
          >
            {t("discard")}
          </Button>
          <Button size="md" iconStart="save" loading={busy} onClick={save}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
