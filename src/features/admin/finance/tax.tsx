"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isZeroMoney } from "@/domain/money";
import { SETTING_VERSION_STATUS, TAX_CALENDAR_STATUS, TAX_REPORT_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { JsonView } from "@/ui/components/JsonView";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import { effectiveInstant, useFiscalYears } from "./ledger";
import { Figure, journalHref, sourceHref } from "./shared";

type Report = Schemas["TaxReportDto"];
type Kind = Schemas["TaxReportKind"];
type Line = Record<string, string | number | boolean | null>;

export const TAX_KINDS = [
  "sales_tax",
  "purchase_tax",
  "pp30",
  "pnd3",
  "pnd53",
  "wht_issued_register",
  "wht_received_register",
] as const satisfies readonly Kind[];
const PAYABLE: readonly Kind[] = ["pp30", "pnd3", "pnd53"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const thisMonth = () => bangkokToday().slice(0, 7);

export function TaxNav() {
  const t = useTranslations("finance.tax.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/tax", label: t("reports"), exact: true },
        { href: "/finance/tax/calendar", label: t("calendar") },
        { href: "/finance/tax/settings", label: t("settings") },
        { href: "/finance/tax/series", label: t("series") },
      ]}
    />
  );
}

/** The reconciliation of a report with its GL accounts, as the API computed it (§7 step 7). */
function Difference({ amount }: { amount: string }) {
  const t = useTranslations("finance.tax");
  const format = useFormat();
  return isZeroMoney(amount) ? (
    <Badge tone="success" size="sm" icon="check">
      {t("reconciled")}
    </Badge>
  ) : (
    <Badge tone="danger" size="sm" icon="warning">
      {t("differs", { amount: format.thb(amount) })}
    </Badge>
  );
}

/* ----------------------------------------------------------------------------------- reports */

/**
 * The month's tax papers (§6, D-033): the sales and purchase tax reports, the ภ.พ.30 working
 * paper, ภ.ง.ด.3 / 53 and the two WHT registers. Each is built from the posted journals and
 * certificates and reconciled to its GL control accounts; it can be finalised only at 0.
 */
