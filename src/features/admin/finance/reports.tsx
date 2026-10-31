"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isZeroMoney } from "@/domain/money";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { DeskSection } from "@/ui/components/DeskPage";
import { Pagination } from "@/ui/components/Pagination";
import { Skeleton } from "@/ui/components/Skeleton";
import { StatStrip } from "@/ui/components/RowList";
import { Statement, type StatementRow } from "@/ui/components/Statement";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis } from "../console/api";
import { QueryError } from "../console/QueryError";
import { SectionNav } from "../console/SectionNav";
import { downloadCsv, toCsv } from "./csv";
import { AccountPicker, useAccounts } from "./ledger";
import { PeriodBar } from "./frame";
import { journalHref, sourceHref, useSourceLabel } from "./shared";

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const thisMonth = () => bangkokToday().slice(0, 7);
const yearStart = () => `${thisMonth().slice(0, 4)}-01`;

export function ReportsNav() {
  const t = useTranslations("finance.reports.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/reports", label: t("trialBalance"), exact: true },
        { href: "/finance/reports/gl-detail", label: t("glDetail") },
        { href: "/finance/reports/balance-sheet", label: t("balanceSheet") },
        { href: "/finance/reports/profit-and-loss", label: t("profitAndLoss") },
        { href: "/finance/reports/cash-flow", label: t("cashFlow") },
        { href: "/finance/reports/roll-forwards", label: t("rollForwards") },
        { href: "/finance/reports/reconciliation", label: t("reconciliation") },
      ]}
    />
  );
}

/** A report's own parameters live in the URL, so a figure can be linked to and reopened. */
function useParams(defaults: Record<string, string>) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value]));
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return [values, set] as const;
}

/** "ม.ค. 2569 – ต.ค. 2569": the months a statement covers. */
function useMonthsLabel() {
  const format = useFormat();
  return (from: string, to: string) => {
    const a = format.date(`${from}-01`, { style: "month" });
    const b = format.date(`${to}-01`, { style: "month" });
    return from === to ? a : `${a} – ${b}`;
  };
}

