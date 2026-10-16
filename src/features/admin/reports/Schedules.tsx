"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { ComboboxOption } from "@/ui/components/Combobox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";

import { RecordPicker } from "../agents/Pickers";
import {
  adminBrowserApis,
  download,
  FormDialog,
  FormError,
  problemMessage,
  QueryError,
  Section,
  SectionNav,
  useCan,
  useProductTypes,
} from "../console";
import { useReportCatalogue, type ReportDefinition, type ReportKey } from "./data";

type Schedule = Schemas["ReportScheduleDto"];
type Run = Schemas["ReportRunDto"];
type Frequency = Schemas["ReportFrequency"];
type Period = Schemas["RelativePeriod"];
type Format = Schemas["ReportFormat"];

const FREQUENCIES = ["daily", "weekly", "monthly"] as const satisfies readonly Frequency[];
const PERIODS = [
  "previous_day",
  "previous_week",
  "previous_month",
  "month_to_date",
  "year_to_date",
] as const satisfies readonly Period[];

/** The reports desk's sections: the reports themselves, the schedules, and the files made. */
export function ReportsNav() {
  const t = useTranslations("reports.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/reports", label: t("reports"), exact: true },
        { href: "/reports/schedules", label: t("schedules") },
        { href: "/reports/files", label: t("files") },
      ]}
    />
  );
}

function useReportName() {
  const locale = useLocale();
  const catalogue = useReportCatalogue();
  return (key: string) => {
    const report = catalogue.data?.find((item) => item.key === key);
    return report ? (locale === "en" ? report.nameEn : report.nameTh) : key;
  };
}

function useScheduleText() {
  const t = useTranslations("reports.schedules");
  return (schedule: Pick<Schedule, "frequency" | "dayOfWeek" | "dayOfMonth" | "runAt">) =>
    schedule.frequency === "daily"
      ? t("when.daily", { at: schedule.runAt })
      : schedule.frequency === "weekly"
        ? t("when.weekly", { day: t(`weekdays.${schedule.dayOfWeek ?? 1}`), at: schedule.runAt })
        : t("when.monthly", { day: schedule.dayOfMonth ?? 1, at: schedule.runAt });
}

/**
 * Report schedules (D-111, D-033): a report run daily, weekly or monthly at a time of day in
 * Bangkok, over a relative period, for staff who may read and export it — they are told in-app and
 * by e-mail and download the file in getpack; the data is never attached. A schedule is not edited:
 * it is switched off and a new one made.
 */
