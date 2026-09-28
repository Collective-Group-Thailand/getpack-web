"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PERIOD_STATUS, RECURRING_JOURNAL_STATUS, SETTING_VERSION_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, Textarea } from "@/ui/components/Input";
import { JsonView } from "@/ui/components/JsonView";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { useCan } from "../console/actor";
import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, FormError, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { SectionNav } from "../console/SectionNav";
import { StatusChip } from "../console/StatusChip";
import { fieldErrorsOf, journalHref } from "./shared";

type Account = Schemas["AccountDto"];
type Period = Schemas["FiscalPeriodDto"];
type LineInput = Schemas["ManualJournalLineDto"];
type Rule = Schemas["PostingRuleDto"];
type Recurring = Schemas["RecurringJournalDto"];

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** A version effective "today" starts now — the API refuses anything back-dated, midnight included. */
export const effectiveInstant = (date: string) =>
  date <= bangkokToday() ? new Date(Date.now() + 60_000).toISOString() : `${date}T00:00:00+07:00`;

export const LEDGER_DIMENSIONS = [
  "order",
  "order_group",
  "customer",
  "company",
  "factory",
  "vendor",
  "product_type",
  "channel",
  "campaign",
  "promotion",
  "cost_centre",
] as const satisfies readonly Schemas["LedgerDimension"][];

/* --------------------------------------------------------------------------------- data hooks */

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.list("admin", "ledger-account"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/accounts")).data!,
    staleTime: 5 * 60_000,
  });
}