/** The report's toolbar over its body, the body without a second title (the page header names the report). */
function ReportBody({
  bar,
  narrow = false,
  children,
}: {
  bar: React.ReactNode;
  /** A statement reads down one column: its figures stay near their labels instead of across a wide screen. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {bar}
      <div className={cn("flex flex-col gap-4", narrow && "max-w-4xl")}>{children}</div>
    </div>
  );
}

function Check({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return ok ? (
    <Badge tone="success" icon="check">
      {okLabel}
    </Badge>
  ) : (
    <Badge tone="danger" icon="warning">
      {badLabel}
    </Badge>
  );
}

/* ------------------------------------------------------------------------------ trial balance */

type TbRow = Schemas["TrialBalanceRowDto"];

export const trialBalanceCsv = (tb: Schemas["TrialBalanceDto"]) =>
  toCsv<TbRow>(
    [
      { header: "accountCode", value: (row) => row.accountCode },
      { header: "nameTh", value: (row) => row.nameTh },
      { header: "nameEn", value: (row) => row.nameEn },
      { header: "accountType", value: (row) => row.accountType },
      { header: "opening", value: (row) => row.opening },
      { header: "debit", value: (row) => row.debit },
      { header: "credit", value: (row) => row.credit },
      { header: "closing", value: (row) => row.closing },
    ],
    [
      ...tb.accounts,
      { accountCode: "TOTAL", nameTh: "", nameEn: "", accountType: "asset", normalSide: "debit", ...tb.totals },
    ],
  );

/** The trial balance (§6): opening, debits, credits and closing per account; it must balance. */
export function TrialBalanceView() {
  const t = useTranslations("finance.reports.trialBalance");
  const tReports = useTranslations("finance.reports");
  const format = useFormat();
  const months = useMonthsLabel();
  const [params, set] = useParams({ from: yearStart(), to: thisMonth(), zero: "false" });
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "trial-balance", `${params.from}:${params.to}:${params.zero}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/trial-balance", {
          params: { query: { from: params.from!, to: params.to!, includeZero: params.zero === "true" } },
        })
      ).data!,
  });
  const data = report.data;
  const glHref = (code: string) => `/finance/reports/gl-detail?account=${code}&from=${params.from}&to=${params.to}`;
  const columns: DataTableColumn<TbRow>[] = [
    {
      id: "account",
      header: t("account"),
      cell: (row) => (
        <Link href={glHref(row.accountCode)} className="text-primary hover:underline">
          <span className="tabular-nums">{row.accountCode}</span> {row.nameTh}
        </Link>
      ),
    },
    { id: "opening", header: t("opening"), numeric: true, cell: (row) => format.thb(row.opening) },
    { id: "debit", header: t("debit"), numeric: true, cell: (row) => format.thb(row.debit) },
    { id: "credit", header: t("credit"), numeric: true, cell: (row) => format.thb(row.credit) },
    {
      id: "closing",
      header: t("closing"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{format.thb(row.closing)}</span>,
    },
  ];
  return (
    <ReportBody
      bar={
        <PeriodBar
          range={{ from: params.from!, to: params.to!, fromLabel: tReports("from"), toLabel: tReports("to") }}
          onChange={set}
          controls={
            <Switch
              label={t("includeZero")}
              checked={params.zero === "true"}
              onCheckedChange={(checked) => set({ zero: String(checked) })}
            />
          }
          tools={
            <Button
              variant="secondary"
              iconStart="download"
              disabled={!data}
              onClick={() =>
                data && downloadCsv(`trial-balance-${params.from}-${params.to}.csv`, trialBalanceCsv(data))
              }
            >
              {tReports("export")}
            </Button>
          }
        />
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted text-sm tabular-nums">{months(params.from!, params.to!)}</p>
          <Check ok={data.balanced} okLabel={t("balanced")} badLabel={t("unbalanced")} />
        </div>
      ) : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={data?.accounts ?? []}
        loading={report.isPending}
        getRowId={(row) => row.accountCode}
        density="compact"
      />
      {data ? (
        <StatStrip
          label={t("title")}
          items={[
            { key: "opening", label: t("totalOpening"), value: format.thb(data.totals.opening) },
            { key: "debit", label: t("totalDebit"), value: format.thb(data.totals.debit) },
            { key: "credit", label: t("totalCredit"), value: format.thb(data.totals.credit) },
            {
              key: "closing",
              label: t("totalClosing"),
              value: format.thb(data.totals.closing),
              tone: isZeroMoney(data.totals.closing) ? "success" : "danger",
            },
          ]}
        />
      ) : null}
    </ReportBody>
  );
}

/* --------------------------------------------------------------------------------- GL detail */

/** One account's lines with the running balance, each drilling down to its journal and source. */
export function GlDetailView() {
  const t = useTranslations("finance.reports.glDetail");
  const tReports = useTranslations("finance.reports");
  const sourceLabel = useSourceLabel();
  const format = useFormat();
  const accounts = useAccounts();
  const [params, set] = useParams({ account: "1121", from: yearStart(), to: thisMonth(), page: "1" });
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "gl-detail", `${params.account}:${params.from}:${params.to}:${params.page}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/gl-detail", {
          params: {
            query: {
              accountCode: params.account!,
              from: params.from!,
              to: params.to!,
              page: Number(params.page),
              perPage: 50,
            },
          },
        })
      ).data!,
  });
  const data = report.data;
  type Line = Schemas["GlLineDto"];
  const columns: DataTableColumn<Line>[] = [
    { id: "date", header: t("date"), cell: (row) => format.date(row.entryDate) },
    {
      id: "entry",
      header: t("entry"),
      cell: (row) => (
        <Link
          href={journalHref(row.journalEntryId)}
          className="text-primary text-sm whitespace-nowrap tabular-nums hover:underline"
        >
          {row.entryNo ?? row.jvNumber}
        </Link>
      ),
    },
    {
      id: "source",
      header: t("source"),
      cell: (row) => {
        const href = sourceHref(row.sourceType && row.sourceId ? { type: row.sourceType, id: row.sourceId } : null);
        const label = sourceLabel({ type: row.sourceType, number: row.sourceNo });
        return href ? (
          <Link href={href} className="text-primary text-sm hover:underline">
            {label}
          </Link>
        ) : (
          <span className="text-sm">{label}</span>
        );
      },
    },
    {
      id: "description",
      header: t("description"),
      cell: (row) => (
        <div>
          <span className="line-clamp-2">{row.description}</span>
          <span className="text-muted text-xs">
            {[row.ruleKey, row.vendorName, row.customerName, row.postedBy?.name].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      id: "debit",
      header: t("debit"),
      numeric: true,
      cell: (row) => (row.debit === "0.00" ? "" : format.thb(row.debit)),
    },
    {
      id: "credit",
      header: t("credit"),
      numeric: true,
      cell: (row) => (row.credit === "0.00" ? "" : format.thb(row.credit)),
    },
    { id: "balance", header: t("balance"), numeric: true, cell: (row) => format.thb(row.balance) },
  ];
  return (
    <ReportBody
      bar={
        <PeriodBar
          range={{ from: params.from!, to: params.to!, fromLabel: tReports("from"), toLabel: tReports("to") }}
          onChange={(patch) => set({ ...patch, page: "1" })}
          controls={
            <div className="w-full sm:w-72">
              <AccountPicker
                label={t("account")}
                value={params.account!}
                onChange={(account) => account && set({ account, page: "1" })}
                accounts={accounts.data ?? []}
                allowControl
              />
            </div>
          }
          tools={
            <Button
              variant="secondary"
              iconStart="download"
              disabled={!data}
              onClick={() =>
                data &&
                downloadCsv(
                  `gl-${data.accountCode}-${params.from}-${params.to}-p${params.page}.csv`,
                  toCsv<Line>(
                    [
                      { header: "entryDate", value: (row) => row.entryDate },
                      { header: "documentDate", value: (row) => row.documentDate },
                      { header: "entryNo", value: (row) => row.entryNo },
                      { header: "jvNumber", value: (row) => row.jvNumber },
                      { header: "rule", value: (row) => row.ruleKey },
                      { header: "sourceType", value: (row) => row.sourceType },
                      { header: "sourceNo", value: (row) => row.sourceNo },
                      { header: "description", value: (row) => row.description },
                      { header: "debit", value: (row) => row.debit },
                      { header: "credit", value: (row) => row.credit },
                      { header: "balance", value: (row) => row.balance },
                      { header: "journalEntryId", value: (row) => row.journalEntryId },
                      { header: "domainEventId", value: (row) => row.domainEventId },
                    ],
                    data.lines,
                  ),
                )
              }
            >
              {tReports("export")}
            </Button>
          }
        />
      }
    >
      {data ? (
        <h2 className="text-lg font-semibold">{t("titleOf", { code: data.accountCode, name: data.nameTh })}</h2>
      ) : null}
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <StatStrip
          label={t("title")}
          items={[
            { key: "opening", label: t("opening"), value: format.thb(data.opening) },
            { key: "debit", label: t("debit"), value: format.thb(data.debit) },
            { key: "credit", label: t("credit"), value: format.thb(data.credit) },
            { key: "closing", label: t("closing"), value: format.thb(data.closing) },
          ]}
        />
      ) : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={data?.lines ?? []}
        loading={report.isPending}
        getRowId={(row) => `${row.journalEntryId}-${row.debit}-${row.credit}-${row.balance}`}
        density="compact"
        empty={<EmptyState icon="document" title={t("empty")} />}
      />
      {data && data.total > 50 ? (
        <Pagination
          className="mt-3"
          page={Number(params.page)}
          perPage={50}
          total={data.total}
          onPageChange={(page) => set({ page: String(page) })}
          labels={{
            nav: t("pagination"),
            previous: t("previous"),
            next: t("next"),
            range: (from, to, total) => t("range", { from, to, total }),
            pageOf: (page, pages) => t("pageOf", { page, pages }),
            perPage: t("perPage"),
          }}
        />
      ) : null}
    </ReportBody>
  );
}

