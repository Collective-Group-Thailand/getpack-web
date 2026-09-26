"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { CATALOG_STATUS, CONTENT_STATUS, type StatusMeta } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";

import {
  CrudList,
  defineResource,
  StatusChip,
  useCan,
  type FieldDef,
  type FilterDef,
  type InitialPage,
} from "../console";
import { createRow, deleteRow, updateRow, type CatalogueRow } from "./api";
import { FileField } from "./FileField";
import { buildSchema, emptyValues, NONE, toBody, toValues, type FormValues } from "./form-model";
import { listFor } from "./resources";
import { ENUMS, kindOf, tableByKey } from "./tables";
import { useRefs } from "./useRefs";

const MONO = new Set(["code", "sku", "slug", "pageKey", "postcode", "dielineKey"]);

function JsonField({ value, onChange, name }: { value: unknown; onChange: (value: unknown) => void; name: string }) {
  return (
    <Textarea
      name={name}
      rows={6}
      className="font-mono text-xs"
      spellCheck={false}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * One catalogue or CMS table (F2 2.5), from its declaration in `./tables.ts`: the list with its
 * filters and saved views, a side-sheet form built from the create DTO's fields, and edits sent
 * under the row's `ETag`. Rows are archived through their status; only the tables the contract
 * gives a `DELETE` can be deleted.
 */
export function CatalogueTable({
  tableKey,
  initial,
  toolbarEnd,
  extraColumns = [],
}: {
  tableKey: string;
  initial: InitialPage<CatalogueRow> | null;
  toolbarEnd?: React.ReactNode;
  /** A table's own controls — the quote mode of a product type, the order of home sections. */
  extraColumns?: readonly DataTableColumn<CatalogueRow>[];
}) {
  const def = tableByKey(tableKey)!;
  const t = useTranslations("catalogue");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const canImport = useCan("catalog.import");
  const refTables = [...def.columns, ...def.fields, ...def.filters]
    .map((field) => kindOf(def, field))
    .flatMap((kind) => (kind.kind === "ref" ? [kind.table] : []));
  const refs = useRefs(refTables);
  const statusMap: Record<string, StatusMeta> = def.status === "ContentStatus" ? CONTENT_STATUS : CATALOG_STATUS;

  const label = (field: string) => (t.has(`fields.${field}`) ? t(`fields.${field}`) : field);
  const enumLabel = (name: string, value: string) =>
    t.has(`enums.${name}.${value}`) ? t(`enums.${name}.${value}`) : value;

  const columns: DataTableColumn<CatalogueRow>[] = def.columns.map((field, index) => {
    const kind = kindOf(def, field);
    return {
      id: field,
      header: label(field),
      sortable: ["code", "sort", "nameTh", "name", "slug", "sku", "title", "pageKey"].includes(field),
      numeric: kind.kind === "number",
      hideable: index > 1,
      cell: (row) => {
        const value = row[field];
        if (value === null || value === undefined || value === "") return <span className="text-muted">–</span>;
        switch (kind.kind) {
          case "number":
            return format.number(Number(value));
          case "switch":
            return value ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="check" size={16} />
                <span className="sr-only">{t("yes")}</span>
              </span>
            ) : (
              <span className="text-muted">
                –<span className="sr-only">{t("no")}</span>
              </span>
            );
          case "enum":
            if (field === "status") {
              return <StatusChip map={statusMap} value={String(value)} />;
            }
            return enumLabel(kind.enum, String(value));
          case "ref":
            return (
              refs.labels[kind.table]?.get(String(value)) ?? (
                <span className="font-mono text-xs">{String(value).slice(0, 8)}</span>
              )
            );
          case "datetime":
            return <When at={String(value)} absoluteOnly />;
          case "file":
            return <Icon name="paperclip" size={16} label={t("hasFile")} />;
          case "json":
            return <span className="text-muted font-mono text-xs">{t("jsonSet")}</span>;
          default:
            return (
              <span className={MONO.has(field) ? "font-mono text-sm whitespace-nowrap" : "block max-w-72 truncate"}>
                {String(value)}
              </span>
            );
        }
      },
    };
  });

  const selectOptions = (field: string) => {
    const kind = kindOf(def, field);
    if (kind.kind === "enum") return ENUMS[kind.enum].map((value) => ({ value, label: enumLabel(kind.enum, value) }));
    if (kind.kind === "ref") return refs.options[kind.table] ?? [];
    return [];
  };

  const filters: FilterDef[] = [
    ...(def.status
      ? [
          {
            id: "status",
            label: label("status"),
            kind: "select" as const,
            options: ENUMS[def.status].map((value) => ({
              value,
              label: statusMap[value] ? tStatus(statusMap[value].labelKey) : value,
            })),
          },
        ]
      : []),
    ...def.filters.flatMap((field): FilterDef[] => {
      const kind = kindOf(def, field);
      if (kind.kind === "enum" || kind.kind === "ref") {
        return [{ id: field, label: label(field), kind: "select" as const, options: selectOptions(field) }];
      }
      return [{ id: field, label: label(field), kind: "text" as const }];
    }),
  ];

  const fields: FieldDef<FormValues>[] = def.fields.map((field) => {
    const kind = kindOf(def, field);
    const required = def.required.includes(field);
    const common = {
      name: field,
      label: label(field),
      required,
      hint: t.has(`hints.${field}`) ? t(`hints.${field}`) : undefined,
    };
    switch (kind.kind) {
      case "textarea":
        return { ...common, kind: "textarea", rows: 4 };
      case "number":
        return { ...common, kind: "number", unit: field.endsWith("Mm") ? t("units.mm") : undefined };
      case "switch":
        return { ...common, kind: "switch" };
      case "datetime":
        return { ...common, kind: "datetime", hint: t("bangkokTime") };
      case "enum":
      case "ref": {
        const options = selectOptions(field);
        const nullable = !required && field !== "status";
        return {
          ...common,
          kind: "select",
          options: nullable ? [{ value: NONE, label: t("none") }, ...options] : options,
        };
      }
      case "json":
        return {
          ...common,
          kind: "custom",
          hint: t("jsonHint"),
          render: ({ value, onChange }) => <JsonField name={field} value={value} onChange={onChange} />,
        };
      case "file":
        return {
          ...common,
          kind: "custom",
          render: ({ value, onChange }) => <FileField value={value} onChange={onChange} />,
        };
      default:
        return { ...common, kind: "text" };
    }
  });

  const config = defineResource<CatalogueRow, FormValues>({
    list: listFor(def),
    manage: def.manage,
    form: {
      schema: buildSchema(def) as never,
      empty: emptyValues(def),
      toValues: (row) => toValues(def, row),
      create: ({ contract }, values) => createRow(contract, def.path, toBody(def, values, "create")),
      update: ({ contract }, row, values) => updateRow(contract, def.path, row.id, toBody(def, values, "update")),
    },
    ...(def.deletable ? { remove: ({ contract }, row: CatalogueRow) => deleteRow(contract, def.path, row.id) } : {}),
  });

  return (
    <CrudList
      config={config}
      columns={[...columns, ...extraColumns]}
      caption={t(`tables.${def.key}.title`)}
      fields={fields}
      filters={filters}
      searchLabel={t("search")}
      initial={initial}
      toolbarEnd={
        <>
          {toolbarEnd}
          {def.importKind && canImport ? (
            <Button size="sm" variant="secondary" iconStart="spreadsheet" asChild>
              <Link href={`/catalogue/import?kind=${def.importKind}`}>{t("importExport")}</Link>
            </Button>
          ) : null}
        </>
      }
      labels={{
        create: t("create"),
        createTitle: t("createTitle", { table: t(`tables.${def.key}.title`) }),
        editTitle: (row) => t("editTitle", { name: listFor(def).getRowName!(row) }),
        empty: t("empty"),
      }}
    />
  );
}
