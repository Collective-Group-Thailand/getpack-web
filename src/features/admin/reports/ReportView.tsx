"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";

import { bangkokToday } from "../analytics/period";
import { adminBrowserApis, QueryError, useCan, useProductTypes } from "../console";
import { useReportCatalogue, type ReportDefinition } from "./data";
import { ReportExport } from "./ReportExport";

type Cell = string | number | boolean | null;
type ColumnType = Schemas["ReportColumnType"];
type Filters = Schemas["ReportFiltersDto"];
type OptionalKey = Exclude<Schemas["ReportFilterKey"], "period">;
type Preset = Schemas["RelativePeriod"] | "custom";

const PRESETS: readonly Preset[] = [
  "month_to_date",
  "previous_day",
  "previous_week",
  "previous_month",
  "year_to_date",
  "custom",
];
const NUMERIC: readonly ColumnType[] = ["money", "integer", "decimal", "percent"];

interface Draft {
  preset: Preset;
  from: string;
  to: string;
  asOf: string;
  month: string;
  values: Partial<Record<OptionalKey, string>>;
}

/** The filters the API takes for this report, or `null` while a required one is missing. */
function filtersOf(definition: ReportDefinition, draft: Draft): Filters | null {
  const filters: Filters = {};
  for (const filter of definition.filters) {
    if (filter.key === "period") {
      if (filter.kind === "range") {
        // A relative period is the API's to resolve in Asia/Bangkok; custom dates are sent as chosen.
        if (draft.preset !== "custom") filters.period = draft.preset;
        else if (draft.from && draft.to) Object.assign(filters, { from: draft.from, to: draft.to });
        else if (filter.required) return null;
      } else if (filter.kind === "as_of") {
        if (draft.asOf) filters.asOf = draft.asOf;
        else if (filter.required) return null;
      } else if (filter.kind === "month") {
        if (draft.month) filters.month = draft.month;
        else if (filter.required) return null;
      }
      continue;
    }
    const value = draft.values[filter.key];
    if (value) filters[filter.key] = value;
    else if (filter.required) return null;
  }
  return filters;
}

/**
 * One operational report (F2 2.8, B6.2, `admin.reports.preview`): the period (a relative one, custom
 * dates, a month or an "as of" date, as the report defines), its own filters, and a typed preview
 * of the first rows. The full data is the export (`admin.reports.export`). Nothing is summed here.
 */