export function ReportSchedules() {
  const t = useTranslations("reports.schedules");
  const reportName = useReportName();
  const scheduleText = useScheduleText();
  const queryClient = useQueryClient();
  const canSchedule = useCan("reports.schedule");
  const [creating, setCreating] = useState(false);
  const schedules = useQuery({
    queryKey: queryKeys.list("admin", "report_schedule"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/report-schedules")).data!,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "report_schedule") });
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "report_run") });
  };
  const act = useMutation({
    mutationFn: async ({ schedule, action }: { schedule: Schedule; action: "run" | "activate" | "deactivate" }) => {
      const { contract } = adminBrowserApis();
      const path = { scheduleId: schedule.id };
      if (action === "run")
        return contract.POST("/v1/admin/report-schedules/{scheduleId}/actions/run", { params: { path } });
      if (action === "activate")
        return contract.POST("/v1/admin/report-schedules/{scheduleId}/actions/activate", { params: { path } });
      return contract.POST("/v1/admin/report-schedules/{scheduleId}/actions/deactivate", { params: { path } });
    },
    onSuccess: (_, { action }) => {
      toast.success(t(`done.${action}`));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const columns: DataTableColumn<Schedule>[] = [
    {
      id: "name",
      header: t("columns.name"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted text-xs">
            {reportName(row.reportKey)} · {row.format.toUpperCase()}
            {row.filters.period ? ` · ${t(`periods.${row.filters.period}`)}` : ""}
          </span>
        </div>
      ),
    },
    { id: "when", header: t("columns.when"), cell: (row) => scheduleText(row) },
    {
      id: "next",
      header: t("columns.next"),
      cell: (row) => (row.active ? <When at={row.nextRunAt} /> : <Badge size="sm">{t("off")}</Badge>),
    },
    { id: "last", header: t("columns.last"), hideable: true, cell: (row) => <When at={row.lastRunAt} /> },
    {
      id: "recipients",
      header: t("columns.recipients"),
      cell: (row) => <span className="text-sm">{row.recipients.map((person) => person.displayName).join(", ")}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      cell: (row) =>
        canSchedule ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              iconStart="play"
              loading={act.isPending && act.variables?.schedule.id === row.id && act.variables.action === "run"}
              onClick={() => act.mutate({ schedule: row, action: "run" })}
            >
              {t("runNow")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act.mutate({ schedule: row, action: row.active ? "deactivate" : "activate" })}
            >
              {row.active ? t("deactivate") : t("activate")}
            </Button>
          </div>
        ) : null,
    },
  ];

  if (schedules.isError) return <QueryError error={schedules.error} onRetry={() => void schedules.refetch()} />;
  return (
    <Section
      title={t("title")}
      description={t("body")}
      actions={
        canSchedule ? (
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={schedules.data ?? []}
        getRowId={(row) => row.id}
        loading={schedules.isPending}
        empty={<EmptyState icon="calendar" title={t("empty")} description={t("emptyHint")} />}
      />
      {creating ? <CreateScheduleDialog onClose={() => setCreating(false)} onDone={refresh} /> : null}
    </Section>
  );
}

function CreateScheduleDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reports.schedules.create");
  const tSchedules = useTranslations("reports.schedules");
  const tReports = useTranslations("reports");
  const locale = useLocale();
  const catalogue = useReportCatalogue();
  const types = useProductTypes();
  const [reportKey, setReportKey] = useState<ReportKey | "">("");
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("xlsx");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [runAt, setRunAt] = useState("07:00");
  const [period, setPeriod] = useState<Period>("previous_week");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [factory, setFactory] = useState<ComboboxOption | null>(null);
  const [recipients, setRecipients] = useState<ComboboxOption[]>([]);
  const report: ReportDefinition | undefined = catalogue.data?.find((item) => item.key === reportKey);
  const extra = (report?.filters ?? []).filter((filter) => filter.key !== "period");
  return (
    <FormDialog
      size="lg"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!report) throw new FormError(t("needReport"));
        if (!name.trim()) throw new FormError(t("needName"));
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runAt)) throw new FormError(t("badTime"));
        if (recipients.length === 0) throw new FormError(t("needRecipients"));
        for (const filter of extra) {
          const value = filter.key === "factoryId" ? factory?.value : filters[filter.key];
          if (filter.required && !value) throw new FormError(t("needFilter", { filter: t(`filters.${filter.key}`) }));
        }
        await adminBrowserApis().contract.POST("/v1/admin/report-schedules", {
          body: {
            reportKey: report.key,
            name: name.trim(),
            format,
            frequency,
            runAt,
            ...(frequency === "weekly" ? { dayOfWeek: Number(dayOfWeek) } : {}),
            ...(frequency === "monthly" ? { dayOfMonth: Number(dayOfMonth) } : {}),
            filters: {
              ...(report.filters.some((filter) => filter.key === "period") ? { period } : {}),
              ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
              ...(factory ? { factoryId: factory.value } : {}),
            },
            recipientIds: recipients.map((person) => person.value),
          },
        });
        toast.success(t("done"));
        onDone();
        onClose();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("report")} required>
          <SearchableSelect
            value={reportKey || undefined}
            placeholder={t("choose")}
            onValueChange={(value) => {
              setReportKey(value as ReportKey);
              setFilters({});
              const chosen = catalogue.data?.find((item) => item.key === value);
              if (chosen && !chosen.formats.includes(format)) setFormat(chosen.formats[0] ?? "xlsx");
            }}
            options={(catalogue.data ?? []).map((item) => ({
              value: item.key,
              label: locale === "en" ? item.nameEn : item.nameTh,
            }))}
          />
        </Field>
        <Field label={t("name")} hint={t("nameHint")} required>
          <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={t("frequency")} required>
          <NativeSelect
            value={frequency}
            onValueChange={(value) => setFrequency(value as Frequency)}
            options={FREQUENCIES.map((value) => ({ value, label: t(`frequencies.${value}`) }))}
          />
        </Field>
        {frequency === "weekly" ? (
          <Field label={t("dayOfWeek")}>
            <NativeSelect
              value={dayOfWeek}
              onValueChange={setDayOfWeek}
              options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({
                value: String(day),
                label: tSchedules(`weekdays.${day}`),
              }))}
            />
          </Field>
        ) : frequency === "monthly" ? (
          <Field label={t("dayOfMonth")} hint={t("dayOfMonthHint")}>
            <NativeSelect
              value={dayOfMonth}
              onValueChange={setDayOfMonth}
              options={Array.from({ length: 28 }, (_, index) => ({
                value: String(index + 1),
                label: String(index + 1),
              }))}
            />
          </Field>
        ) : (
          <span />
        )}
        <Field label={t("runAt")} hint={t("runAtHint")} required>
          <Input type="time" value={runAt} onChange={(event) => setRunAt(event.target.value)} />
        </Field>
        <Field label={t("format")}>
          <NativeSelect
            value={format}
            onValueChange={(value) => setFormat(value as Format)}
            options={(report?.formats ?? ["xlsx", "csv"]).map((value) => ({ value, label: value.toUpperCase() }))}
          />
        </Field>
        {report?.filters.some((filter) => filter.key === "period") ? (
          <Field label={t("period")} hint={t("periodHint")}>
            <NativeSelect
              value={period}
              onValueChange={(value) => setPeriod(value as Period)}
              options={PERIODS.map((value) => ({ value, label: tSchedules(`periods.${value}`) }))}
            />
          </Field>
        ) : null}
        {extra.map((filter) =>
          filter.key === "factoryId" ? (
            <Field key={filter.key} label={t("filters.factoryId")} required={filter.required}>
              <RecordPicker
                kind="factory"
                value={factory}
                onValueChange={setFactory}
                aria-label={t("filters.factoryId")}
              />
            </Field>
          ) : filter.key === "productTypeId" ? (
            <Field key={filter.key} label={t("filters.productTypeId")} required={filter.required}>
              <SearchableSelect
                value={filters.productTypeId || "any"}
                onValueChange={(value) => setFilters({ ...filters, productTypeId: value === "any" ? "" : value })}
                options={[
                  { value: "any", label: t("any") },
                  ...types.types.map((type) => ({ value: type.id, label: types.labelOf(type.code) })),
                ]}
              />
            </Field>
          ) : filter.values ? (
            <Field
              key={filter.key}
              label={t.has(`filters.${filter.key}`) ? t(`filters.${filter.key}`) : filter.key}
              required={filter.required}
            >
              <SearchableSelect
                value={filters[filter.key] || "any"}
                onValueChange={(value) => setFilters({ ...filters, [filter.key]: value === "any" ? "" : value })}
                options={[
                  { value: "any", label: t("any") },
                  ...filter.values.map((value) => ({
                    value,
                    label: tReports.has(`values.${filter.key}.${value}`)
                      ? tReports(`values.${filter.key}.${value}`)
                      : value,
                  })),
                ]}
              />
            </Field>
          ) : null,
        )}
      </div>
      <Field label={t("recipients")} hint={t("recipientsHint")}>
        <RecordPicker
          kind="staff"
          value={null}
          onValueChange={(person) => {
            // Each person picked joins the list at once; the picker clears for the next one.
            if (person && !recipients.some((candidate) => candidate.value === person.value)) {
              setRecipients([...recipients, person]);
            }
          }}
          aria-label={t("recipients")}
        />
      </Field>
      {recipients.length ? (
        <ul className="flex flex-wrap gap-2">
          {recipients.map((person) => (
            <li key={person.value} className="bg-surface-subtle flex items-center gap-1 rounded-md px-2 py-1 text-sm">
              {person.label}
              <IconButton
                name="close"
                size="sm"
                variant="ghost"
                label={t("removeRecipient", { name: person.label })}
                onClick={() => setRecipients(recipients.filter((candidate) => candidate.value !== person.value))}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </FormDialog>
  );
}

/** A report run's state: the worker's job (`queued` → `running` → `succeeded` | `failed`). */
function RunStatus({ status }: { status: Run["status"] }) {
  const t = useTranslations("reports.files.statuses");
  const tone = { queued: "neutral", running: "info", succeeded: "success", failed: "danger" } as const;
  const icon = { queued: "hourglass", running: "spinner", succeeded: "check", failed: "warning" } as const;
  return (
    <Badge size="sm" tone={tone[status]} icon={icon[status]}>
      {t(status)}
    </Badge>
  );
}

/**
 * The report files (D-111): the newest runs of reports this person may read — their own exports
 * and the schedules they receive (all of them with `reports.schedule`) — each downloaded through a
 * five-minute signed URL.
 */
export function ReportFiles() {
  const t = useTranslations("reports.files");
  const tSchedules = useTranslations("reports.schedules");
  const format = useFormat();
  const reportName = useReportName();
  const [reportKey, setReportKey] = useState<string>("all");
  const catalogue = useReportCatalogue();
  const locale = useLocale();
  const runs = useQuery({
    queryKey: queryKeys.list("admin", "report_run", { reportKey }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/report-runs", {
          params: { query: reportKey === "all" ? {} : { reportKey: reportKey as ReportKey } },
        })
      ).data!,
  });
  const file = useMutation({
    mutationFn: async (runId: string) =>
      (await adminBrowserApis().contract.GET("/v1/admin/report-runs/{runId}/file", { params: { path: { runId } } }))
        .data!,
    onSuccess: (data) => download(data.url),
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const filterText = (run: Run) =>
    [
      run.filters.from && run.filters.to ? `${format.date(run.filters.from)} – ${format.date(run.filters.to)}` : null,
      run.filters.month ?? null,
      run.filters.asOf ? t("asOf", { date: format.date(run.filters.asOf) }) : null,
      run.filters.status ?? null,
      run.filters.channel ?? null,
    ]
      .filter(Boolean)
      .join(" · ");
  const columns: DataTableColumn<Run>[] = [
    {
      id: "report",
      header: t("columns.report"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{reportName(row.reportKey)}</span>
          <span className="text-muted text-xs">{filterText(row) || "–"}</span>
        </div>
      ),
    },
    { id: "status", header: t("columns.status"), cell: (row) => <RunStatus status={row.status} /> },
    { id: "queuedAt", header: t("columns.queued"), cell: (row) => <When at={row.queuedAt} /> },
    {
      id: "rows",
      header: t("columns.rows"),
      numeric: true,
      cell: (row) => (row.rowCount === null ? "–" : format.number(row.rowCount)),
    },
    {
      id: "source",
      header: t("columns.source"),
      cell: (row) =>
        row.scheduleId ? (
          <Badge size="sm" icon="calendar">
            {tSchedules("scheduled")}
          </Badge>
        ) : (
          t("manual")
        ),
    },
    {
      id: "download",
      header: <span className="sr-only">{t("columns.download")}</span>,
      cell: (row) =>
        row.status === "succeeded" ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="download"
            loading={file.isPending && file.variables === row.id}
            onClick={() => file.mutate(row.id)}
          >
            {row.format.toUpperCase()}
          </Button>
        ) : row.error ? (
          <span className="text-danger text-xs">{row.error}</span>
        ) : null,
    },
  ];
  if (runs.isError) return <QueryError error={runs.error} onRetry={() => void runs.refetch()} />;
  return (
    <Section title={t("title")} description={t("body")}>
      <Field label={t("filter")} className="mb-3 w-72">
        <SearchableSelect
          value={reportKey}
          onValueChange={setReportKey}
          options={[
            { value: "all", label: t("all") },
            ...(catalogue.data ?? []).map((item) => ({
              value: item.key,
              label: locale === "en" ? item.nameEn : item.nameTh,
            })),
          ]}
        />
      </Field>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={runs.data ?? []}
        getRowId={(row) => row.id}
        loading={runs.isPending}
        empty={<EmptyState icon="document" title={t("empty")} />}
      />
    </Section>
  );
}