export function TaxReports() {
  const t = useTranslations("finance.tax.reports");
  const tKinds = useTranslations("finance.tax.kinds");
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = useCan("tax.manage");
  const years = useFiscalYears();
  const month = params.get("period") ?? thisMonth();
  const reports = useQuery({
    queryKey: queryKeys.list("admin", "tax-report", { period: month }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/tax-reports", { params: { query: { period: month } } })).data!,
  });
  const [busy, setBusy] = useState<Kind | "all" | null>(null);
  const months = (years.data ?? [])
    .flatMap((year) => year.periods)
    .filter((period) => period.startDate <= bangkokToday())
    .map((period) => period.startDate.slice(0, 7))
    .reverse();

  async function generate(kinds: readonly Kind[]) {
    setBusy(kinds.length > 1 ? "all" : kinds[0]!);
    try {
      for (const kind of kinds)
        await adminBrowserApis().contract.POST("/v1/admin/tax-reports", {
          params: { header: { "Idempotency-Key": crypto.randomUUID() } },
          body: { kind, period: month },
        });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "tax-report") });
      toast.success(t("generated"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(null);
    }
  }

  if (reports.isError) return <QueryError error={reports.error} onRetry={() => void reports.refetch()} />;
  const byKind = new Map((reports.data ?? []).map((report) => [report.kind, report]));
  const rows = TAX_KINDS.map((kind) => ({ kind, report: byKind.get(kind) ?? null }));
  const drafts = TAX_KINDS.filter((kind) => !byKind.get(kind) || byKind.get(kind)!.status === "draft");
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      id: "kind",
      header: t("columns.report"),
      cell: (row) =>
        row.report ? (
          <Link href={`/finance/tax/${row.report.id}`} className="text-primary hover:underline">
            {tKinds(row.kind)}
          </Link>
        ) : (
          tKinds(row.kind)
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) =>
        row.report ? (
          <StatusChip map={TAX_REPORT_STATUS} value={row.report.status} />
        ) : (
          <span className="text-muted text-sm">{t("notBuilt")}</span>
        ),
    },
    {
      id: "lines",
      header: t("columns.lines"),
      numeric: true,
      cell: (row) => (row.report ? format.number(row.report.lineCount) : ""),
    },
    {
      id: "amount",
      header: t("columns.report_amount"),
      numeric: true,
      cell: (row) => (row.report ? format.thb(row.report.reportAmount) : ""),
    },
    {
      id: "gl",
      header: t("columns.gl"),
      numeric: true,
      cell: (row) => (row.report ? format.thb(row.report.glAmount) : ""),
    },
    {
      id: "difference",
      header: t("columns.difference"),
      cell: (row) => (row.report ? <Difference amount={row.report.glDifference} /> : null),
    },
    {
      id: "built",
      header: t("columns.generatedAt"),
      hideable: true,
      cell: (row) => (row.report ? <When at={row.report.generatedAt} /> : null),
    },
    ...(canManage
      ? [
          {
            id: "action",
            header: t("columns.action"),
            cell: (row: (typeof rows)[number]) =>
              !row.report || row.report.status === "draft" ? (
                <Button size="sm" variant="ghost" loading={busy === row.kind} onClick={() => void generate([row.kind])}>
                  {row.report ? t("rebuild") : t("build")}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <Section
      title={t("title", { month: format.date(`${month}-01`, { style: "month" }) })}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("month")} className="w-44">
            <SearchableSelect
              value={month}
              onValueChange={(value) => router.replace(`${pathname}?period=${value}`)}
              options={(months.length ? months : [month]).map((value) => ({
                value,
                label: format.date(`${value}-01`, { style: "month" }),
              }))}
            />
          </Field>
          {canManage && drafts.length ? (
            <Button loading={busy === "all"} onClick={() => void generate(drafts)}>
              {t("buildAll")}
            </Button>
          ) : null}
        </div>
      }
    >
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={rows}
        loading={reports.isPending}
        getRowId={(row) => row.kind}
        rowTone={(row) => (row.report && !isZeroMoney(row.report.glDifference) ? "danger" : undefined)}
      />
    </Section>
  );
}

/* ------------------------------------------------------------------------------ report lines */

type Column = { key: string; kind: "money" | "date" | "text" | "code" | "number" | "flag" | "status" | "doc" };

const VAT_COLUMNS: Column[] = [
  { key: "seq", kind: "number" },
  { key: "documentDate", kind: "date" },
  { key: "documentNo", kind: "doc" },
  { key: "partyName", kind: "text" },
  { key: "partyTaxId", kind: "code" },
  { key: "partyBranch", kind: "code" },
  { key: "base", kind: "money" },
  { key: "vat", kind: "money" },
  { key: "late", kind: "flag" },
];
const COLUMNS: Record<Kind, Column[]> = {
  sales_tax: VAT_COLUMNS,
  purchase_tax: VAT_COLUMNS,
  pp30: [
    { key: "label", kind: "text" },
    { key: "base", kind: "money" },
    { key: "vat", kind: "money" },
    { key: "gl", kind: "money" },
    { key: "documents", kind: "number" },
  ],
  pnd3: [],
  pnd53: [],
  wht_issued_register: [],
  wht_received_register: [
    { key: "seq", kind: "number" },
    { key: "documentNo", kind: "code" },
    { key: "documentDate", kind: "date" },
    { key: "name", kind: "text" },
    { key: "taxId", kind: "code" },
    { key: "base", kind: "money" },
    { key: "whtAmount", kind: "money" },
    { key: "status", kind: "status" },
    { key: "certificateNo", kind: "code" },
  ],
};
const WHT_ISSUED: Column[] = [
  { key: "seq", kind: "number" },
  { key: "wtNumber", kind: "code" },
  { key: "form", kind: "status" },
  { key: "taxId", kind: "code" },
  { key: "branch", kind: "code" },
  { key: "name", kind: "text" },
  { key: "paidOn", kind: "date" },
  { key: "incomeType", kind: "status" },
  { key: "ratePct", kind: "text" },
  { key: "paidAmount", kind: "money" },
  { key: "whtAmount", kind: "money" },
];
COLUMNS.pnd3 = WHT_ISSUED;
COLUMNS.pnd53 = WHT_ISSUED;
COLUMNS.wht_issued_register = WHT_ISSUED;