export function ReportView({ reportKey }: { reportKey: string }) {
  const t = useTranslations("reports");
  const format = useFormat();
  const canExport = useCan("reports.export");
  const canFactories = useCan("partners.read");
  const productTypes = useProductTypes();
  const [draft, setDraft] = useState<Draft>(() => {
    const today = bangkokToday();
    return { preset: "month_to_date", from: "", to: "", asOf: today, month: today.slice(0, 7), values: {} };
  });
  const [applied, setApplied] = useState(draft);

  const definitions = useReportCatalogue();
  const definition = definitions.data?.find((report) => report.key === reportKey);
  const filters = definition ? filtersOf(definition, applied) : null;
  const needsFactories = Boolean(definition?.filters.some((filter) => filter.key === "factoryId"));
  const factories = useQuery({
    queryKey: queryKeys.list("admin", "factory", { perPage: 100 }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/factories", { params: { query: { perPage: 100 } } })).data!,
    enabled: needsFactories && canFactories,
  });
  const preview = useQuery({
    queryKey: queryKeys.list("admin", "report", { key: reportKey, ...filters }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/reports/{reportKey}/preview", {
          params: { path: { reportKey }, query: filters! },
        })
      ).data!,
    enabled: filters !== null,
  });

  const name = definition ? (format.locale === "en" ? definition.nameEn : definition.nameTh) : "";
  // The API sends codes; the words are ours, with the code itself when we have none.
  const keyed = (group: string, key: string) => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key);
  const cell = (type: ColumnType, value: Cell) => {
    if (value === null || value === "") return "–";
    switch (type) {
      case "money":
        return format.thb(String(value));
      case "integer":
        return format.number(Number(value));
      case "decimal":
        return format.number(Number(value), { maximumFractionDigits: 4 });
      case "percent":
        return format.percent(String(value));
      case "date":
        return format.date(`${value}T00:00:00+07:00`);
      case "datetime":
        return format.dateTime(String(value));
      case "boolean":
        return value ? t("yes") : t("no");
      default:
        return String(value);
    }
  };
  const optionsFor = (key: OptionalKey, values: string[] | null) => {
    if (values) return values.map((value) => ({ value, label: keyed(`values.${key}`, value) }));
    if (key === "productTypeId")
      return productTypes.types.map((type) => ({
        value: type.id,
        label: format.locale === "en" ? type.nameEn : type.nameTh,
      }));
    if (key === "factoryId")
      return (factories.data?.data ?? []).map((factory) => ({
        value: factory.id,
        label: `${factory.code} ${factory.legalName}`,
      }));
    return [];
  };
  const data = preview.data;
  const description = definition
    ? t.has(`notes.${reportKey}`)
      ? t(`notes.${reportKey}`)
      : definition.description
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs label={t("breadcrumb")} items={[{ label: t("title"), href: "/reports" }, { label: name }]} />
        }
        title={name || t("title")}
        description={description}
        actions={
          definition && canExport ? (
            <ReportExport
              reportKey={reportKey}
              formats={definition.formats}
              filters={filters ?? {}}
              disabled={filters === null}
            />
          ) : null
        }
      />
      {definitions.isError ? <QueryError error={definitions.error} onRetry={() => void definitions.refetch()} /> : null}
      {definitions.data && !definition ? <EmptyState icon="lock" title={t("unavailable")} /> : null}

      {definition ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(draft);
          }}
        >
          {definition.filters.map((filter) => {
            if (filter.key === "period" && filter.kind === "range")
              return (
                <div key="range" className="contents">
                  <Field label={t("period")}>
                    <Select
                      value={draft.preset}
                      onValueChange={(preset) => setDraft({ ...draft, preset })}
                      options={PRESETS.map((value) => ({ value, label: t(`presets.${value}`) }))}
                    />
                  </Field>
                  {draft.preset === "custom" ? (
                    <>
                      <Field label={t("from")} required={filter.required}>
                        <Input
                          type="date"
                          value={draft.from}
                          onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                        />
                      </Field>
                      <Field label={t("to")} required={filter.required}>
                        <Input
                          type="date"
                          value={draft.to}
                          onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
              );
            if (filter.key === "period")
              return filter.kind === "month" ? (
                <Field key="month" label={t("month")} required={filter.required}>
                  <Input
                    type="month"
                    value={draft.month}
                    onChange={(event) => setDraft({ ...draft, month: event.target.value })}
                  />
                </Field>
              ) : (
                <Field key="asOf" label={t("asOf")} required={filter.required}>
                  <Input
                    type="date"
                    value={draft.asOf}
                    onChange={(event) => setDraft({ ...draft, asOf: event.target.value })}
                  />
                </Field>
              );
            const key = filter.key;
            const options = optionsFor(key, filter.values);
            // A picker whose list this role cannot read is left out; the report runs without it.
            if (filter.kind === "uuid" && options.length === 0) return null;
            return (
              <Field key={key} label={t(`filters.${key}`)}>
                <Select
                  value={draft.values[key] || "all"}
                  onValueChange={(value) =>
                    setDraft({ ...draft, values: { ...draft.values, [key]: value === "all" ? "" : value } })
                  }
                  options={[{ value: "all", label: t("all") }, ...options]}
                />
              </Field>
            );
          })}
          <Button type="submit" iconStart="filter">
            {t("run")}
          </Button>
        </form>
      ) : null}

      {definition && filters === null ? <p className="text-muted text-sm">{t("chooseFilters")}</p> : null}
      {preview.isError ? <QueryError error={preview.error} onRetry={() => void preview.refetch()} /> : null}
      {filters !== null && !data && !preview.isError ? <Skeleton className="h-64 w-full" /> : null}
      {data ? (
        <>
          {data.filters.from && data.filters.to ? (
            <p className="text-muted text-sm">
              {t("resolved", {
                from: format.date(`${data.filters.from}T00:00:00+07:00`),
                to: format.date(`${data.filters.to}T00:00:00+07:00`),
              })}
            </p>
          ) : null}
          {/* CONTRACT-GAP admin.reports — no totals row, no pagination past the preview, no generatedAt. */}
          <div className="bg-surface overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">{name}</caption>
              <thead className="bg-surface-subtle">
                <tr className="text-muted text-left text-xs">
                  {data.columns.map((item) => (
                    <th
                      key={item.key}
                      scope="col"
                      className={`px-3 py-2 font-medium ${NUMERIC.includes(item.type) ? "text-right" : ""}`}
                    >
                      {format.locale === "en" ? item.labelEn : item.labelTh}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={data.columns.length} className="text-muted px-3 py-6 text-center">
                      {t("empty")}
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, at) => (
                    <tr key={at}>
                      {data.columns.map((item) => (
                        <td
                          key={item.key}
                          className={`px-3 py-2 ${NUMERIC.includes(item.type) ? "text-right tabular-nums" : ""}`}
                        >
                          {cell(item.type, row[item.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data.truncated ? (
            <Callout tone="info" title={t("truncated", { rows: format.number(data.rows.length) })}>
              {canExport ? t("truncatedExport") : null}
            </Callout>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
