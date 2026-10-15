"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isZeroMoney } from "@/domain/money";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Pagination } from "@/ui/components/Pagination";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";

import { adminBrowserApis } from "../console/api";
import { Section } from "../console/FormDialog";
import { QueryError } from "../console/QueryError";
import { SectionNav } from "../console/SectionNav";
import { downloadCsv, toCsv } from "./csv";
import { AccountPicker, useAccounts } from "./ledger";
import { Figure, journalHref, sourceHref } from "./shared";

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

function MonthRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (patch: Record<string, string>) => void;
}) {
  const t = useTranslations("finance.reports");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t("from")} className="w-40">
        <Input
          type="month"
          value={from}
          max={to}
          onChange={(event) => event.target.value && onChange({ from: event.target.value })}
        />
      </Field>
      <Field label={t("to")} className="w-40">
        <Input
          type="month"
          value={to}
          min={from}
          onChange={(event) => event.target.value && onChange({ to: event.target.value })}
        />
      </Field>
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
          <span className="font-mono">{row.accountCode}</span> {row.nameTh}
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
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <MonthRange from={params.from!} to={params.to!} onChange={set} />
          <Switch
            label={t("includeZero")}
            checked={params.zero === "true"}
            onCheckedChange={(checked) => set({ zero: String(checked) })}
          />
          <Button
            variant="secondary"
            iconStart="download"
            disabled={!data}
            onClick={() => data && downloadCsv(`trial-balance-${params.from}-${params.to}.csv`, trialBalanceCsv(data))}
          >
            {tReports("export")}
          </Button>
        </div>
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="mb-3">
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
        <dl className="mt-3 grid gap-3 sm:grid-cols-4">
          <Figure label={t("totalOpening")} amount={data.totals.opening} />
          <Figure label={t("totalDebit")} amount={data.totals.debit} />
          <Figure label={t("totalCredit")} amount={data.totals.credit} />
          <Figure
            label={t("totalClosing")}
            amount={data.totals.closing}
            tone={isZeroMoney(data.totals.closing) ? "success" : "danger"}
          />
        </dl>
      ) : null}
    </Section>
  );
}

/* --------------------------------------------------------------------------------- GL detail */

/** One account's lines with the running balance, each drilling down to its journal and source. */
export function GlDetailView() {
  const t = useTranslations("finance.reports.glDetail");
  const tReports = useTranslations("finance.reports");
  const tJournals = useTranslations("finance.journals");
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
          className="text-primary font-mono text-sm whitespace-nowrap hover:underline"
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
        const label =
          row.sourceNo ?? (row.sourceType ? tJournals(`sourceTypes.${row.sourceType}`) : tJournals("manual"));
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
    <Section
      title={data ? t("titleOf", { code: data.accountCode, name: data.nameTh }) : t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("account")} className="w-72">
            <AccountPicker
              label={t("account")}
              value={params.account!}
              onChange={(account) => account && set({ account, page: "1" })}
              accounts={accounts.data ?? []}
              allowControl
            />
          </Field>
          <MonthRange from={params.from!} to={params.to!} onChange={(patch) => set({ ...patch, page: "1" })} />
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
        </div>
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <dl className="mb-3 grid gap-3 sm:grid-cols-4">
          <Figure label={t("opening")} amount={data.opening} />
          <Figure label={t("debit")} amount={data.debit} />
          <Figure label={t("credit")} amount={data.credit} />
          <Figure label={t("closing")} amount={data.closing} />
        </dl>
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
    </Section>
  );
}

/* ------------------------------------------------------------------------------ balance sheet */

type BalanceLine = Schemas["BalanceLineDto"];