/* ------------------------------------------------------------------------------ balance sheet */

type BalanceLine = Schemas["BalanceLineDto"];

/** The balance sheet at a date: assets = liabilities + equity (the profit of the year included). */
export function BalanceSheetView() {
  const t = useTranslations("finance.reports.balanceSheet");
  const format = useFormat();
  const today = bangkokToday();
  const [params, set] = useParams({ asOf: today });
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "balance-sheet", params.asOf!),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/balance-sheet", {
          params: { query: { asOf: params.asOf! } },
        })
      ).data!,
  });
  const data = report.data;
  const lines = (section: string, rows: BalanceLine[]): StatementRow[] =>
    rows.map((row) => ({
      key: `${section}-${row.accountCode}`,
      label: `${row.accountCode} ${row.nameTh}`,
      amount: format.thb(row.balance),
      href: `/finance/reports/gl-detail?account=${row.accountCode}`,
    }));
  return (
    <ReportBody bar={<PeriodBar day={{ value: params.asOf!, label: t("asOf"), max: today }} onChange={set} />}>
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <Statement
          caption={t("title", { date: format.date(data.asOf) })}
          title={t("title", { date: format.date(data.asOf) })}
          period={t("description")}
          status={
            <Check
              ok={isZeroMoney(data.difference)}
              okLabel={t("balanced")}
              badLabel={t("differs", { amount: format.thb(data.difference) })}
            />
          }
          headers={{ label: t("account"), amount: t("balance") }}
          rows={[
            { key: "assets", label: t("assets"), kind: "heading" },
            ...lines("a", data.assets),
            { key: "total-assets", label: t("totalAssets"), amount: format.thb(data.totals.assets), kind: "total" },
            { key: "liabilities", label: t("liabilities"), kind: "heading" },
            ...lines("l", data.liabilities),
            {
              key: "total-liabilities",
              label: t("totalLiabilities"),
              amount: format.thb(data.totals.liabilities),
              kind: "subtotal",
            },
            { key: "equity", label: t("equity"), kind: "heading" },
            ...lines("e", data.equity),
            { key: "prior", label: t("priorYears"), amount: format.thb(data.priorYearsProfit) },
            { key: "current", label: t("currentYear"), amount: format.thb(data.currentYearProfit) },
            { key: "total-equity", label: t("totalEquity"), amount: format.thb(data.totals.equity), kind: "subtotal" },
          ]}
        />
      ) : report.isPending ? (
        <Skeleton className="h-96" />
      ) : null}
    </ReportBody>
  );
}