/** The totals each kind carries, in the order they are read. */
const TOTALS: Record<Kind, string[]> = {
  sales_tax: ["base", "vat"],
  purchase_tax: ["base", "vat"],
  pp30: ["outputBase", "outputVat", "inputBase", "inputVat", "netPayable", "creditCarriedForward"],
  pnd3: ["whtBase", "whtAmount"],
  pnd53: ["whtBase", "whtAmount"],
  wht_issued_register: ["whtBase", "whtAmount"],
  wht_received_register: ["whtBase", "whtAmount", "pendingAmount"],
};

/** One report: its lines, totals and reconciliation, and the steps it goes through. */
export function TaxReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("finance.tax.detail");
  const tKinds = useTranslations("finance.tax.kinds");
  const tCol = useTranslations("finance.tax.columns");
  const tTotals = useTranslations("finance.tax.totals");
  const tValues = useTranslations("finance.tax.values");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("tax.manage");
  const canPay = useCan("tax.pay");
  const [action, setAction] = useState<"finalise" | "file" | "pay" | null>(null);
  const key = queryKeys.detail("admin", "tax-report", reportId);
  const report = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/tax-reports/{reportId}", { params: { path: { reportId } } }))
        .data!,
  });
  if (report.isError) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  if (!data) return null;
  const month = format.date(`${data.period}-01`, { style: "month" });
  const title = t("title", { kind: tKinds(data.kind), month });
  const refresh = (updated?: Report) => {
    if (updated) queryClient.setQueryData(key, updated);
    for (const resource of ["tax-report", "tax-calendar", "journal"])
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
  };
  const totals = data.totals as Record<string, string>;

  async function rebuild() {
    try {
      const { data: updated } = await adminBrowserApis().contract.POST("/v1/admin/tax-reports", {
        params: { header: { "Idempotency-Key": crypto.randomUUID() } },
        body: { kind: data!.kind, period: data!.period },
      });
      refresh(updated);
      toast.success(t("rebuilt"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  }

  async function exportCsv() {
    try {
      const { data: file } = await adminBrowserApis().contract.GET("/v1/admin/tax-reports/{reportId}/export", {
        params: { path: { reportId } },
      });
      const link = document.createElement("a");
      link.href = file!.url;
      link.download = `${data!.kind}-${data!.period}.csv`;
      link.click();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  }

  const lines = data.lines as Line[];
  const columns: DataTableColumn<Line>[] = COLUMNS[data.kind].map((column) => ({
    id: column.key,
    header: tCol(column.key),
    numeric: column.kind === "money" || column.kind === "number",
    cell: (row: Line) => {
      const value = row[column.key];
      if (value === null || value === undefined || value === "") return column.kind === "money" ? "—" : "";
      switch (column.kind) {
        case "money":
          return format.thb(String(value));
        case "date":
          return format.date(String(value));
        case "number":
          return format.number(Number(value));
        case "code":
          return <span className="font-mono text-sm whitespace-nowrap">{String(value)}</span>;
        case "flag":
          return value === true ? (
            <Badge tone="warning" size="sm">
              {t("late")}
            </Badge>
          ) : null;
        case "status":
          return tValues(String(value));
        case "doc": {
          const href = sourceHref(
            row.sourceType && row.sourceId ? { type: String(row.sourceType), id: String(row.sourceId) } : null,
          );
          return (
            <span className="flex flex-col">
              {href ? (
                <Link href={href} className="text-primary font-mono text-sm whitespace-nowrap hover:underline">
                  {String(value)}
                </Link>
              ) : (
                <span className="font-mono text-sm">{String(value)}</span>
              )}
              {row.journalEntryId ? (
                <Link href={journalHref(String(row.journalEntryId))} className="text-muted text-xs hover:underline">
                  {t("journal")}
                </Link>
              ) : null}
            </span>
          );
        }
        default:
          return String(value);
      }
    },
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("reports"), href: `/finance/tax?period=${data.period}` }, { label: tKinds(data.kind) }]}
          />
        }
        title={title}
        meta={<StatusChip map={TAX_REPORT_STATUS} value={data.status} size="md" />}
        description={t(`descriptions.${data.kind}`)}
        actions={
          <>
            {canManage && data.status === "draft" ? (
              <>
                <Button variant="secondary" iconStart="refresh" onClick={() => void rebuild()}>
                  {t("rebuild")}
                </Button>
                <Button disabled={!isZeroMoney(data.glDifference)} onClick={() => setAction("finalise")}>
                  {t("finalise")}
                </Button>
              </>
            ) : null}
            {data.fileReady ? (
              <Button variant="secondary" iconStart="download" onClick={() => void exportCsv()}>
                {data.kind === "pnd3" || data.kind === "pnd53" ? t("exportAttachment") : t("export")}
              </Button>
            ) : null}
            {canManage && data.status === "final" ? (
              <Button onClick={() => setAction("file")}>{t("file")}</Button>
            ) : null}
            {canPay && PAYABLE.includes(data.kind) && data.status !== "draft" && !data.paidOn ? (
              <Button variant="secondary" onClick={() => setAction("pay")}>
                {t("pay")}
              </Button>
            ) : null}
          </>
        }
      />

      {!isZeroMoney(data.glDifference) ? (
        <Callout tone="danger" title={t("differenceTitle")}>
          {t("differenceBody", { difference: format.thb(data.glDifference) })}
        </Callout>
      ) : data.status === "draft" ? (
        <Callout tone="success" title={t("reconciledTitle")}>
          {t("reconciledBody")}
        </Callout>
      ) : null}

      <Section title={t("reconciliation")} description={t("reconciliationNote")}>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Figure label={t("reportAmount")} amount={data.reportAmount} />
          <Figure label={t("glAmount")} amount={data.glAmount} />
          <Figure
            label={t("difference")}
            amount={data.glDifference}
            tone={isZeroMoney(data.glDifference) ? "success" : "danger"}
          />
        </dl>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {TOTALS[data.kind]
            .filter((name) => totals[name] !== undefined)
            .map((name) => (
              <Figure key={name} label={tTotals(name)} amount={totals[name]} />
            ))}
        </dl>
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            { term: t("generatedAt"), description: <When at={data.generatedAt} absoluteOnly /> },
            { term: t("finalisedAt"), description: <When at={data.finalisedAt} absoluteOnly /> },
            {
              term: t("filed"),
              description: data.filingRef
                ? t("filedAs", { ref: data.filingRef, at: format.dateTime(data.filedAt) })
                : "—",
            },
            {
              term: t("paid"),
              description: data.paidOn
                ? t("paidAs", { amount: format.thb(data.paidAmount), date: format.date(data.paidOn) })
                : "—",
            },
          ]}
        />
      </Section>

      <Section title={t("lines", { count: data.lineCount })}>
        <DataTable
          caption={t("lines", { count: data.lineCount })}
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.seq ?? row.key ?? row.wtNumber)}
          density="compact"
          empty={<EmptyState icon="document" title={t("noLines")} />}
          rowTone={(row) => (row.late === true ? "warning" : undefined)}
        />
      </Section>

      {action === "finalise" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("finaliseTitle", { report: title })}
          description={t("finaliseBody", { amount: format.thb(data.reportAmount) })}
          confirmLabel={t("finalise")}
          confirmationPhrase={data.period}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              const { data: updated } = await adminBrowserApis().contract.POST(
                "/v1/admin/tax-reports/{reportId}/actions/finalise",
                { params: { path: { reportId }, header: { "Idempotency-Key": idempotencyKey } } },
              );
              refresh(updated);
              toast.success(t("finalised"));
            } catch (error) {
              refresh();
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
      {action === "file" ? <FileReturn report={data} onClose={() => setAction(null)} onDone={refresh} /> : null}
      {action === "pay" ? (
        <PayReturn report={data} title={title} onClose={() => setAction(null)} onDone={refresh} />
      ) : null}
    </div>
  );
}