/** The balance sheet at a date: assets = liabilities + equity (the profit of the year included). */
export function BalanceSheetView() {
  const t = useTranslations("finance.reports.balanceSheet");
  const format = useFormat();
  const [params, set] = useParams({ asOf: bangkokToday() });
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
  const table = (caption: string, rows: BalanceLine[]) => (
    <DataTable
      caption={caption}
      showCaption
      rows={rows}
      getRowId={(row) => row.accountCode}
      density="compact"
      columns={[
        {
          id: "account",
          header: t("account"),
          cell: (row) => (
            <Link
              href={`/finance/reports/gl-detail?account=${row.accountCode}`}
              className="text-primary hover:underline"
            >
              <span className="font-mono">{row.accountCode}</span> {row.nameTh}
            </Link>
          ),
        },
        { id: "balance", header: t("balance"), numeric: true, cell: (row) => format.thb(row.balance) },
      ]}
    />
  );
  return (
    <Section
      title={t("title", { date: format.date(params.asOf!) })}
      description={t("description")}
      actions={
        <Field label={t("asOf")} className="w-44">
          <Input
            type="date"
            value={params.asOf}
            onChange={(event) => event.target.value && set({ asOf: event.target.value })}
          />
        </Field>
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <Check
            ok={isZeroMoney(data.difference)}
            okLabel={t("balanced")}
            badLabel={t("differs", { amount: format.thb(data.difference) })}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {table(t("assets"), data.assets)}
            <div className="flex flex-col gap-4">
              {table(t("liabilities"), data.liabilities)}
              {table(t("equity"), data.equity)}
              <dl className="grid gap-3 sm:grid-cols-2">
                <Figure label={t("priorYears")} amount={data.priorYearsProfit} />
                <Figure label={t("currentYear")} amount={data.currentYearProfit} />
              </dl>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Figure label={t("totalAssets")} amount={data.totals.assets} />
            <Figure label={t("totalLiabilities")} amount={data.totals.liabilities} />
            <Figure label={t("totalEquity")} amount={data.totals.equity} />
          </dl>
        </div>
      ) : null}
    </Section>
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

/** Profit and loss, pivoted by a dimension: margin per factory, product type, channel, campaign, cost centre (§3). */
export function ProfitAndLossView() {
  const t = useTranslations("finance.reports.profitAndLoss");
  const tReports = useTranslations("finance.reports");
  const format = useFormat();
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
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <MonthRange from={params.from!} to={params.to!} onChange={set} />
          <Field label={t("by")} className="w-48">
            <SearchableSelect
              value={dimension}
              onValueChange={(by) => set({ by })}
              options={DIMENSIONS.map((value) => ({ value, label: t(`dimensions.${value}`) }))}
            />
          </Field>
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
        </div>
      }
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={data?.lines ?? []}
        loading={report.isPending}
        getRowId={(row) => row.dimension}
        density="compact"
        empty={<EmptyState icon="chart" title={t("empty")} />}
      />
      {data ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-5">
          <Figure label={t("revenue")} amount={data.totals.revenue} />
          <Figure label={t("costOfSales")} amount={data.totals.costOfSales} />
          <Figure label={t("grossMargin")} amount={data.totals.grossMargin} />
          <Figure label={t("expenses")} amount={data.totals.expenses} />
          <Figure label={t("netProfit")} amount={data.totals.netProfit} />
        </dl>
      ) : null}
    </Section>
  );
}

/* ---------------------------------------------------------------------------------- cash flow */

/** The indirect cash-flow statement: net profit, then each account's movement by its cash-flow class. */
export function CashFlowView() {
  const t = useTranslations("finance.reports.cashFlow");
  const format = useFormat();
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
  const section = (caption: string, rows: Schemas["CashLineDto"][], total: string) => (
    <div>
      <DataTable
        caption={caption}
        showCaption
        rows={rows}
        getRowId={(row) => row.accountCode}
        density="compact"
        empty={<EmptyState icon="coins" title={t("nothing")} />}
        columns={[
          {
            id: "account",
            header: t("account"),
            cell: (row) => (
              <span>
                <span className="font-mono">{row.accountCode}</span> {row.nameTh}
              </span>
            ),
          },
          { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
        ]}
      />
      <p className="mt-1 text-end text-sm font-semibold tabular-nums">
        {t("sectionTotal", { amount: format.thb(total) })}
      </p>
    </div>
  );
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={<MonthRange from={params.from!} to={params.to!} onChange={set} />}
    >
      {report.isError ? <QueryError error={report.error} onRetry={() => void report.refetch()} /> : null}
      {data ? (
        <div className="flex flex-col gap-4">
          <Check
            ok={isZeroMoney(data.difference)}
            okLabel={t("agrees")}
            badLabel={t("differs", { amount: format.thb(data.difference) })}
          />
          <dl className="grid gap-3 sm:grid-cols-3">
            <Figure label={t("netProfit")} amount={data.netProfit} />
            <Figure label={t("netChange")} amount={data.netChange} />
            <Figure label={t("cashMovement")} amount={data.cashMovement} />
          </dl>
          {section(t("operating"), data.operating.adjustments, data.operating.total)}
          {section(t("investing"), data.investing.lines, data.investing.total)}
          {section(t("financing"), data.financing.lines, data.financing.total)}
        </div>
      ) : null}
    </Section>
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
      <Section
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
      </Section>
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <MonthRange from={params.from!} to={params.to!} onChange={set} />
      </div>
      {table(t("points"), t("pointsNote"), points)}
      {table(t("retention"), t("retentionNote"), retention)}
    </div>
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
  const [params] = useParams({ period: thisMonth() });
  const [shown, setShown] = useState(params.period!);
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
    <Section
      title={t("title")}
      description={data ? `${t("description")} ${t("asOf", { at: format.dateTime(data.asOf) })}` : t("description")}
      actions={
        <Field label={t("assetsMonth")} className="w-40">
          <Input type="month" value={shown} onChange={(event) => event.target.value && setShown(event.target.value)} />
        </Field>
      }
    >
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
                className="text-primary font-mono hover:underline"
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
    </Section>
  );
}