export function useFiscalYears() {
  return useQuery({
    queryKey: queryKeys.list("admin", "fiscal-year"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/fiscal-years")).data!,
    staleTime: 60_000,
  });
}

export function useCostCentres() {
  return useQuery({
    queryKey: queryKeys.list("admin", "cost-centre"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/cost-centres")).data!,
    staleTime: 5 * 60_000,
  });
}

const allPeriods = (years: Schemas["FiscalYearDto"][] | undefined) =>
  (years ?? []).flatMap((year) => year.periods).sort((a, b) => a.startDate.localeCompare(b.startDate));

/** The period a date falls in, and — when that one no longer takes postings — the next open one (§1.4). */
export function postingPeriodOf(years: Schemas["FiscalYearDto"][] | undefined, date: string) {
  const periods = allPeriods(years);
  const own = periods.find((period) => period.startDate <= date && period.endDate >= date) ?? null;
  const lands = own?.status === "open" ? own : (periods.find((p) => p.startDate > date && p.status === "open") ?? null);
  return { own, lands };
}

/** Where a posting dated `date` would go, said before anyone presses post (§1.4, D-033). */
export function PostingPeriodNotice({ date, what }: { date: string; what: string }) {
  const t = useTranslations("finance.ledger.periodNotice");
  const format = useFormat();
  const years = useFiscalYears();
  if (!years.data || !date) return null;
  const { own, lands } = postingPeriodOf(years.data, date);
  if (own?.status === "open") return null;
  if (!lands)
    return (
      <Callout tone="danger" title={t("noneTitle")}>
        {t("noneBody", { what })}
      </Callout>
    );
  return (
    <Callout
      tone="warning"
      title={t("movedTitle", { status: own ? t(`statuses.${own.status}`) : t("statuses.missing") })}
    >
      {t("movedBody", {
        what,
        month: format.date(lands.startDate, { style: "month" }),
        date: format.date(date),
      })}
    </Callout>
  );
}

/* ---------------------------------------------------------------------------------------- nav */

export function LedgerNav() {
  const t = useTranslations("finance.ledger.nav");
  return (
    <SectionNav
      label={t("label")}
      items={[
        { href: "/finance/ledger/journals", label: t("journals") },
        { href: "/finance/ledger/accounts", label: t("accounts") },
        { href: "/finance/ledger/rules", label: t("rules") },
        { href: "/finance/ledger/recurring", label: t("recurring") },
        { href: "/finance/ledger/periods", label: t("periods") },
        { href: "/finance/ledger/dimensions", label: t("dimensions") },
      ]}
    />
  );
}

/* --------------------------------------------------------------------------- account picker */

/** One postable, active account from the chart (§3); control accounts only when `allowControl`. */
export function AccountPicker({
  value,
  onChange,
  accounts,
  allowControl = false,
  label,
  filter,
}: {
  value: string;
  onChange: (code: string) => void;
  accounts: readonly Account[];
  allowControl?: boolean;
  label: string;
  filter?: (account: Account) => boolean;
}) {
  const t = useTranslations("finance.ledger.accountPicker");
  const [query, setQuery] = useState("");
  const usable = accounts.filter(
    (account) =>
      account.isPostable &&
      account.status === "active" &&
      (allowControl || !account.isControl) &&
      (!filter || filter(account)),
  );
  const toOption = (account: Account): ComboboxOption => ({
    value: account.code,
    label: `${account.code} ${account.nameTh}`,
    description: account.nameEn,
  });
  const needle = query.trim().toLowerCase();
  const options = usable
    .filter(
      (account) => !needle || `${account.code} ${account.nameTh} ${account.nameEn}`.toLowerCase().includes(needle),
    )
    .slice(0, 30)
    .map(toOption);
  const chosen = accounts.find((account) => account.code === value);
  return (
    <Combobox
      aria-label={label}
      value={chosen ? toOption(chosen) : null}
      onValueChange={(option) => onChange(option?.value ?? "")}
      query={query}
      onQueryChange={setQuery}
      options={options}
      placeholder={t("placeholder")}
      labels={{ loading: t("loading"), empty: t("empty"), clear: t("clear") }}
    />
  );
}

/* ---------------------------------------------------------------------------- lines editor */

export interface DraftLine {
  key: string;
  accountCode: string;
  side: "debit" | "credit";
  amount: string;
  description: string;
  costCentre: string;
}

export const blankLine = (side: DraftLine["side"] = "debit"): DraftLine => ({
  key: crypto.randomUUID(),
  accountCode: "",
  side,
  amount: "",
  description: "",
  costCentre: "",
});

export const toDraftLines = (lines: readonly LineInput[]): DraftLine[] =>
  lines.map((line) => ({
    key: crypto.randomUUID(),
    accountCode: line.accountCode,
    side: line.side,
    amount: line.amount,
    description: line.description ?? "",
    costCentre: line.dimensions?.costCentre ?? "",
  }));

export const toLineInputs = (lines: readonly DraftLine[]): LineInput[] =>
  lines.map((line) => ({
    accountCode: line.accountCode,
    side: line.side,
    amount: line.amount.trim(),
    ...(line.description.trim() ? { description: line.description.trim() } : {}),
    ...(line.costCentre ? { dimensions: { costCentre: line.costCentre } } : {}),
  }));

/**
 * The lines of a manual or recurring journal. The screen adds nothing up: whether debits equal
 * credits is the API's answer (`ledger.unbalanced`), shown against the lines it names.
 */
export function JournalLinesEditor({
  lines,
  onChange,
  errors,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("finance.ledger.lines");
  const accounts = useAccounts();
  const costCentres = useCostCentres();
  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => {
          const account = accounts.data?.find((item) => item.code === line.accountCode);
          const needsCostCentre = account?.requiredDimensions.includes("cost_centre");
          return (
            <li
              key={line.key}
              className="border-border rounded-md border p-3"
              aria-label={t("line", { no: index + 1 })}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(14rem,2fr)_8rem_10rem_minmax(10rem,1fr)_auto] md:items-end">
                <Field label={t("account")} error={errors[`lines[${index}].accountCode`]}>
                  <AccountPicker
                    label={t("accountOf", { no: index + 1 })}
                    value={line.accountCode}
                    onChange={(accountCode) => update(line.key, { accountCode })}
                    accounts={accounts.data ?? []}
                  />
                </Field>
                <Field label={t("side")}>
                  <Select<DraftLine["side"]>
                    aria-label={t("sideOf", { no: index + 1 })}
                    value={line.side}
                    onValueChange={(side) => update(line.key, { side })}
                    options={[
                      { value: "debit", label: t("debit") },
                      { value: "credit", label: t("credit") },
                    ]}
                  />
                </Field>
                <Field label={t("amount")} error={errors[`lines[${index}].amount`]}>
                  <Input
                    aria-label={t("amountOf", { no: index + 1 })}
                    inputMode="decimal"
                    placeholder={t("amountPlaceholder")}
                    value={line.amount}
                    onChange={(event) => update(line.key, { amount: event.target.value })}
                    className="text-end tabular-nums"
                  />
                </Field>
                <Field label={t("description")}>
                  <Input
                    value={line.description}
                    onChange={(event) => update(line.key, { description: event.target.value })}
                  />
                </Field>
                <IconButton
                  name="trash"
                  label={t("remove", { no: index + 1 })}
                  variant="ghost"
                  disabled={lines.length <= 2}
                  onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                />
              </div>
              <div className="mt-2 grid gap-3 md:grid-cols-[minmax(14rem,2fr)_1fr]">
                <Field
                  label={t("costCentre")}
                  hint={needsCostCentre ? t("costCentreRequired") : undefined}
                  error={errors[`lines[${index}].dimensions`]}
                >
                  <Select
                    aria-label={t("costCentreOf", { no: index + 1 })}
                    value={line.costCentre || "none"}
                    onValueChange={(value) => update(line.key, { costCentre: value === "none" ? "" : value })}
                    options={[
                      { value: "none", label: t("noCostCentre") },
                      ...(costCentres.data ?? [])
                        .filter((item) => item.status === "active")
                        .map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` })),
                    ]}
                  />
                </Field>
                {account?.isControl ? <p className="text-danger self-end text-sm">{t("controlAccount")}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div>
        <Button variant="secondary" size="sm" iconStart="plus" onClick={() => onChange([...lines, blankLine()])}>
          {t("add")}
        </Button>
      </div>
      {errors.lines ? (
        <Callout tone="danger" title={t("unbalancedTitle")}>
          {errors.lines}
        </Callout>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------- journal editor */

/**
 * A manual journal (§1.1: the exception, with maker-checker §8). The maker saves a draft — the
 * API checks the accounts, the dimensions and the balance — and submits it; a Finance Manager
 * other than the maker approves, and only then is it posted, with a JV number.
 */
export function JournalEditor({ journalId }: { journalId?: string }) {
  const t = useTranslations("finance.ledger.editor");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: queryKeys.detail("admin", "journal-draft", journalId ?? "new"),
    queryFn: async () => {
      const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/ledger/journals/{journalId}", {
        params: { path: { journalId: journalId! } },
      });
      return { journal: data!, etag: response.headers.get("etag") ?? "" };
    },
    enabled: Boolean(journalId),
    staleTime: 0,
  });
  const [form, setForm] = useState<{
    documentDate: string;
    description: string;
    autoReverse: boolean;
    autoReverseOn: string;
    lines: DraftLine[];
  } | null>(
    journalId
      ? null
      : {
          documentDate: bangkokToday(),
          description: "",
          autoReverse: false,
          autoReverseOn: "",
          lines: [blankLine("debit"), blankLine("credit")],
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (existing.isError) return <QueryError error={existing.error} onRetry={() => void existing.refetch()} />;
  if (journalId && existing.data && !form) {
    const journal = existing.data.journal;
    setForm({
      documentDate: journal.documentDate,
      description: journal.description,
      autoReverse: Boolean(journal.autoReverseOn),
      autoReverseOn: journal.autoReverseOn ?? "",
      lines: journal.lines.map((line) => ({
        key: crypto.randomUUID(),
        accountCode: line.accountCode,
        side: line.debit !== "0.00" ? "debit" : "credit",
        amount: line.debit !== "0.00" ? line.debit : line.credit,
        description: line.description ?? "",
        costCentre: line.dimensions.costCentre ?? "",
      })),
    });
  }
  if (!form) return null;
  const editable = !journalId || existing.data?.journal.status === "draft";

  async function save() {
    if (!form) return;
    setBusy(true);
    setErrors({});
    const body: Schemas["ManualJournalDto"] = {
      documentDate: form.documentDate,
      description: form.description.trim(),
      lines: toLineInputs(form.lines),
      ...(form.autoReverse && form.autoReverseOn ? { autoReverseOn: form.autoReverseOn } : {}),
    };
    try {
      const saved = journalId
        ? (
            await adminBrowserApis().contract.PUT("/v1/admin/ledger/journals/{journalId}", {
              params: { path: { journalId }, header: { "If-Match": existing.data?.etag ?? "" } },
              body,
            })
          ).data!
        : (await adminBrowserApis().contract.POST("/v1/admin/ledger/journals", { body })).data!;
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "journal") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "journal-draft") });
      toast.success(t("saved"));
      router.push(journalHref(saved.id));
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={journalId ? t("editTitle") : t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={journalId ? journalHref(journalId) : "/finance/ledger/journals"}>
                {tCommon("actions.cancel")}
              </Link>
            </Button>
            <Button loading={busy} disabled={!editable} onClick={() => void save()}>
              {t("save")}
            </Button>
          </>
        }
      />
      {!editable ? (
        <Callout tone="warning" title={t("notEditable")}>
          {t("notEditableBody")}
        </Callout>
      ) : null}
      <Section title={t("header")}>
        <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
          <Field
            label={t("documentDate")}
            required
            requiredLabel={tCommon("state.required")}
            error={errors.documentDate}
          >
            <Input
              type="date"
              value={form.documentDate}
              onChange={(event) => setForm({ ...form, documentDate: event.target.value })}
            />
          </Field>
          <Field
            label={t("descriptionLabel")}
            required
            requiredLabel={tCommon("state.required")}
            error={errors.description}
          >
            <Input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <Switch
            label={t("autoReverse")}
            description={t("autoReverseHint")}
            checked={form.autoReverse}
            onCheckedChange={(checked) => setForm({ ...form, autoReverse: checked })}
          />
          {form.autoReverse ? (
            <Field label={t("autoReverseOn")} className="w-48">
              <Input
                type="date"
                value={form.autoReverseOn}
                min={form.documentDate}
                onChange={(event) => setForm({ ...form, autoReverseOn: event.target.value })}
              />
            </Field>
          ) : null}
        </div>
        <div className="mt-3">
          <PostingPeriodNotice date={form.documentDate} what={t("thisEntry")} />
        </div>
      </Section>
      <Section title={t("linesTitle")} description={t("linesNote")}>
        <JournalLinesEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} errors={errors} />
      </Section>
    </div>
  );
}

/* --------------------------------------------------------------------------- journal actions */

/**
 * What can be done with one journal: its maker edits, submits or discards a draft; a posted
 * manual, recurring or closing entry is corrected by a reversal that another person approves.
 * Entries from the sub-ledgers are corrected by their documents (void, credit note), not here.
 */
export function JournalActions({ journal, isMaker }: { journal: Schemas["JournalDto"]; isMaker: boolean }) {
  const t = useTranslations("finance.ledger.actions");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan("ledger.journals.manage");
  const [action, setAction] = useState<"submit" | "discard" | "reverse" | null>(null);
  const [reverseOn, setReverseOn] = useState(bangkokToday);
  const label = journal.entryNo ?? journal.jvNumber ?? t("thisDraft");
  const refresh = () => {
    for (const resource of ["journal", "journal-draft", "approval"])
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", resource) });
  };
  if (!canManage) return null;
  const draft = journal.status === "draft" && isMaker;
  const reversible =
    journal.status === "posted" && !journal.reversedById && !["auto", "reversal"].includes(journal.kind);
  return (
    <>
      {draft ? (
        <>
          <Button variant="ghost" onClick={() => setAction("discard")}>
            {t("discard")}
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`${journalHref(journal.id)}/edit`}>{t("edit")}</Link>
          </Button>
          <Button onClick={() => setAction("submit")}>{t("submit")}</Button>
        </>
      ) : null}
      {reversible ? (
        <Button variant="secondary" iconStart="undo" onClick={() => setAction("reverse")}>
          {t("reverse")}
        </Button>
      ) : null}
      {action === "submit" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("submitTitle")}
          description={t("submitBody", { amount: format.thb(journal.totalDebit) })}
          confirmLabel={t("submit")}
          onConfirm={async ({ idempotencyKey }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/ledger/journals/{journalId}/actions/submit", {
                params: { path: { journalId: journal.id }, header: { "Idempotency-Key": idempotencyKey } },
              });
              refresh();
              toast.success(t("submitted"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        >
          <PostingPeriodNotice date={journal.documentDate} what={t("thisEntry")} />
        </ConfirmAction>
      ) : null}
      {action === "discard" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("discardTitle")}
          description={t("discardBody")}
          confirmLabel={t("discard")}
          tone="destructive"
          onConfirm={async () => {
            try {
              await adminBrowserApis().contract.DELETE("/v1/admin/ledger/journals/{journalId}", {
                params: { path: { journalId: journal.id } },
              });
              refresh();
              toast.success(t("discarded"));
              router.push("/finance/ledger/journals");
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
      {action === "reverse" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("reverseTitle", { entry: label })}
          description={t("reverseBody", { entry: label, amount: format.thb(journal.totalDebit) })}
          confirmLabel={t("reverse")}
          confirmationPhrase={journal.entryNo ?? undefined}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/ledger/journals/{journalId}/actions/reverse",
                {
                  params: { path: { journalId: journal.id }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { documentDate: reverseOn, reason },
                },
              );
              refresh();
              toast.success(t("reversalRequested"));
              router.push(journalHref(data!.id));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        >
          <Field label={t("reverseOn")}>
            <Input
              type="date"
              value={reverseOn}
              onChange={(event) => setReverseOn(event.target.value || bangkokToday())}
            />
          </Field>
          <PostingPeriodNotice date={reverseOn} what={t("theReversal")} />
        </ConfirmAction>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------ chart of accounts */

/**
 * The chart of accounts (§3). Changes are proposals: a Finance Manager other than the proposer
 * approves each (policy `coa_change`, D-169); an account with a balance is never deactivated.
 */
export function AccountsView() {
  const t = useTranslations("finance.ledger.accounts");
  const canPropose = useCan("ledger.config.propose");
  const accounts = useAccounts();
  const changes = useQuery({
    queryKey: queryKeys.list("admin", "account-change"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/account-changes", {})).data!,
  });
  const [proposing, setProposing] = useState<{ kind: Schemas["AccountChangeKind"]; account?: Account } | null>(null);
  const [q, setQ] = useState("");
  if (accounts.isError) return <QueryError error={accounts.error} onRetry={() => void accounts.refetch()} />;
  const needle = q.trim().toLowerCase();
  const rows = (accounts.data ?? []).filter(
    (account) => !needle || `${account.code} ${account.nameTh} ${account.nameEn}`.toLowerCase().includes(needle),
  );
  const columns: DataTableColumn<Account>[] = [
    {
      id: "code",
      header: t("code"),
      cell: (row) => (
        <Link
          href={`/finance/ledger/journals?accountCode=${row.code}`}
          className={row.parentCode ? "text-primary ps-4 font-mono hover:underline" : "font-mono font-semibold"}
        >
          {row.code}
        </Link>
      ),
    },
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <div className={row.parentCode ? "ps-4" : "font-semibold"}>
          {row.nameTh}
          <p className="text-muted text-xs">{row.nameEn}</p>
        </div>
      ),
    },
    { id: "type", header: t("type"), cell: (row) => t(`types.${row.accountType}`) },
    { id: "side", header: t("normalSide"), hideable: true, cell: (row) => t(`sides.${row.normalSide}`) },
    { id: "cashFlow", header: t("cashFlow"), hideable: true, cell: (row) => t(`cashFlows.${row.cashFlowClass}`) },
    {
      id: "flags",
      header: t("flags"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {!row.isPostable ? (
            <Badge tone="neutral" size="sm">
              {t("heading")}
            </Badge>
          ) : null}
          {row.isControl ? (
            <Badge tone="info" size="sm">
              {t("control")}
            </Badge>
          ) : null}
          {row.status === "inactive" ? (
            <Badge tone="warning" size="sm">
              {t("inactive")}
            </Badge>
          ) : null}
          {row.requiredDimensions.map((dimension) => (
            <Badge key={dimension} tone="neutral" size="sm">
              {t("requires", { dimension: t(`dimensions.${dimension}`) })}
            </Badge>
          ))}
        </span>
      ),
    },
    ...(canPropose
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Account) =>
              row.isPostable ? (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setProposing({ kind: "update", account: row })}>
                    {t("change")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setProposing({ kind: row.status === "active" ? "deactivate" : "reactivate", account: row })
                    }
                  >
                    {row.status === "active" ? t("deactivate") : t("reactivate")}
                  </Button>
                </span>
              ) : null,
          } satisfies DataTableColumn<Account>,
        ]
      : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      <Section
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={t("search")}
              placeholder={t("search")}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="w-56"
            />
            {canPropose ? (
              <Button size="sm" iconStart="plus" onClick={() => setProposing({ kind: "create" })}>
                {t("new")}
              </Button>
            ) : null}
          </div>
        }
      >
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={rows}
          loading={accounts.isPending}
          getRowId={(row) => row.code}
          density="compact"
          rowTone={(row) => (row.status === "inactive" ? "warning" : undefined)}
        />
      </Section>
      <Section title={t("changes")} description={t("changesNote")}>
        <DataTable
          caption={t("changes")}
          rows={changes.data ?? []}
          loading={changes.isPending}
          getRowId={(row) => row.id}
          density="compact"
          empty={<EmptyState icon="settings" title={t("noChanges")} />}
          columns={[
            { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
            {
              id: "account",
              header: t("code"),
              cell: (row) => <span className="font-mono">{row.accountCode ?? row.proposed.code}</span>,
            },
            { id: "reason", header: t("reason"), cell: (row) => row.reason },
            { id: "at", header: t("proposedAt"), cell: (row) => <When at={row.createdAt} /> },
            {
              id: "status",
              header: t("status"),
              cell: (row) => (
                <span className="flex items-center gap-2">
                  <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />
                  {row.approvalRequestId && row.status === "proposed" ? (
                    <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary text-sm hover:underline">
                      {t("openApproval")}
                    </Link>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </Section>
      {proposing ? (
        <ProposeAccountChange
          kind={proposing.kind}
          account={proposing.account}
          accounts={accounts.data ?? []}
          onClose={() => setProposing(null)}
        />
      ) : null}
    </div>
  );
}

const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cost_of_sales",
  "expense",
] as const satisfies readonly Schemas["AccountType"][];
const CASH_FLOWS = [
  "cash",
  "operating",
  "investing",
  "financing",
  "non_cash",
] as const satisfies readonly Schemas["CashFlowClass"][];

function ProposeAccountChange({
  kind,
  account,
  accounts,
  onClose,
}: {
  kind: Schemas["AccountChangeKind"];
  account?: Account;
  accounts: readonly Account[];
  onClose: () => void;
}) {
  const t = useTranslations("finance.ledger.accounts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({
    code: "",
    nameTh: account?.nameTh ?? "",
    nameEn: account?.nameEn ?? "",
    accountType: (account?.accountType ?? "expense") as Schemas["AccountType"],
    cashFlowClass: (account?.cashFlowClass ?? "operating") as Schemas["CashFlowClass"],
    normalSide: (account?.normalSide ?? "debit") as Schemas["LedgerSide"],
    parentCode: account?.parentCode ?? "",
    requiredDimensions: [...(account?.requiredDimensions ?? [])] as Schemas["LedgerDimension"][],
  });
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headings = accounts.filter((item) => !item.isPostable);
  const edits = kind === "create" || kind === "update";
  return (
    <FormDialog
      title={t(`proposeTitles.${kind}`, { code: account?.code ?? "" })}
      description={t("proposeNote")}
      submitLabel={t("propose")}
      onClose={onClose}
      onSubmit={async () => {
        if (reason.trim().length < 3) throw new FormError(t("reasonShort"));
        try {
          await adminBrowserApis().contract.POST("/v1/admin/ledger/account-changes", {
            body: {
              kind,
              reason: reason.trim(),
              ...(kind === "create" ? {} : { accountCode: account!.code }),
              ...(edits
                ? {
                    fields: {
                      ...(kind === "create"
                        ? {
                            code: fields.code.trim(),
                            accountType: fields.accountType,
                            cashFlowClass: fields.cashFlowClass,
                            normalSide: fields.normalSide,
                            parentCode: fields.parentCode || null,
                          }
                        : {}),
                      nameTh: fields.nameTh.trim(),
                      nameEn: fields.nameEn.trim(),
                      requiredDimensions: fields.requiredDimensions,
                    },
                  }
                : {}),
            },
          });
        } catch (error) {
          setErrors(fieldErrorsOf(error));
          throw error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "account-change") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
        toast.success(t("proposed"));
      }}
    >
      {kind === "create" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("code")} required requiredLabel={tCommon("state.required")} error={errors["fields.code"]}>
            <Input
              value={fields.code}
              onChange={(event) => setFields({ ...fields, code: event.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label={t("parent")}>
            <Select
              value={fields.parentCode || undefined}
              onValueChange={(parentCode) => setFields({ ...fields, parentCode })}
              placeholder={t("pickParent")}
              options={headings.map((item) => ({ value: item.code, label: `${item.code} ${item.nameTh}` }))}
            />
          </Field>
          <Field label={t("type")}>
            <Select<Schemas["AccountType"]>
              value={fields.accountType}
              onValueChange={(accountType) => setFields({ ...fields, accountType })}
              options={ACCOUNT_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))}
            />
          </Field>
          <Field label={t("normalSide")}>
            <Select<Schemas["LedgerSide"]>
              value={fields.normalSide}
              onValueChange={(normalSide) => setFields({ ...fields, normalSide })}
              options={[
                { value: "debit", label: t("sides.debit") },
                { value: "credit", label: t("sides.credit") },
              ]}
            />
          </Field>
          <Field label={t("cashFlow")}>
            <Select<Schemas["CashFlowClass"]>
              value={fields.cashFlowClass}
              onValueChange={(cashFlowClass) => setFields({ ...fields, cashFlowClass })}
              options={CASH_FLOWS.map((value) => ({ value, label: t(`cashFlows.${value}`) }))}
            />
          </Field>
        </div>
      ) : null}
      {edits ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("nameTh")} required requiredLabel={tCommon("state.required")}>
              <Input value={fields.nameTh} onChange={(event) => setFields({ ...fields, nameTh: event.target.value })} />
            </Field>
            <Field label={t("nameEn")}>
              <Input value={fields.nameEn} onChange={(event) => setFields({ ...fields, nameEn: event.target.value })} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t("requiredDimensions")}</legend>
            <div className="grid gap-1 sm:grid-cols-3">
              {LEDGER_DIMENSIONS.map((dimension) => (
                <Checkbox
                  key={dimension}
                  label={t(`dimensions.${dimension}`)}
                  checked={fields.requiredDimensions.includes(dimension)}
                  onCheckedChange={(checked) =>
                    setFields({
                      ...fields,
                      requiredDimensions: checked
                        ? [...fields.requiredDimensions, dimension]
                        : fields.requiredDimensions.filter((item) => item !== dimension),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {kind === "deactivate" ? (
        <Callout tone="warning" title={t("deactivateTitle")}>
          {t("deactivateBody")}
        </Callout>
      ) : null}
      <Field label={t("reason")} required requiredLabel={tCommon("state.required")} error={errors.reason}>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ---------------------------------------------------------------------------- posting rules */

const inForce = (rule: Rule) => rule.versions.filter((version) => version.status === "approved").at(-1);

/** The posting rules (§5, ADR-0007): what every event posts, each change a dated version. */
export function PostingRulesList() {
  const t = useTranslations("finance.ledger.rules");
  const rules = useQuery({
    queryKey: queryKeys.list("admin", "posting-rule"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/posting-rules")).data!,
  });
  if (rules.isError) return <QueryError error={rules.error} onRetry={() => void rules.refetch()} />;
  return (
    <Section title={t("title")} description={t("description")}>
      <DataTable
        caption={t("title")}
        rows={rules.data ?? []}
        loading={rules.isPending}
        getRowId={(row) => row.key}
        density="compact"
        columns={[
          {
            id: "key",
            header: t("key"),
            cell: (row) => (
              <Link href={`/finance/ledger/rules/${row.key}`} className="text-primary font-mono hover:underline">
                {row.key}
              </Link>
            ),
          },
          { id: "name", header: t("name"), cell: (row) => row.name },
          {
            id: "event",
            header: t("event"),
            hideable: true,
            cell: (row) => <code className="text-xs">{row.eventType}</code>,
          },
          {
            id: "version",
            header: t("version"),
            numeric: true,
            cell: (row) => t("versionNo", { no: inForce(row)?.versionNo ?? 0 }),
          },
          {
            id: "pending",
            header: t("pending"),
            cell: (row) =>
              row.versions.some((version) => version.status === "proposed") ? (
                <StatusChip map={SETTING_VERSION_STATUS} value="proposed" />
              ) : null,
          },
          { id: "decisions", header: t("decisions"), hideable: true, cell: (row) => row.decisionRefs.join(", ") },
        ]}
      />
    </Section>
  );
}

/** A sample payload from a template: each amount path gets 1,000.00, each switch its first case. */
function samplePayload(template: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (path: string, value: unknown) => {
    const parts = path.split(".");
    let node = out;
    for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
    node[parts.at(-1)!] = value;
  };
  const lines = (template.lines as { account?: unknown; amount?: unknown; taxBase?: unknown }[] | undefined) ?? [];
  for (const line of lines) {
    if (typeof line.amount === "string" && /^[a-zA-Z.]+$/.test(line.amount)) set(line.amount, "1000.00");
    if (typeof line.taxBase === "string" && /^[a-zA-Z.]+$/.test(line.taxBase)) set(line.taxBase, "1000.00");
    const selector = line.account as { path?: string; switch?: string; cases?: Record<string, unknown> } | undefined;
    if (selector && typeof selector === "object") {
      if (selector.path) set(selector.path, "1121");
      if (selector.switch) set(selector.switch, Object.keys(selector.cases ?? {})[0] ?? "");
    }
  }
  return out;
}

/** One rule: its versions, the template in force, a dry run on a sample event, a new version. */
export function PostingRuleDetail({ ruleKey }: { ruleKey: string }) {
  const t = useTranslations("finance.ledger.rules");
  const format = useFormat();
  const canPropose = useCan("ledger.config.propose");
  const rule = useQuery({
    queryKey: queryKeys.detail("admin", "posting-rule", ruleKey),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/ledger/posting-rules/{key}", {
          params: { path: { key: ruleKey } },
        })
      ).data!,
  });
  const [payload, setPayload] = useState<string | null>(null);
  const [preview, setPreview] = useState<Schemas["RulePreviewDto"] | null>(null);
  const [proposing, setProposing] = useState(false);
  if (rule.isError) return <QueryError error={rule.error} onRetry={() => void rule.refetch()} />;
  const data = rule.data;
  if (!data) return null;
  const current = inForce(data);
  const text = payload ?? JSON.stringify(samplePayload((current?.template ?? {}) as Record<string, unknown>), null, 2);

  async function run() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      toast.error(t("badJson"));
      return;
    }
    try {
      const { data: result } = await adminBrowserApis().contract.POST(
        "/v1/admin/ledger/posting-rules/{key}/actions/preview",
        {
          params: { path: { key: ruleKey } },
          body: { payload: parsed },
        },
      );
      setPreview(result!);
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("detailTitle", { key: data.key, name: data.name })}
        description={data.description}
        meta={<code className="text-muted text-xs">{data.eventType}</code>}
        actions={
          canPropose ? (
            <Button
              disabled={data.versions.some((version) => version.status === "proposed")}
              onClick={() => setProposing(true)}
            >
              {t("proposeVersion")}
            </Button>
          ) : null
        }
      />
      <Section title={t("versions")}>
        <DataTable
          caption={t("versions")}
          rows={[...data.versions].reverse()}
          getRowId={(row) => row.id}
          density="compact"
          columns={[
            { id: "no", header: t("version"), numeric: true, cell: (row) => t("versionNo", { no: row.versionNo }) },
            { id: "from", header: t("effectiveFrom"), cell: (row) => <When at={row.effectiveFrom} absoluteOnly /> },
            { id: "reason", header: t("reason"), cell: (row) => row.reason },
            {
              id: "status",
              header: t("status"),
              cell: (row) => (
                <span className="flex items-center gap-2">
                  <StatusChip map={SETTING_VERSION_STATUS} value={row.status} />
                  {row.approvalRequestId && row.status === "proposed" ? (
                    <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary text-sm hover:underline">
                      {t("openApproval")}
                    </Link>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={t("template")} description={t("templateNote")}>
          <JsonView value={current?.template ?? {}} label={t("template")} />
          {current?.conditions ? (
            <div className="mt-3">
              <p className="mb-1 text-sm font-medium">{t("conditions")}</p>
              <JsonView value={current.conditions} label={t("conditions")} />
            </div>
          ) : null}
        </Section>
        <Section title={t("preview")} description={t("previewNote")}>
          <Field label={t("payload")}>
            <Textarea
              value={text}
              onChange={(event) => setPayload(event.target.value)}
              rows={8}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </Field>
          <div className="mt-2">
            <Button variant="secondary" iconStart="play" onClick={() => void run()}>
              {t("runPreview")}
            </Button>
          </div>
          {preview ? (
            <div className="mt-3 flex flex-col gap-2">
              <Callout
                tone={preview.balanced ? "success" : "danger"}
                title={preview.balanced ? t("balanced") : t("unbalanced")}
              >
                {preview.applies ? preview.description : t("notApplies")}
              </Callout>
              <DataTable
                caption={t("previewLines")}
                rows={preview.lines}
                getRowId={(row) => `${row.accountCode}-${row.side}-${row.amount}`}
                density="compact"
                columns={[
                  {
                    id: "account",
                    header: t("account"),
                    cell: (row) => <span className="font-mono">{row.accountCode}</span>,
                  },
                  { id: "tax", header: t("tax"), cell: (row) => row.taxCode ?? "" },
                  {
                    id: "debit",
                    header: t("debit"),
                    numeric: true,
                    cell: (row) => (row.side === "debit" ? format.thb(row.amount) : ""),
                  },
                  {
                    id: "credit",
                    header: t("credit"),
                    numeric: true,
                    cell: (row) => (row.side === "credit" ? format.thb(row.amount) : ""),
                  },
                ]}
              />
              <p className="text-muted text-end text-sm tabular-nums">
                {t("previewTotals", { debit: format.thb(preview.totalDebit), credit: format.thb(preview.totalCredit) })}
              </p>
            </div>
          ) : null}
        </Section>
      </div>
      {proposing ? <ProposeRuleVersion rule={data} onClose={() => setProposing(false)} /> : null}
    </div>
  );
}

function ProposeRuleVersion({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const t = useTranslations("finance.ledger.rules");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const current = inForce(rule);
  const [template, setTemplate] = useState(JSON.stringify(current?.template ?? {}, null, 2));
  const [effectiveFrom, setEffectiveFrom] = useState(bangkokToday);
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      title={t("proposeTitle", { key: rule.key })}
      description={t("proposeNote")}
      submitLabel={t("propose")}
      onClose={onClose}
      onSubmit={async () => {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(template) as Record<string, unknown>;
        } catch {
          throw new FormError(t("badJson"));
        }
        if (reason.trim().length < 3) throw new FormError(t("reasonShort"));
        await adminBrowserApis().contract.POST("/v1/admin/ledger/posting-rules/{key}/versions", {
          params: { path: { key: rule.key } },
          body: { template: parsed, effectiveFrom: effectiveInstant(effectiveFrom), reason: reason.trim() },
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "posting-rule") });
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
        toast.success(t("proposed"));
      }}
    >
      <Field label={t("template")}>
        <Textarea
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          rows={12}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      <Field label={t("effectiveFrom")} required requiredLabel={tCommon("state.required")} hint={t("effectiveHint")}>
        <Input
          type="date"
          value={effectiveFrom}
          min={bangkokToday()}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </Field>
      <Field label={t("reason")} required requiredLabel={tCommon("state.required")}>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------------ recurring journals */

/** Recurring journals (§8): approved once by a Finance Manager, then posted every month. */
export function RecurringJournals() {
  const t = useTranslations("finance.ledger.recurring");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("ledger.journals.manage");
  const canRun = useCan("ledger.periods.manage");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<{ item: Recurring; action: Schemas["RecurringJournalAction"] } | null>(null);
  const items = useQuery({
    queryKey: queryKeys.list("admin", "recurring-journal"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/ledger/recurring-journals")).data!,
  });
  if (items.isError) return <QueryError error={items.error} onRetry={() => void items.refetch()} />;
  return (
    <>
      <Section
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
              {t("new")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("title")}
          rows={items.data ?? []}
          loading={items.isPending}
          getRowId={(row) => row.id}
          density="compact"
          empty={<EmptyState icon="calendar" title={t("empty")} />}
          columns={[
            {
              id: "name",
              header: t("name"),
              cell: (row) => (
                <div>
                  {row.name}
                  <p className="text-muted text-xs">{row.description}</p>
                </div>
              ),
            },
            { id: "day", header: t("day"), numeric: true, cell: (row) => t("dayOf", { day: row.dayOfMonth }) },
            { id: "next", header: t("nextRun"), cell: (row) => format.date(row.nextRunOn) },
            { id: "reverse", header: t("autoReverse"), cell: (row) => (row.autoReverse ? t("yes") : t("no")) },
            {
              id: "lines",
              header: t("lines"),
              cell: (row) => (
                <ul className="text-xs">
                  {row.lines.map((line, index) => (
                    <li key={index} className="tabular-nums">
                      <span className="font-mono">{line.accountCode}</span> {t(`sides.${line.side}`)}{" "}
                      {format.thb(line.amount)}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: "status",
              header: t("status"),
              cell: (row) => (
                <span className="flex items-center gap-2">
                  <StatusChip map={RECURRING_JOURNAL_STATUS} value={row.status} />
                  {row.status === "pending_approval" && row.approvalRequestId ? (
                    <Link href={`/approvals/${row.approvalRequestId}`} className="text-primary text-sm hover:underline">
                      {t("openApproval")}
                    </Link>
                  ) : null}
                </span>
              ),
            },
            ...(canRun
              ? [
                  {
                    id: "actions",
                    header: t("actions"),
                    cell: (row: Recurring) => (
                      <span className="flex gap-1">
                        {row.status === "active" ? (
                          <Button size="sm" variant="ghost" onClick={() => setActing({ item: row, action: "pause" })}>
                            {t("pause")}
                          </Button>
                        ) : null}
                        {row.status === "paused" ? (
                          <Button size="sm" variant="ghost" onClick={() => setActing({ item: row, action: "resume" })}>
                            {t("resume")}
                          </Button>
                        ) : null}
                        {["active", "paused"].includes(row.status) ? (
                          <Button size="sm" variant="ghost" onClick={() => setActing({ item: row, action: "end" })}>
                            {t("end")}
                          </Button>
                        ) : null}
                      </span>
                    ),
                  } satisfies DataTableColumn<Recurring>,
                ]
              : []),
          ]}
        />
      </Section>
      {creating ? <NewRecurring onClose={() => setCreating(false)} /> : null}
      {acting ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setActing(null))}
          title={t(`${acting.action}Title`, { name: acting.item.name })}
          description={t(`${acting.action}Body`)}
          confirmLabel={t(acting.action)}
          tone={acting.action === "end" ? "destructive" : "primary"}
          onConfirm={async () => {
            try {
              await adminBrowserApis().contract.POST(
                "/v1/admin/ledger/recurring-journals/{recurringId}/actions/{action}",
                {
                  params: { path: { recurringId: acting.item.id, action: acting.action } },
                },
              );
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "recurring-journal") });
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "journal") });
              toast.success(t("updated"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </>
  );
}

function NewRecurring({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.ledger.recurring");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    dayOfMonth: "28",
    startOn: bangkokToday(),
    endOn: "",
    autoReverse: true,
    lines: [blankLine("debit"), blankLine("credit")],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setErrors({});
    try {
      await adminBrowserApis().contract.POST("/v1/admin/ledger/recurring-journals", {
        body: {
          name: form.name.trim(),
          description: form.description.trim() || form.name.trim(),
          dayOfMonth: Number(form.dayOfMonth),
          startOn: form.startOn,
          endOn: form.endOn || null,
          autoReverse: form.autoReverse,
          lines: toLineInputs(form.lines),
        },
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "recurring-journal") });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "approval") });
      toast.success(t("created"));
      onClose();
    } catch (error) {
      setErrors(fieldErrorsOf(error));
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("newTitle")}
      description={t("newNote")}
      closeLabel={tCommon("actions.close")}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void create()}>
            {t("submit")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("name")} required requiredLabel={tCommon("state.required")} error={errors.name}>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={t("descriptionLabel")}>
            <Input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label={t("day")} hint={t("dayHint")} error={errors.dayOfMonth}>
            <Input
              type="number"
              min={1}
              max={28}
              value={form.dayOfMonth}
              onChange={(event) => setForm({ ...form, dayOfMonth: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startOn")}>
              <Input
                type="date"
                value={form.startOn}
                onChange={(event) => setForm({ ...form, startOn: event.target.value })}
              />
            </Field>
            <Field label={t("endOn")}>
              <Input
                type="date"
                value={form.endOn}
                onChange={(event) => setForm({ ...form, endOn: event.target.value })}
              />
            </Field>
          </div>
        </div>
        <Switch
          label={t("autoReverse")}
          description={t("autoReverseHint")}
          checked={form.autoReverse}
          onCheckedChange={(autoReverse) => setForm({ ...form, autoReverse })}
        />
        <JournalLinesEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} errors={errors} />
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------------- periods */

const NEXT_ACTIONS: Record<Period["status"], Schemas["PeriodAction"][]> = {
  open: ["soft-close"],
  soft_closed: ["reopen", "close"],
  closed: ["lock"],
  locked: [],
};

/**
 * The fiscal periods (§1.4): open ⇄ soft-closed → closed → locked, in sequence. Postings dated in
 * a period that is not open go to the next open one with their document date kept. Closing and
 * locking also wait for the month's close checklist (§7).
 */
export function PeriodsView() {
  const t = useTranslations("finance.ledger.periods");
  const format = useFormat();
  const queryClient = useQueryClient();
  const canManage = useCan("ledger.periods.manage");
  const years = useFiscalYears();
  const [acting, setActing] = useState<{ period: Period; action: Schemas["PeriodAction"] } | null>(null);
  if (years.isError) return <QueryError error={years.error} onRetry={() => void years.refetch()} />;
  return (
    <>
      {(years.data ?? []).map((year) => (
        <Section key={year.id} title={t("year", { label: year.label })} description={t("description")}>
          <DataTable
            caption={t("year", { label: year.label })}
            rows={year.periods}
            getRowId={(row) => row.id}
            density="compact"
            columns={[
              { id: "no", header: t("no"), numeric: true, cell: (row) => row.periodNo },
              { id: "month", header: t("month"), cell: (row) => format.date(row.startDate, { style: "month" }) },
              {
                id: "status",
                header: t("status"),
                cell: (row) => <StatusChip map={PERIOD_STATUS} value={row.status} />,
              },
              { id: "changed", header: t("changedAt"), cell: (row) => <When at={row.statusChangedAt} absoluteOnly /> },
              {
                id: "close",
                header: t("checklist"),
                cell: (row) =>
                  row.startDate <= bangkokToday() ? (
                    <Link
                      href={`/finance/close/${row.startDate.slice(0, 7)}`}
                      className="text-primary text-sm hover:underline"
                    >
                      {t("openChecklist")}
                    </Link>
                  ) : null,
              },
              ...(canManage
                ? [
                    {
                      id: "actions",
                      header: t("actions"),
                      cell: (row: Period) => (
                        <span className="flex gap-1">
                          {NEXT_ACTIONS[row.status].map((action) => (
                            <Button
                              key={action}
                              size="sm"
                              variant="ghost"
                              onClick={() => setActing({ period: row, action })}
                            >
                              {t(`actionNames.${action}`)}
                            </Button>
                          ))}
                        </span>
                      ),
                    } satisfies DataTableColumn<Period>,
                  ]
                : []),
            ]}
          />
        </Section>
      ))}
      {acting ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setActing(null))}
          title={t("confirmTitle", {
            action: t(`actionNames.${acting.action}`),
            month: format.date(acting.period.startDate, { style: "month" }),
          })}
          description={t(`actionBodies.${acting.action}`)}
          confirmLabel={t(`actionNames.${acting.action}`)}
          tone={acting.action === "lock" ? "destructive" : "primary"}
          confirmationPhrase={
            ["close", "lock"].includes(acting.action) ? acting.period.startDate.slice(0, 7) : undefined
          }
          reason={acting.action === "reopen" ? { label: t("reason"), required: true, minLength: 3 } : undefined}
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/ledger/periods/{periodId}/actions/{action}", {
                params: { path: { periodId: acting.period.id, action: acting.action } },
                body: reason ? { reason } : {},
              });
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "fiscal-year") });
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "close-checklist") });
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------------------- dimensions */

/**
 * Analysis dimensions (§3): what each journal line may carry — order, customer, factory, product
 * type, channel, campaign, cost centre — and the cost centres Finance keeps.
 */
export function DimensionsView() {
  const t = useTranslations("finance.ledger.dimensionsView");
  const tAccounts = useTranslations("finance.ledger.accounts");
  const queryClient = useQueryClient();
  const canPropose = useCan("ledger.config.propose");
  const accounts = useAccounts();
  const costCentres = useCostCentres();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title={t("title")} description={t("description")}>
        <DataTable
          caption={t("title")}
          rows={LEDGER_DIMENSIONS.map((dimension) => ({ dimension }))}
          getRowId={(row) => row.dimension}
          density="compact"
          columns={[
            { id: "dimension", header: t("dimension"), cell: (row) => tAccounts(`dimensions.${row.dimension}`) },
            {
              id: "required",
              header: t("requiredBy"),
              cell: (row) => (
                <span className="font-mono text-xs">
                  {(accounts.data ?? [])
                    .filter((account) => account.requiredDimensions.includes(row.dimension))
                    .map((account) => account.code)
                    .join(", ") || "—"}
                </span>
              ),
            },
          ]}
        />
      </Section>
      <Section
        title={t("costCentres")}
        description={t("costCentresNote")}
        actions={
          canPropose ? (
            <Button size="sm" iconStart="plus" onClick={() => setCreating(true)}>
              {t("newCostCentre")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("costCentres")}
          rows={costCentres.data ?? []}
          loading={costCentres.isPending}
          getRowId={(row) => row.id}
          density="compact"
          columns={[
            { id: "code", header: t("code"), cell: (row) => <span className="font-mono">{row.code}</span> },
            { id: "name", header: t("name"), cell: (row) => row.name },
            {
              id: "status",
              header: t("status"),
              cell: (row) => (
                <Badge tone={row.status === "active" ? "success" : "neutral"} size="sm">
                  {t(`statuses.${row.status}`)}
                </Badge>
              ),
            },
            {
              id: "journals",
              header: t("journals"),
              cell: (row) => (
                <Link href={`/finance/ledger/journals?q=${row.code}`} className="text-primary text-sm hover:underline">
                  {t("openJournals")}
                </Link>
              ),
            },
          ]}
        />
      </Section>
      {creating ? (
        <FormDialog
          title={t("newCostCentre")}
          submitLabel={t("create")}
          onClose={() => setCreating(false)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/ledger/cost-centres", {
              body: { code: code.trim().toUpperCase(), name: name.trim() },
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "cost-centre") });
            toast.success(t("created"));
          }}
        >
          <Field label={t("code")} hint={t("codeHint")}>
            <Input value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field label={t("name")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