/* ---------------------------------------------------------------------------- profit and loss */

const DIMENSIONS = [
  "none",
  "factory",
  "product_type",
  "channel",
  "campaign",
  "cost_centre",
] as const satisfies readonly Schemas["ProfitAndLossDimension"][];

/**
 * Profit and loss (§3): the statement of the period from the API's totals — revenue, cost of sales, gross margin,
 * expenses, net profit — and, pivoted by a dimension, the same figures per factory, product type, channel, campaign
 * or cost centre underneath.
 */
export function ProfitAndLossView() {
  const t = useTranslations("finance.reports.profitAndLoss");
  const tReports = useTranslations("finance.reports");
  const format = useFormat();
  const months = useMonthsLabel();
  const [params, set] = useParams({ from: yearStart(), to: thisMonth(), by: "none" });
  const dimension = params.by as Schemas["ProfitAndLossDimension"];
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "profit-and-loss", `${params.from}:${params.to}:${dimension}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/profit-and-loss", {
          params: { query: { from: params.from!, to: params.to!, dimension } },
        })
      ).data!,
  });
  const data = report.data;
  type Line = Schemas["PlLineDto"];
  const columns: DataTableColumn<Line>[] = [
    {
      id: "dimension",
      header: t(`dimensions.${dimension}`),
      cell: (row) => (row.dimension === "(none)" ? t("none") : row.dimension),
    },
    { id: "revenue", header: t("revenue"), numeric: true, cell: (row) => format.thb(row.revenue) },
    { id: "cost", header: t("costOfSales"), numeric: true, cell: (row) => format.thb(row.costOfSales) },
    { id: "gross", header: t("grossMargin"), numeric: true, cell: (row) => format.thb(row.grossMargin) },
    {
      id: "pct",
      header: t("grossMarginPct"),
      numeric: true,
      cell: (row) => (row.grossMarginPct === null ? "—" : format.percent(row.grossMarginPct)),
    },
    { id: "expenses", header: t("expenses"), numeric: true, cell: (row) => format.thb(row.expenses) },
    {
      id: "net",
      header: t("netProfit"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{format.thb(row.netProfit)}</span>,
    },
  ];
  // The whole company is one line: its margin % is the API's (the totals carry none).
  const whole = dimension === "none" && data?.lines.length === 1 ? data.lines[0] : undefined;
  return (
    <ReportBody
      narrow
      bar={
        <PeriodBar
          range={{ from: params.from!, to: params.to!, fromLabel: tReports("from"), toLabel: tReports("to") }}
          onChange={set}
          controls={
            <label className="flex min-w-0 items-center gap-2">
              <span className="text-muted shrink-0 text-sm">{t("by")}</span>
              <div className="w-44">
                <SearchableSelect
                  value={dimension}
                  onValueChange={(by) => set({ by })}
                  options={DIMENSIONS.map((value) => ({ value, label: t(`dimensions.${value}`) }))}
                />
              </div>
            </label>
          }
          tools={
            <Button
              variant="secondary"
              iconStart="download"
              disabled={!data}
              onClick={() =>
                data &&
                downloadCsv(
                  `profit-and-loss-${dimension}-${params.from}-${params.to}.csv`,
                  toCsv<Line>(
                    [
                      { header: dimension, value: (row) => row.dimension },
                      { header: "revenue", value: (row) => row.revenue },
                      { header: "costOfSales", value: (row) => row.costOfSales },
                      { header: "grossMargin", value: (row) => row.grossMargin },
                      { header: "grossMarginPct", value: (row) => row.grossMarginPct },
                      { header: "expenses", value: (row) => row.expenses },
                      { header: "netProfit", value: (row) => row.netProfit },
                    ],
                    data.lines,
                  ),
                )
              }
            >
              {tReports("export")}
            </Button>
          }
        />
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <Statement
          caption={t("title")}
          title={t("title")}
          period={months(params.from!, params.to!)}
          headers={{ label: t(`dimensions.${dimension}`), amount: tReports("amount") }}
          rows={[
            { key: "revenue", label: t("revenue"), amount: format.thb(data.totals.revenue), level: 0 },
            { key: "cost", label: t("costOfSales"), amount: format.thb(data.totals.costOfSales), level: 0 },
            { key: "gross", label: t("grossMargin"), amount: format.thb(data.totals.grossMargin), kind: "subtotal" },
            ...(whole?.grossMarginPct != null
              ? [
                  {
                    key: "pct",
                    label: t("grossMarginPct"),
                    amount: format.percent(whole.grossMarginPct),
                    level: 2 as const,
                  },
                ]
              : []),
            { key: "expenses", label: t("expenses"), amount: format.thb(data.totals.expenses), level: 0 },
            { key: "net", label: t("netProfit"), amount: format.thb(data.totals.netProfit), kind: "total" },
          ]}
        />
      ) : report.isPending ? (
        <Skeleton className="h-72" />
      ) : null}
      {dimension !== "none" ? (
        <DeskSection title={t(`dimensions.${dimension}`)}>
          <DataTable
            caption={t(`dimensions.${dimension}`)}
            columns={columns}
            rows={data?.lines ?? []}
            loading={report.isPending}
            getRowId={(row) => row.dimension}
            density="compact"
            empty={<EmptyState icon="chart" title={t("empty")} />}
          />
        </DeskSection>
      ) : null}
    </ReportBody>
  );
}

/* ---------------------------------------------------------------------------------- cash flow */

/** The indirect cash-flow statement: net profit, then each account's movement by its cash-flow class. */
export function CashFlowView() {
  const t = useTranslations("finance.reports.cashFlow");
  const tReports = useTranslations("finance.reports");
  const format = useFormat();
  const months = useMonthsLabel();
  const [params, set] = useParams({ from: yearStart(), to: thisMonth() });
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "cash-flow", `${params.from}:${params.to}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/cash-flow", {
          params: { query: { from: params.from!, to: params.to! } },
        })
      ).data!,
  });
  const data = report.data;
  const section = (key: string, title: string, rows: Schemas["CashLineDto"][], total: string): StatementRow[] => [
    { key, label: title, kind: "heading" },
    ...(rows.length
      ? rows.map((row) => ({
          key: `${key}-${row.accountCode}`,
          label: `${row.accountCode} ${row.nameTh}`,
          amount: format.thb(row.amount),
          href: `/finance/reports/gl-detail?account=${row.accountCode}&from=${params.from}&to=${params.to}`,
        }))
      : [{ key: `${key}-none`, label: t("nothing"), level: 2 as const }]),
    { key: `${key}-total`, label: t("totalOf", { section: title }), amount: format.thb(total), kind: "subtotal" },
  ];
  return (
    <ReportBody
      narrow
      bar={
        <PeriodBar
          range={{ from: params.from!, to: params.to!, fromLabel: tReports("from"), toLabel: tReports("to") }}
          onChange={set}
        />
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <>
          <Statement
            caption={t("title")}
            title={t("title")}
            period={months(params.from!, params.to!)}
            status={
              <Check
                ok={isZeroMoney(data.difference)}
                okLabel={t("agrees")}
                badLabel={t("differs", { amount: format.thb(data.difference) })}
              />
            }
            headers={{ label: t("account"), amount: t("amount") }}
            rows={[
              { key: "profit", label: t("netProfit"), amount: format.thb(data.netProfit), level: 0 },
              ...section("operating", t("operating"), data.operating.adjustments, data.operating.total),
              ...section("investing", t("investing"), data.investing.lines, data.investing.total),
              ...section("financing", t("financing"), data.financing.lines, data.financing.total),
              { key: "net", label: t("netChange"), amount: format.thb(data.netChange), kind: "total" },
            ]}
          />
          <dl className="text-muted flex flex-wrap justify-end gap-x-3 px-1 text-sm">
            <dt>{t("cashMovement")}</dt>
            <dd className="text-fg font-semibold tabular-nums">{format.thb(data.cashMovement)}</dd>
          </dl>
        </>
      ) : report.isPending ? (
        <Skeleton className="h-96" />
      ) : null}
    </ReportBody>
  );
}

