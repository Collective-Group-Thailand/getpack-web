"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isNegativeMoney, moneyText } from "@/domain/money";
import {
  BANK_ACCOUNT_STATUS,
  BANK_MATCH_STATUS,
  SETTLEMENT_STATUS,
  UNIDENTIFIED_RECEIPT_STATUS,
} from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchInput } from "@/ui/components/SearchInput";
import { Select } from "@/ui/components/Select";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { useDebouncedValue } from "../console/filters";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { QueueTabs } from "../console/queues";
import { ResourceList } from "../console/ResourceList";
import type { InitialPage } from "../console/resource";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import { bankLinesList, settlementsList, type BankLine, type SettlementSummary } from "./resources";
import { AccountNo, fieldErrorsOf } from "./shared";
import { invalidateMoney } from "./slips";

type Suggestion = Schemas["BankLineSuggestionDto"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

export function BankingNav() {
  const t = useTranslations("finance.banking.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/banking", label: t("cash"), exact: true },
        { href: "/finance/banking/lines", label: t("lines") },
        { href: "/finance/banking/import", label: t("import"), permission: "banking.manage" },
        { href: "/finance/banking/unidentified", label: t("unidentified") },
        { href: "/finance/banking/accounts", label: t("accounts") },
      ]}
    />
  );
}

function useCompanyAccounts() {
  return useQuery({
    queryKey: queryKeys.list("admin", "company-bank-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/company-bank-accounts", {})).data!,
    staleTime: 5 * 60_000,
  });
}

/**
 * The daily cash position (§6): per company account its GL balance beside the last statement
 * balance and what is still unmatched, and the clearing accounts money passes through (1131–1133)
 * with unidentified receipts (1140). Both balances are the API's; the screen compares nothing.
 */