function FileReturn({
  report,
  onClose,
  onDone,
}: {
  report: Report;
  onClose: () => void;
  onDone: (r?: Report) => void;
}) {
  const t = useTranslations("finance.tax.detail");
  const tCommon = useTranslations("common");
  const [filingRef, setFilingRef] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <FormDialog
      title={t("fileTitle")}
      description={t("fileBody")}
      submitLabel={t("file")}
      onClose={onClose}
      onSubmit={async () => {
        if (!filingRef.trim()) throw new FormError(t("refRequired"));
        const { data } = await adminBrowserApis().contract.POST("/v1/admin/tax-reports/{reportId}/actions/file", {
          params: { path: { reportId: report.id }, header: { "Idempotency-Key": idempotencyKey } },
          body: { filingRef: filingRef.trim() },
        });
        onDone(data);
        toast.success(t("filedDone"));
      }}
    >
      <Field label={t("filingRef")} required requiredLabel={tCommon("state.required")} hint={t("filingRefHint")}>
        <Input value={filingRef} onChange={(event) => setFilingRef(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

function PayReturn({
  report,
  title,
  onClose,
  onDone,
}: {
  report: Report;
  title: string;
  onClose: () => void;
  onDone: (r?: Report) => void;
}) {
  const t = useTranslations("finance.tax.detail");
  const tFinance = useTranslations("finance.common");
  const format = useFormat();
  const accounts = useQuery({
    queryKey: queryKeys.list("admin", "company-bank-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/company-bank-accounts", {})).data!,
  });
  const usable = (accounts.data ?? []).filter(
    (account) => account.status === "active" && account.purpose !== "collection",
  );
  const [accountId, setAccountId] = useState("");
  const [paidOn, setPaidOn] = useState(bangkokToday);
  const chosen = accountId || usable[0]?.id || "";
  const amount =
    report.kind === "pp30" ? ((report.totals as Record<string, string>).netPayable ?? "0.00") : report.reportAmount;
  return (
    <ConfirmAction
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("payTitle", { report: title })}
      description={t("payBody", { amount: format.thb(amount) })}
      confirmLabel={t("pay")}
      confirmationPhrase={report.period}
      onConfirm={async ({ idempotencyKey }) => {
        try {
          const { data } = await adminBrowserApis().contract.POST("/v1/admin/tax-reports/{reportId}/actions/pay", {
            params: { path: { reportId: report.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { paidOn, companyBankAccountId: chosen },
          });
          onDone(data);
          toast.success(t("paidDone"));
        } catch (error) {
          toast.error(problemMessage(error, t("failed")));
          throw error;
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("paidOn")}>
          <Input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value || bangkokToday())} />
        </Field>
        <Field label={t("fromAccount")}>
          <SearchableSelect
            value={chosen || undefined}
            onValueChange={setAccountId}
            options={usable.map((item) => ({
              value: item.id,
              label: tFinance("accountOption", {
                bank: item.bankCode,
                last4: item.accountNoLast4,
                gl: item.glAccountCode,
              }),
            }))}
          />
        </Field>
      </div>
    </ConfirmAction>
  );
}

/* ---------------------------------------------------------------------------------- calendar */

/** ภ.พ.30 and ภ.ง.ด.3 / 53 due dates by month (setting `tax.calendar`), done when filed. */
export function TaxCalendar() {
  const t = useTranslations("finance.tax.calendar");
  const tKinds = useTranslations("finance.tax.kinds");
  const format = useFormat();
  const items = useQuery({
    queryKey: queryKeys.list("admin", "tax-calendar"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/tax-calendar", {})).data!,
  });
  if (items.isError) return <QueryError error={items.error} onRetry={() => void items.refetch()} />;
  const today = bangkokToday();
  return (
    <Section title={t("title")} description={t("description")}>
      <DataTable
        caption={t("title")}
        rows={items.data ?? []}
        loading={items.isPending}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="calendar" title={t("empty")} />}
        rowTone={(row) => (row.status === "open" && row.dueOn < today ? "danger" : undefined)}
        columns={[
          { id: "kind", header: t("return"), cell: (row) => tKinds(row.kind) },
          { id: "period", header: t("period"), cell: (row) => format.date(`${row.period}-01`, { style: "month" }) },
          {
            id: "due",
            header: t("dueOn"),
            cell: (row) => (
              <span className="flex items-center gap-2">
                {format.date(row.dueOn)}
                {row.status === "open" && row.dueOn < today ? (
                  <Badge tone="danger" size="sm">
                    {t("overdue")}
                  </Badge>
                ) : null}
              </span>
            ),
          },
          {
            id: "status",
            header: t("status"),
            cell: (row) => <StatusChip map={TAX_CALENDAR_STATUS} value={row.status} />,
          },
          {
            id: "report",
            header: t("report"),
            cell: (row) =>
              row.taxReportId ? (
                <Link href={`/finance/tax/${row.taxReportId}`} className="text-primary hover:underline">
                  {t("openReport")}
                </Link>
              ) : (
                <Link href={`/finance/tax?period=${row.period}`} className="text-primary hover:underline">
                  {t("prepare")}
                </Link>
              ),
          },
        ]}
      />
    </Section>
  );
}

/* ---------------------------------------------------------------------------------- settings */

const TAX_SETTING_KEYS = [
  "tax.nature_by_product_type",
  "tax.rounding_mode",
  "tax.calendar",
  "tax.gl_accounts",
] as const;

/**
 * Tax settings (§2, D-033): the VAT and withholding rates as dated versions a Finance Manager
 * other than the proposer approves, the settings the reports read (nature of sale per product
 * type, rounding, calendar, GL accounts), and e-Tax sending — off until R2 (D-091).
 */
export function TaxSettings() {
  const t = useTranslations("finance.tax.settings");
  const format = useFormat();
  const canPropose = useCan("ledger.config.propose");
  const [proposing, setProposing] = useState<Schemas["TaxRateDto"] | null>(null);
  const rates = useQuery({
    queryKey: queryKeys.list("admin", "tax-rate"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/tax/rates")).data!,
  });
  const settings = useQuery({
    queryKey: queryKeys.list("admin", "setting"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
  });
  const taxSettings = (settings.data ?? []).filter((setting) =>
    (TAX_SETTING_KEYS as readonly string[]).includes(setting.key),
  );
  const nature = taxSettings.find((setting) => setting.key === "tax.nature_by_product_type")?.current?.value as
    { default: string; overrides: Record<string, string> } | undefined;
  return (
    <div className="flex flex-col gap-5">
      <Section title={t("rates")} description={t("ratesNote")}>
        {rates.isError ? <QueryError error={rates.error} onRetry={() => void rates.refetch()} /> : null}
        <DataTable
          caption={t("rates")}
          rows={rates.data ?? []}
          loading={rates.isPending}
          getRowId={(row) => row.code}
          density="compact"
          columns={[
            {
              id: "name",
              header: t("rate"),
              cell: (row) => (
                <div>
                  {row.nameTh}
                  <p className="text-muted font-mono text-xs">{row.code}</p>
                </div>
              ),
            },
            {
              id: "current",
              header: t("current"),
              numeric: true,
              cell: (row) =>
                format.percent(row.versions.filter((v) => v.status === "approved").at(-1)?.ratePct ?? null),
            },
            {
              id: "since",
              header: t("since"),
              cell: (row) => (
                <When
                  at={row.versions.filter((v) => v.status === "approved").at(-1)?.effectiveFrom ?? null}
                  absoluteOnly
                />
              ),
            },
            {
              id: "pending",
              header: t("pending"),
              cell: (row) => {
                const pending = row.versions.find((version) => version.status === "proposed");
                return pending ? (
                  <span className="flex items-center gap-2">
                    <StatusChip map={SETTING_VERSION_STATUS} value="proposed" />
                    <span className="text-sm">
                      {t("pendingRate", {
                        rate: format.percent(pending.ratePct),
                        date: format.date(pending.effectiveFrom),
                      })}
                    </span>
                  </span>
                ) : null;
              },
            },
            {
              id: "description",
              header: t("about"),
              hideable: true,
              cell: (row) => <span className="text-muted text-sm">{row.description}</span>,
            },
            ...(canPropose
              ? [
                  {
                    id: "action",
                    header: t("change"),
                    cell: (row: Schemas["TaxRateDto"]) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={row.versions.some((version) => version.status === "proposed")}
                        onClick={() => setProposing(row)}
                      >
                        {t("propose")}
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <Section title={t("nature")} description={t("natureNote")}>
        {nature ? (
          <DescriptionList
            columns={2}
            items={[
              { term: t("natureDefault"), description: t(`natures.${nature.default}`) },
              ...Object.entries(nature.overrides).map(([productType, value]) => ({
                term: <span className="font-mono">{productType}</span>,
                description: t(`natures.${value}`),
              })),
            ]}
          />
        ) : (
          <p className="text-muted text-sm">{t("notReadable")}</p>
        )}
      </Section>

      <Section title={t("settings")} description={t("settingsNote")}>
        <DataTable
          caption={t("settings")}
          rows={taxSettings}
          loading={settings.isPending}
          getRowId={(row) => row.id}
          density="compact"
          empty={<EmptyState icon="settings" title={t("notReadable")} />}
          columns={[
            {
              id: "key",
              header: t("setting"),
              cell: (row) => (
                <div>
                  <Link href={`/settings/${row.id}`} className="text-primary font-mono text-sm hover:underline">
                    {row.key}
                  </Link>
                  <p className="text-muted text-xs">{row.description}</p>
                </div>
              ),
            },
            {
              id: "value",
              header: t("value"),
              cell: (row) => <JsonView value={row.current?.value ?? null} label={row.key} />,
            },
            { id: "owner", header: t("owner"), hideable: true, cell: (row) => row.ownerRole },
          ]}
        />
      </Section>

      <Section title={t("eTax")} description={t("eTaxNote")}>
        <Callout tone="info" title={t("eTaxR2")}>
          {t("eTaxBody")}
        </Callout>
        <div className="mt-3 flex flex-col gap-3">
          <Switch label={t("eTaxSend")} description={t("eTaxSendHint")} checked={false} disabled />
          <Checkbox label={t("eTaxReceipts")} checked={false} disabled />
        </div>
      </Section>

      {proposing ? <ProposeRate rate={proposing} onClose={() => setProposing(null)} /> : null}
    </div>
  );
}

function ProposeRate({ rate, onClose }: { rate: Schemas["TaxRateDto"]; onClose: () => void }) {
  const t = useTranslations("finance.tax.settings");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [ratePct, setRatePct] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(bangkokToday);
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("proposeTitle", { name: rate.nameTh })}
      description={t("proposeNote")}
      submitLabel={t("sendForApproval")}
      onClose={onClose}
      onSubmit={async () => {
        if (reason.trim().length < 3) throw new FormError(t("reasonShort"));
        await adminBrowserApis().contract.POST("/v1/admin/tax/rates/{code}/versions", {
          params: { path: { code: rate.code } },
          body: { ratePct: ratePct.trim(), effectiveFrom: effectiveInstant(effectiveFrom), reason: reason.trim() },
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "tax-rate") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
        toast.success(t("proposed"));
      }}
    >
      <Field label={t("newRate")} required requiredLabel={tCommon("state.required")} hint={t("newRateHint")}>
        <Input inputMode="decimal" value={ratePct} onChange={(event) => setRatePct(event.target.value)} />
      </Field>
      <Field label={t("effectiveFrom")} required requiredLabel={tCommon("state.required")} hint={t("effectiveHint")}>
        <Input
          type="date"
          min={bangkokToday()}
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </Field>
      <Field label={t("reason")} required requiredLabel={tCommon("state.required")}>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

/* ---------------------------------------------------------------------------- document series */

const DOC_TYPES = [
  "iv",
  "tr",
  "rc",
  "cn",
  "dn",
  "po",
  "gr",
  "bs",
  "pv",
  "wt",
  "jv",
] as const satisfies readonly Schemas["DocumentType"][];

/** Document numbering (§4, D-092): one series per document type; statutory documents are gapless. */
export function DocumentSeries() {
  const t = useTranslations("finance.tax.series");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const canManage = useCan("document_series.manage");
  const series = useQuery({
    queryKey: queryKeys.list("admin", "document-series"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/document-series")).data!,
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    docType: "" as Schemas["DocumentType"] | "",
    prefix: "",
    format: "{prefix}{yyyy}{mm}-{seq:5}",
    resetPeriod: "monthly" as Schemas["SequenceReset"],
    isGapless: true,
    description: "",
  });
  if (series.isError) return <QueryError error={series.error} onRetry={() => void series.refetch()} />;
  const missing = DOC_TYPES.filter((type) => !(series.data ?? []).some((item) => item.docType === type));
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        canManage && missing.length ? (
          <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        rows={series.data ?? []}
        loading={series.isPending}
        getRowId={(row) => row.id}
        density="compact"
        columns={[
          { id: "type", header: t("type"), cell: (row) => t(`types.${row.docType}`) },
          { id: "prefix", header: t("prefix"), cell: (row) => <span className="font-mono">{row.prefix}</span> },
          { id: "format", header: t("format"), cell: (row) => <code className="text-xs">{row.format}</code> },
          { id: "reset", header: t("reset"), cell: (row) => t(`resets.${row.resetPeriod}`) },
          {
            id: "gapless",
            header: t("gapless"),
            cell: (row) =>
              row.isGapless ? (
                <Badge tone="info" size="sm">
                  {t("gaplessYes")}
                </Badge>
              ) : (
                t("gaplessNo")
              ),
          },
          { id: "description", header: t("about"), hideable: true, cell: (row) => row.description },
        ]}
      />
      {missing.length ? (
        <Callout tone="warning" title={t("missingTitle")} className="mt-3">
          {t("missingBody", { types: missing.map((type) => t(`types.${type}`)).join(", ") })}
        </Callout>
      ) : null}
      {creating ? (
        <FormDialog
          title={t("new")}
          description={t("newNote")}
          submitLabel={t("create")}
          onClose={() => setCreating(false)}
          onSubmit={async () => {
            if (!form.docType) throw new FormError(t("pickType"));
            await adminBrowserApis().contract.POST("/v1/admin/document-series", {
              body: {
                docType: form.docType,
                prefix: form.prefix.trim().toUpperCase(),
                format: form.format.trim(),
                resetPeriod: form.resetPeriod,
                isGapless: form.isGapless,
                description: form.description.trim(),
              },
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "document-series") });
            toast.success(t("created"));
          }}
        >
          <Field label={t("type")} required requiredLabel={tCommon("state.required")}>
            <SearchableSelect
              value={form.docType || undefined}
              onValueChange={(docType) => setForm({ ...form, docType: docType as Schemas["DocumentType"] })}
              placeholder={t("pickType")}
              options={missing.map((type) => ({ value: type, label: t(`types.${type}`) }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("prefix")} required requiredLabel={tCommon("state.required")}>
              <Input value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} />
            </Field>
            <Field label={t("reset")}>
              <SearchableSelect<Schemas["SequenceReset"]>
                value={form.resetPeriod}
                onValueChange={(resetPeriod) => setForm({ ...form, resetPeriod })}
                options={(["never", "yearly", "monthly"] as const).map((value) => ({
                  value,
                  label: t(`resets.${value}`),
                }))}
              />
            </Field>
          </div>
          <Field label={t("format")} hint={t("formatHint")}>
            <Input
              value={form.format}
              onChange={(event) => setForm({ ...form, format: event.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label={t("about")} required requiredLabel={tCommon("state.required")}>
            <Input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Checkbox
            label={t("gaplessLabel")}
            description={t("gaplessHint")}
            checked={form.isGapless}
            onCheckedChange={(checked) => setForm({ ...form, isGapless: checked === true })}
          />
        </FormDialog>
      ) : null}
    </Section>
  );
}