/* ----------------------------------------------------------------------------- roll-forwards */

/**
 * Points liability (2330) and factory retention (2130), month by month
 * (`admin.financialReports.accountRollForward`): the API's figures in the account's normal
 * direction, split by posting rule.
 */
export function RollForwardsView() {
  const t = useTranslations("finance.reports.rollForwards");
  const tReports = useTranslations("finance.reports");
  const format = useFormat();
  const [params, set] = useParams({ from: yearStart(), to: thisMonth() });
  const options = (accountCode: "2330" | "2130") => ({
    queryKey: queryKeys.detail("admin", "account-roll-forward", `${accountCode}:${params.from}:${params.to}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/roll-forward", {
          params: { query: { accountCode, from: params.from!, to: params.to! } },
        })
      ).data!,
  });
  const points = useQuery(options("2330"));
  const retention = useQuery(options("2130"));
  const table = (title: string, note: string, query: typeof points) => {
    const data = query.data;
    return (
      <DeskSection
        title={title}
        description={data ? `${note} ${t("normalSide", { side: t(`sides.${data.normalSide}`) })}` : note}
      >
        {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
        <DataTable
          caption={title}
          rows={data?.months ?? []}
          loading={query.isPending}
          getRowId={(row) => row.month}
          density="compact"
          columns={[
            { id: "month", header: t("month"), cell: (row) => format.date(`${row.month}-01`, { style: "month" }) },
            { id: "opening", header: t("opening"), numeric: true, cell: (row) => format.thb(row.opening) },
            { id: "increases", header: t("increases"), numeric: true, cell: (row) => format.thb(row.increases) },
            { id: "decreases", header: t("decreases"), numeric: true, cell: (row) => format.thb(row.decreases) },
            {
              id: "closing",
              header: t("closing"),
              numeric: true,
              cell: (row) => <span className="font-semibold">{format.thb(row.closing)}</span>,
            },
            {
              id: "rules",
              header: t("byRule"),
              cell: (row) => (
                <span className="text-muted text-xs">
                  {row.byRule
                    .map((item) =>
                      t("ruleLine", {
                        rule: item.ruleKey === "manual" ? t("manual") : item.ruleKey,
                        up: format.thb(item.increase),
                        down: format.thb(item.decrease),
                      }),
                    )
                    .join(" · ")}
                </span>
              ),
            },
          ]}
        />
        {data ? (
          <Link
            href={`/finance/reports/gl-detail?account=${data.accountCode}&from=${params.from}&to=${params.to}`}
            className="text-primary mt-2 inline-block text-sm hover:underline"
          >
            {t("openGl", { code: data.accountCode })}
          </Link>
        ) : null}
      </DeskSection>
    );
  };
  return (
    <ReportBody
      bar={
        <PeriodBar
          range={{ from: params.from!, to: params.to!, fromLabel: tReports("from"), toLabel: tReports("to") }}
          onChange={set}
        />
      }
    >
      <div className="flex flex-col gap-7">
        {table(t("points"), t("pointsNote"), points)}
        {table(t("retention"), t("retentionNote"), retention)}
      </div>
    </ReportBody>
  );
}

/* ----------------------------------------------------------------------------- reconciliation */

/**
 * Each sub-ledger against its control account (§7 step 8, `admin.financialReports.subledgerReconciliation`):
 * every difference must be zero. The sub-ledgers are as of now; the month moves the fixed-asset row only.
 */
export function ReconciliationView() {
  const t = useTranslations("finance.reports.reconciliation");
  const format = useFormat();
  const [params, set] = useParams({ period: thisMonth() });
  const shown = params.period!;
  const report = useQuery({
    queryKey: queryKeys.detail("admin", "subledger-reconciliation", shown),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/financial-reports/subledger-reconciliation", {
          params: { query: { period: shown } },
        })
      ).data!,
  });
  const data = report.data;
  return (
    <ReportBody bar={<PeriodBar month={{ value: shown, label: t("assetsMonth") }} onChange={set} />}>
      {data ? <p className="text-muted text-sm">{t("asOf", { at: format.dateTime(data.asOf) })}</p> : null}
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      <DataTable
        caption={t("title")}
        rows={data?.rows ?? []}
        loading={report.isPending}
        getRowId={(row) => row.key}
        rowTone={(row) => (isZeroMoney(row.difference) ? undefined : "danger")}
        columns={[
          {
            id: "ledger",
            header: t("subledger"),
            cell: (row) =>
              t.has(`keys.${row.key}`) ? t(`keys.${row.key}`) : t("keys.fixed_assets", { code: row.accounts }),
          },
          {
            id: "account",
            header: t("account"),
            cell: (row) => (
              <Link
                href={`/finance/reports/gl-detail?account=${row.accounts}`}
                className="text-primary tabular-nums hover:underline"
              >
                {row.accounts}
              </Link>
            ),
          },
          { id: "sub", header: t("subledgerAmount"), numeric: true, cell: (row) => format.thb(row.subledger) },
          { id: "gl", header: t("gl"), numeric: true, cell: (row) => format.thb(row.gl) },
          {
            id: "difference",
            header: t("difference"),
            cell: (row) => (
              <Check ok={isZeroMoney(row.difference)} okLabel={t("agrees")} badLabel={format.thb(row.difference)} />
            ),
          },
        ]}
      />
    </ReportBody>
  );
}