export function CashPosition() {
  const t = useTranslations("finance.banking.cash");
  const format = useFormat();
  const [asOf, setAsOf] = useState(bangkokToday);
  const position = useQuery({
    queryKey: queryKeys.list("admin", "cash-position", { asOf }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/cash-position", { params: { query: { asOf } } })).data!,
  });
  const accounts = useQuery({
    queryKey: queryKeys.list("admin", "ledger-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/accounts")).data!,
    staleTime: 10 * 60_000,
  });
  const name = (code: string) => accounts.data?.find((account) => account.code === code)?.nameTh ?? code;
  if (position.isError) return <QueryError error={position.error} onRetry={() => void position.refetch()} />;
  type Bank = Schemas["CashBankRowDto"];
  const columns: DataTableColumn<Bank>[] = [
    {
      id: "account",
      header: t("account"),
      cell: (row) => (
        <div>
          <AccountNo last4={row.accountNoLast4} />
          <p className="text-muted text-xs">
            {row.glAccountCode} {name(row.glAccountCode)}
          </p>
        </div>
      ),
    },
    {
      id: "gl",
      header: t("glBalance"),
      numeric: true,
      cell: (row) => (
        <Link href={`/finance/ledger/journals?accountCode=${row.glAccountCode}`} className="hover:underline">
          {format.thb(row.glBalance)}
        </Link>
      ),
    },
    {
      id: "statement",
      header: t("statementBalance"),
      numeric: true,
      cell: (row) => (row.statementBalance ? format.thb(row.statementBalance) : "–"),
    },
    {
      id: "unmatched",
      header: t("unmatched"),
      numeric: true,
      cell: (row) =>
        row.unmatchedLines > 0 ? (
          <Link
            href={`/finance/banking/lines?companyBankAccountId=${row.companyBankAccountId}`}
            className="text-primary font-medium hover:underline"
          >
            {format.number(row.unmatchedLines)}
          </Link>
        ) : (
          "0"
        ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("title")}
        description={t("description")}
        actions={
          <Field label={t("asOf")} className="w-44">
            <Input
              type="date"
              value={asOf}
              max={bangkokToday()}
              onChange={(event) => setAsOf(event.target.value || bangkokToday())}
            />
          </Field>
        }
      >
        <DataTable
          caption={t("banks")}
          columns={columns}
          rows={position.data?.banks ?? []}
          loading={position.isPending}
          getRowId={(row) => row.companyBankAccountId}
          density="compact"
        />
      </Section>
      <Section title={t("clearing")} description={t("clearingNote")}>
        <DataTable
          caption={t("clearing")}
          density="compact"
          rows={position.data?.clearing ?? []}
          loading={position.isPending}
          getRowId={(row) => row.accountCode}
          columns={[
            {
              id: "account",
              header: t("account"),
              cell: (row) => (
                <Link href={`/finance/ledger/journals?accountCode=${row.accountCode}`} className="hover:underline">
                  <span className="font-mono text-sm">{row.accountCode}</span> {name(row.accountCode)}
                </Link>
              ),
            },
            { id: "balance", header: t("balance"), numeric: true, cell: (row) => format.thb(row.balance) },
          ]}
        />
      </Section>
    </div>
  );
}

/**
 * The matching workbench (§6): bank lines by what became of them, unmatched first. A line opens
 * beside the list with what it could be — candidates by amount, reference and date window — to
 * match one, split it across several, park unknown money as an unidentified receipt (P29), or mark
 * it as nothing to post.
 */
export function BankLines({ initial }: { initial: InitialPage<BankLine> | null }) {
  const t = useTranslations("finance.banking.lines");
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("line");
  const [opened, setOpened] = useState<BankLine | null>(null);

  const setOpen = (line: BankLine | null) => {
    setOpened(line);
    const next = new URLSearchParams(params);
    if (line) next.set("line", line.id);
    else next.delete("line");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const columns: DataTableColumn<BankLine>[] = [
    {
      id: "txnDate",
      header: t("columns.date"),
      sortable: true,
      cell: (row) => <span className="whitespace-nowrap">{format.date(row.txnDate)}</span>,
    },
    {
      id: "description",
      header: t("columns.description"),
      cell: (row) => (
        <button type="button" className="text-primary text-start hover:underline" onClick={() => setOpen(row)}>
          {row.description}
          {row.reference ? <span className="text-muted block font-mono text-xs">{row.reference}</span> : null}
        </button>
      ),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      numeric: true,
      cell: (row) => (
        <span className={isNegativeMoney(row.amount) ? "text-danger" : "text-success"}>{format.thb(row.amount)}</span>
      ),
    },
    {
      id: "balance",
      header: t("columns.balance"),
      numeric: true,
      hideable: true,
      cell: (row) => (row.runningBalance ? format.thb(row.runningBalance) : "–"),
    },
    {
      id: "account",
      header: t("columns.account"),
      hideable: true,
      cell: (row) => <AccountNo last4={row.accountNoLast4} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={BANK_MATCH_STATUS} value={row.matchStatus} />,
    },
    {
      id: "matches",
      header: t("columns.matches"),
      cell: (row) =>
        row.matches.length ? (
          <span className="text-sm">
            {row.matches.map((match) => t(`targets.${match.targetType}`)).join(", ")}
            {row.matches.some((match) => match.auto) ? (
              <span className="text-muted block text-xs">{t("auto")}</span>
            ) : null}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="matchStatus"
        tabs={[
          // No `matchStatus` in the URL is the list's default: what still needs a person.
          { value: null, label: t("unmatched"), countKey: "finance.unmatched_bank_lines" },
          { value: "matched", label: t("matched") },
          { value: "unidentified", label: t("unidentified") },
          { value: "ignored", label: t("ignored") },
        ]}
      />
      <ResourceList
        resource={bankLinesList}
        columns={columns}
        caption={t("title")}
        initial={initial}
        searchLabel={t("search")}
        empty={{ title: t("empty") }}
      />
      {openId ? <LineSheet lineId={openId} line={opened} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

type LineAction =
  { kind: "match"; suggestion: Suggestion } | { kind: "split" } | { kind: "unidentified" } | { kind: "ignore" };

function LineSheet({ lineId, line: known, onClose }: { lineId: string; line: BankLine | null; onClose: () => void }) {
  const t = useTranslations("finance.banking.lines.sheet");
  const tLines = useTranslations("finance.banking.lines");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("banking.manage");
  const [action, setAction] = useState<LineAction | null>(null);
  const [split, setSplit] = useState<Record<string, boolean>>({});
  const line = useQuery({
    queryKey: queryKeys.detail("admin", "bank-line", lineId),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/bank-statement-lines", {
          params: { query: { q: known?.reference ?? known?.description ?? undefined, perPage: 100 } },
        })
      ).data!.data.find((item) => item.id === lineId) ?? known,
    initialData: known ?? undefined,
  });
  const suggestions = useQuery({
    queryKey: queryKeys.related("admin", "bank-line", lineId, "suggestions"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/bank-statement-lines/{lineId}/suggestions", {
          params: { path: { lineId } },
        })
      ).data!,
    enabled: line.data?.matchStatus === "unmatched",
  });
  const data = line.data;
  const done = () => {
    invalidateMoney(queryClient);
    for (const resource of ["bank-line", "cash-position", "unidentified-receipt", "gateway-settlement"])
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
    onClose();
  };
  const picked = (suggestions.data ?? []).filter((item) => split[`${item.targetType}:${item.targetId}`]);

  async function run(idempotencyKey: string, reason: string) {
    if (!data || !action) return;
    const path = { lineId: data.id };
    try {
      if (action.kind === "match")
        await adminBrowserApis().contract.POST("/v1/admin/bank-statement-lines/{lineId}/actions/match", {
          params: { path, header: { "Idempotency-Key": idempotencyKey } },
          body: { targetType: action.suggestion.targetType, targetId: action.suggestion.targetId },
        });
      else if (action.kind === "split")
        await adminBrowserApis().contract.POST("/v1/admin/bank-statement-lines/{lineId}/actions/split", {
          params: { path, header: { "Idempotency-Key": idempotencyKey } },
          body: {
            parts: picked.map((item) => ({
              targetType: item.targetType,
              targetId: item.targetId,
              amount: item.amount,
            })),
          },
        });
      else if (action.kind === "unidentified")
        await adminBrowserApis().contract.POST("/v1/admin/bank-statement-lines/{lineId}/actions/mark-unidentified", {
          params: { path, header: { "Idempotency-Key": idempotencyKey } },
        });
      else
        await adminBrowserApis().contract.POST("/v1/admin/bank-statement-lines/{lineId}/actions/ignore", {
          params: { path, header: { "Idempotency-Key": idempotencyKey } },
          body: { reason },
        });
      toast.success(t(`done.${action.kind}`));
      done();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={data?.description ?? t("title")}
      description={
        data ? t("description", { date: format.date(data.txnDate), amount: format.thb(data.amount) }) : undefined
      }
      closeLabel={tCommon("actions.close")}
      footer={
        canManage && data?.matchStatus === "unmatched" ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setAction({ kind: "ignore" })}>
              {t("ignore")}
            </Button>
            {!isNegativeMoney(data.amount) ? (
              <Button variant="secondary" onClick={() => setAction({ kind: "unidentified" })}>
                {t("park")}
              </Button>
            ) : null}
            {picked.length >= 2 ? (
              <Button onClick={() => setAction({ kind: "split" })}>{t("splitMatch", { count: picked.length })}</Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {!data ? null : (
        <div className="flex flex-col gap-4">
          <DescriptionList
            columns={2}
            items={[
              { term: t("amount"), description: <span className="tabular-nums">{format.thb(data.amount)}</span> },
              {
                term: t("reference"),
                description: data.reference ? <span className="font-mono">{data.reference}</span> : "—",
              },
              { term: t("account"), description: <AccountNo last4={data.accountNoLast4} /> },
              { term: t("status"), description: <StatusChip map={BANK_MATCH_STATUS} value={data.matchStatus} /> },
            ]}
          />
          {data.matches.length ? (
            <Section title={t("matches")}>
              <ul className="flex flex-col gap-1 text-sm">
                {data.matches.map((match) => (
                  <li key={`${match.targetType}:${match.targetId}`}>
                    {tLines(`targets.${match.targetType}`)} ·{" "}
                    <span className="tabular-nums">{format.thb(match.amount)}</span>
                    {match.auto ? <span className="text-muted"> · {tLines("auto")}</span> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {data.matchStatus === "unmatched" ? (
            <Section title={t("suggestions")} description={t("suggestionsNote")}>
              {suggestions.isError ? (
                <QueryError error={suggestions.error} onRetry={() => void suggestions.refetch()} />
              ) : (suggestions.data ?? []).length === 0 && !suggestions.isPending ? (
                <EmptyState icon="search" title={t("noSuggestions")} description={t("noSuggestionsBody")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {(suggestions.data ?? []).map((item) => {
                    const key = `${item.targetType}:${item.targetId}`;
                    return (
                      <li key={key} className="border-border flex flex-wrap items-center gap-3 rounded-md border p-3">
                        {canManage ? (
                          <Checkbox
                            checked={Boolean(split[key])}
                            onCheckedChange={(value) => setSplit({ ...split, [key]: value === true })}
                            label={<span className="sr-only">{t("pickForSplit", { label: item.label })}</span>}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {tLines(`targets.${item.targetType}`)} ·{" "}
                            <span className="font-mono text-sm">{item.label}</span>
                          </p>
                          <p className="text-muted text-sm">
                            {format.date(item.date)} · <span className="tabular-nums">{format.thb(item.amount)}</span> ·{" "}
                            {item.reasons.map((reason) => t(`reasons.${reason}`)).join(", ")}
                          </p>
                        </div>
                        {canManage ? (
                          <Button
                            size="sm"
                            variant={item.amount === data.amount ? "primary" : "secondary"}
                            onClick={() => setAction({ kind: "match", suggestion: item })}
                          >
                            {t("match")}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          ) : null}
        </div>
      )}
      {data && action ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`confirm.${action.kind}Title`)}
          description={
            action.kind === "match"
              ? t("confirm.matchBody", {
                  line: format.thb(data.amount),
                  target: action.suggestion.label,
                  amount: format.thb(action.suggestion.amount),
                })
              : action.kind === "split"
                ? t("confirm.splitBody", { line: format.thb(data.amount), count: picked.length })
                : action.kind === "unidentified"
                  ? t("confirm.unidentifiedBody", { amount: format.thb(data.amount) })
                  : t("confirm.ignoreBody", { amount: format.thb(data.amount) })
          }
          confirmLabel={t(`confirm.${action.kind}`)}
          tone={action.kind === "ignore" ? "destructive" : "primary"}
          reason={
            action.kind === "ignore" ? { label: t("confirm.ignoreReason"), required: true, minLength: 3 } : undefined
          }
          onConfirm={({ idempotencyKey, reason }) => run(idempotencyKey, reason)}
        />
      ) : null}
    </Sheet>
  );
}

/** Statement import (a bank file through the generic adapter, D-093) and gateway settlements (P04). */
export function BankImports({ initial }: { initial: InitialPage<SettlementSummary> | null }) {
  const t = useTranslations("finance.banking.import");
  const tCommon = useTranslations("common");
  const tCommonFinance = useTranslations("finance.common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const accounts = useCompanyAccounts();
  const active = (accounts.data ?? []).filter((account) => account.status === "active");
  const [accountId, setAccountId] = useState("");
  const chosen = accountId || active[0]?.id || "";
  const [file, setFile] = useState<File | null>(null);
  const [statementKey, setStatementKey] = useState(() => crypto.randomUUID());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Schemas["ImportResultDto"] | null>(null);

  async function importStatement() {
    if (!file || !chosen) return;
    setImporting(true);
    try {
      const uploaded = await uploadFile("admin", file, "import");
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/bank-statements", {
        params: { header: { "Idempotency-Key": statementKey } },
        body: { companyBankAccountId: chosen, fileId: uploaded.id, format: "generic_csv" },
      });
      setResult(data ?? null);
      setFile(null);
      setStatementKey(crypto.randomUUID());
      invalidateMoney(queryClient);
      for (const resource of ["bank-line", "cash-position", "gateway-settlement"])
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "dashboard") });
      toast.success(t("imported", { lines: data?.lines ?? 0, matched: data?.matched ?? 0 }));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setImporting(false);
    }
  }

  const settlementColumns: DataTableColumn<SettlementSummary>[] = [
    {
      id: "settlementDate",
      header: t("settlements.date"),
      sortable: true,
      cell: (row) => format.date(row.settlementDate),
    },
    { id: "provider", header: t("settlements.provider"), cell: (row) => t(`providers.${row.provider}`) },
    { id: "gross", header: t("settlements.gross"), numeric: true, cell: (row) => format.thb(row.grossAmount) },
    { id: "fee", header: t("settlements.fee"), numeric: true, cell: (row) => format.thb(row.feeAmount) },
    { id: "vat", header: t("settlements.vat"), numeric: true, cell: (row) => format.thb(row.vatOnFee) },
    { id: "net", header: t("settlements.net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    {
      id: "lines",
      header: t("settlements.lines"),
      numeric: true,
      cell: (row) =>
        row.unmatchedLines ? (
          <span className="text-danger">
            {t("settlements.unmatched", { count: row.unmatchedLines, total: row.lineCount })}
          </span>
        ) : (
          format.number(row.lineCount)
        ),
    },
    {
      id: "status",
      header: t("settlements.status"),
      cell: (row) => <StatusChip map={SETTLEMENT_STATUS} value={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("statementTitle")} description={t("statementNote")}>
        <div className="grid gap-3 sm:grid-cols-[18rem_1fr]">
          <Field label={t("account")} required requiredLabel={tCommon("state.required")}>
            <Select
              value={chosen || undefined}
              onValueChange={setAccountId}
              options={active.map((account) => ({
                value: account.id,
                label: tCommonFinance("accountOption", {
                  bank: account.bankCode,
                  last4: account.accountNoLast4,
                  gl: account.glAccountCode,
                }),
              }))}
            />
          </Field>
          <Field label={t("file")} hint={t("fileHint")}>
            <FileDropzone
              accept=".csv,text/csv"
              maxBytes={5 * 1024 * 1024}
              onFiles={([picked]) => setFile(picked ?? null)}
              labels={{
                prompt: file ? t("chosen", { name: file.name }) : t("drop"),
                browse: t("browse"),
                tooLarge: (name) => t("tooLarge", { name }),
                wrongType: (name) => t("wrongType", { name }),
              }}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button loading={importing} disabled={!file || !chosen} onClick={() => void importStatement()}>
            {t("importStatement")}
          </Button>
          {result ? (
            <span className="text-sm">{t("result", { lines: result.lines, matched: result.matched })}</span>
          ) : null}
        </div>
      </Section>
      <SettlementImport accounts={active} />
      <Section title={t("settlementsTitle")}>
        <ResourceList
          resource={settlementsList}
          columns={settlementColumns}
          caption={t("settlementsTitle")}
          initial={initial}
          empty={{ title: t("noSettlements") }}
        />
      </Section>
    </div>
  );
}

function SettlementImport({ accounts }: { accounts: Schemas["CompanyBankAccountDto"][] }) {
  const t = useTranslations("finance.banking.import.settlement");
  const tImport = useTranslations("finance.banking.import");
  const tCommon = useTranslations("common");
  const tCommonFinance = useTranslations("finance.common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    provider: "scb" as Schemas["SettlementProvider"],
    settlementDate: bangkokToday(),
    accountId: "",
    feeTaxInvoiceNo: "",
    vatOnFee: "",
    rows: "",
  });
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = form.accountId || accounts[0]?.id || "";

  function parse() {
    const lines = form.rows
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split(",").map((cell) => cell.trim()));
    const parsed = lines.map(([providerRef, gross, fee]) => ({
      providerRef: providerRef ?? "",
      grossAmount: moneyText(gross ?? "") ?? "",
      feeAmount: moneyText(fee ?? "") ?? "",
    }));
    return parsed.every((line) => line.providerRef && line.grossAmount && line.feeAmount) && parsed.length
      ? parsed
      : null;
  }

  async function submit() {
    const lines = parse();
    const vat = moneyText(form.vatOnFee || "0");
    if (!lines) return setError(t("badRows"));
    if (!vat) return setError(t("badVat"));
    setBusy(true);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/gateway-settlements", {
        params: { header: { "Idempotency-Key": idempotencyKey } },
        body: {
          provider: form.provider,
          settlementDate: form.settlementDate,
          companyBankAccountId: chosen,
          vatOnFee: vat,
          feeTaxInvoiceNo: form.feeTaxInvoiceNo.trim() || null,
          lines,
        },
      });
      setForm({ ...form, rows: "", vatOnFee: "", feeTaxInvoiceNo: "" });
      setIdempotencyKey(crypto.randomUUID());
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "gateway-settlement") });
      toast.success(t("imported", { net: data?.netAmount ?? "" }));
    } catch (failure) {
      setError(Object.values(fieldErrorsOf(failure))[0] ?? problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t("title")} description={t("description")}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("provider")}>
          <Select<Schemas["SettlementProvider"]>
            value={form.provider}
            onValueChange={(provider) => setForm({ ...form, provider })}
            options={(["scb", "twoc2p"] as const).map((value) => ({ value, label: tImport(`providers.${value}`) }))}
          />
        </Field>
        <Field label={t("date")} required requiredLabel={tCommon("state.required")}>
          <Input
            type="date"
            value={form.settlementDate}
            max={bangkokToday()}
            onChange={(event) => setForm({ ...form, settlementDate: event.target.value })}
          />
        </Field>
        <Field label={t("account")}>
          <Select
            value={chosen || undefined}
            onValueChange={(accountId) => setForm({ ...form, accountId })}
            options={accounts.map((account) => ({
              value: account.id,
              label: tCommonFinance("accountWithBank", { bank: account.bankCode, last4: account.accountNoLast4 }),
            }))}
          />
        </Field>
        <Field label={t("vat")} hint={t("vatHint")}>
          <Input
            inputMode="decimal"
            value={form.vatOnFee}
            onChange={(event) => setForm({ ...form, vatOnFee: event.target.value })}
          />
        </Field>
        <Field label={t("feeInvoice")} className="sm:col-span-2">
          <Input
            value={form.feeTaxInvoiceNo}
            onChange={(event) => setForm({ ...form, feeTaxInvoiceNo: event.target.value })}
          />
        </Field>
        <Field label={t("rows")} hint={t("rowsHint")} error={error ?? undefined} className="sm:col-span-4">
          <Textarea
            value={form.rows}
            onChange={(event) => setForm({ ...form, rows: event.target.value })}
            rows={4}
            className="font-mono"
          />
        </Field>
      </div>
      <div className="mt-3">
        <Button loading={busy} disabled={!form.rows.trim() || !chosen} onClick={() => void submit()}>
          {t("import")}
        </Button>
      </div>
    </Section>
  );
}

/**
 * Unidentified receipts (P29): money nobody claims, parked in 1140 until Finance finds whose it is;
 * identifying it makes it a payment of that order group, with its tax invoice / receipt.
 */
export function UnidentifiedReceipts() {
  const t = useTranslations("finance.banking.unidentified");
  const format = useFormat();
  const params = useSearchParams();
  const canManage = useCan("banking.manage");
  const status = (params.get("status") ?? "open") as Schemas["UnidentifiedReceiptStatus"];
  const [identifying, setIdentifying] = useState<Schemas["UnidentifiedReceiptDto"] | null>(null);
  const rows = useQuery({
    queryKey: queryKeys.list("admin", "unidentified-receipt", { status }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/unidentified-receipts", { params: { query: { status } } }))
        .data!,
  });
  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("open"), countKey: "finance.unidentified_receipts" },
          { value: "matched", label: t("matched") },
          { value: "refunded", label: t("refunded") },
        ]}
      />
      {rows.isError ? (
        <QueryError error={rows.error} onRetry={() => void rows.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          rows={rows.data ?? []}
          loading={rows.isPending}
          getRowId={(row) => row.id}
          empty={<EmptyState icon="inbox" title={t("empty")} />}
          columns={[
            { id: "receivedOn", header: t("receivedOn"), cell: (row) => format.date(row.receivedOn) },
            {
              id: "description",
              header: t("description"),
              cell: (row) => (
                <span>
                  {row.description}
                  {row.reference ? <span className="text-muted block font-mono text-xs">{row.reference}</span> : null}
                </span>
              ),
            },
            { id: "amount", header: t("amount"), numeric: true, cell: (row) => format.thb(row.amount) },
            {
              id: "status",
              header: t("status"),
              cell: (row) => <StatusChip map={UNIDENTIFIED_RECEIPT_STATUS} value={row.status} />,
            },
            {
              id: "actions",
              header: <span className="sr-only">{t("actions")}</span>,
              cell: (row) =>
                canManage && row.status === "open" ? (
                  <Button size="sm" variant="secondary" onClick={() => setIdentifying(row)}>
                    {t("identify")}
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
      {identifying ? <Identify receipt={identifying} onClose={() => setIdentifying(null)} /> : null}
    </div>
  );
}

function Identify({ receipt, onClose }: { receipt: Schemas["UnidentifiedReceiptDto"]; onClose: () => void }) {
  const t = useTranslations("finance.banking.unidentified.identifyForm");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [text, setText] = useDebouncedValue(q, setQ);
  const [picked, setPicked] = useState<{ groupId: string; groupCode: string; orderCode: string } | null>(null);
  // `q` matches a group or order code, or the customer code (admin.orders.listGroups).
  const groups = useQuery({
    queryKey: queryKeys.list("admin", "order_group", { q, identify: true }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/order-groups", { params: { query: { q, perPage: 10 } } }))
        .data!,
    enabled: q.trim().length >= 2,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title", { amount: format.thb(receipt.amount) })}
      description={t("description")}
      closeLabel={tCommon("actions.close")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
        </div>
      }
    >
      <Field label={t("search")} hint={t("searchHint")}>
        <SearchInput value={text} onValueChange={setText} clearLabel={t("clear")} />
      </Field>
      <ul className="mt-3 flex flex-col gap-2">
        {(groups.data?.data ?? []).map((group) => {
          const orderCodes = group.orders.map((order) => order.orderCode).join(", ");
          return (
            <li key={group.id}>
              <button
                type="button"
                className="border-border hover:bg-surface-subtle flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-start text-sm"
                onClick={() => setPicked({ groupId: group.id, groupCode: group.groupCode, orderCode: orderCodes })}
              >
                <span className="font-mono font-medium">{group.groupCode}</span>
                <span className="font-mono">{orderCodes}</span>
                {/* The group names its customer by id only (CONTRACT-GAP admin.orders). */}
                <span className="ms-auto tabular-nums">{format.thb(group.totals.grossAmount)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setPicked(null))}
          title={t("confirmTitle")}
          description={t("confirmBody", {
            amount: format.thb(receipt.amount),
            group: picked.groupCode,
            order: picked.orderCode,
          })}
          confirmLabel={t("identify")}
          confirmationPhrase={picked.groupCode}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/unidentified-receipts/{receiptId}/actions/identify", {
                params: { path: { receiptId: receipt.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { orderGroupId: picked.groupId },
              });
              invalidateMoney(queryClient);
              for (const resource of ["unidentified-receipt", "cash-position", "order"])
                void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
              toast.success(t("done", { group: picked.groupCode }));
              onClose();
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </Dialog>
  );
}

/** Company bank accounts (D-093): each tied to its own cash GL account; a new one needs two approvers. */
export function CompanyBankAccounts() {
  const t = useTranslations("finance.banking.accounts");
  const canPropose = useCan("banking.accounts.propose");
  const accounts = useCompanyAccounts();
  const [proposing, setProposing] = useState(false);
  if (accounts.isError) return <QueryError error={accounts.error} onRetry={() => void accounts.refetch()} />;
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={
        canPropose ? (
          <Button size="sm" iconStart="plus" onClick={() => setProposing(true)}>
            {t("propose")}
          </Button>
        ) : null
      }
    >
      <DataTable
        caption={t("title")}
        density="compact"
        rows={accounts.data ?? []}
        loading={accounts.isPending}
        getRowId={(row) => row.id}
        columns={[
          {
            id: "account",
            header: t("account"),
            cell: (row) => (
              <div>
                <AccountNo bank={row.bankCode} last4={row.accountNoLast4} />
                <p className="text-muted text-xs">{row.accountName}</p>
              </div>
            ),
          },
          { id: "purpose", header: t("purpose"), cell: (row) => t(`purposes.${row.purpose}`) },
          { id: "gl", header: t("gl"), cell: (row) => <span className="font-mono">{row.glAccountCode}</span> },
          { id: "format", header: t("format"), cell: (row) => row.defaultBulkFormat },
          {
            id: "status",
            header: t("status"),
            cell: (row) => <StatusChip map={BANK_ACCOUNT_STATUS} value={row.status} />,
          },
          {
            id: "approval",
            header: t("approval"),
            cell: (row) =>
              row.approvalRequestId ? (
                <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary hover:underline">
                  {t("openApproval")}
                </Link>
              ) : (
                "–"
              ),
          },
        ]}
      />
      {proposing ? <ProposeCompanyAccount onClose={() => setProposing(false)} /> : null}
    </Section>
  );
}

function ProposeCompanyAccount({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.banking.accounts.form");
  const tAccounts = useTranslations("finance.banking.accounts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    bankCode: "014",
    accountName: "",
    accountNo: "",
    branchName: "",
    purpose: "collection" as Schemas["BankAccountPurpose"],
    glAccountCode: "1123",
    defaultBulkFormat: "generic_csv",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("send")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.accountName.trim() || !form.accountNo.trim()) throw new FormError(t("needFields"));
        try {
          await adminBrowserApis().contract.POST("/v1/admin/company-bank-accounts", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              ...form,
              accountName: form.accountName.trim(),
              accountNo: form.accountNo.trim(),
              branchName: form.branchName.trim() || null,
            },
          });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "company-bank-account") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
        toast.success(t("sent"));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Callout tone="info" title={t("dual")} className="sm:col-span-2" />
        <Field label={t("bank")}>
          <Select
            value={form.bankCode}
            onValueChange={(bankCode) => setForm({ ...form, bankCode })}
            options={["002", "004", "006", "011", "014", "025", "069"].map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label={t("number")} required requiredLabel={tCommon("state.required")} error={errors.accountNo}>
          <Input
            inputMode="numeric"
            value={form.accountNo}
            onChange={(event) => setForm({ ...form, accountNo: event.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field
          label={t("name")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.accountName}
          className="sm:col-span-2"
        >
          <Input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} />
        </Field>
        <Field label={t("purpose")}>
          <Select<Schemas["BankAccountPurpose"]>
            value={form.purpose}
            onValueChange={(purpose) => setForm({ ...form, purpose })}
            options={(["collection", "payout", "both"] as const).map((value) => ({
              value,
              label: tAccounts(`purposes.${value}`),
            }))}
          />
        </Field>
        <Field label={t("gl")} hint={t("glHint")} error={errors.glAccountCode}>
          <Input
            value={form.glAccountCode}
            onChange={(event) => setForm({ ...form, glAccountCode: event.target.value })}
          />
        </Field>
      </div>
    </FormDialog>
  );
}
