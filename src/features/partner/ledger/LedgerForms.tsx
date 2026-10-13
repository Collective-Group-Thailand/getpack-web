"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber } from "@/features/partner/erp/format";
import { erpPost, erpSave } from "@/features/partner/sales/api";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

type Journal = Schemas["ErpGlJournalDto"];
type Recurring = Schemas["ErpGlRecurringDto"];
type Settings = Schemas["ErpGlSettingsDto"];
type Filing = Schemas["ErpGlTaxFilingDto"];
type Account = Schemas["ErpGlAccountDto"];
export type AccountOption = { id: string; label: string; hint?: string | null; control?: boolean };

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_CODE = /^[0-9A-Z][0-9A-Z.-]*$/;
export const todayInBangkok = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Satang from a decimal string ("1,234.5" → 123450n) — sums for the balance hint without floats. */
export function satang(value: string): bigint | null {
  const v = plainNumber(value);
  if (!MONEY.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  return BigInt(whole!) * 100n + BigInt((frac + "00").slice(0, 2));
}
const fromSatang = (n: bigint) => {
  const sign = n < 0n ? "-" : "";
  const a = n < 0n ? -n : n;
  return `${sign}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
};

export function useRun(namespace = "partnerLedger.common") {
  const t = useTranslations(namespace);
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  async function run<T>(work: () => Promise<T>, done: string | ((result: T) => string), after: "refresh" | "none" = "refresh"): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await work();
      toast.success(typeof done === "function" ? done(result) : done);
      if (after === "refresh") refresh();
      return result;
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? t("stale") : problemMessage(error, t("failed")));
      if (stale) refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

// ============================================================================================== journal

type Line = { accountCode: string; side: "debit" | "credit"; amount: string; description: string };
const emptyLine = (side: "debit" | "credit"): Line => ({ accountCode: "", side, amount: "", description: "" });

/** D-389: a manual journal — balanced lines on postable accounts; saved as a draft or submitted for approval. */
export function JournalForm({ accounts, journal, etag }: { accounts: AccountOption[]; journal?: Journal; etag?: string | null }) {
  const t = useTranslations("partnerLedger.form");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  const router = useRouter();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [date, setDate] = useState(journal?.documentDate ?? todayInBangkok());
  const [description, setDescription] = useState(journal?.description ?? "");
  const [autoReverseOn, setAutoReverseOn] = useState(journal?.autoReverseOn ?? "");
  const [lines, setLines] = useState<Line[]>(
    journal
      ? journal.lines.map((l) => ({
          accountCode: l.account.code,
          side: l.debit !== "0.00" ? "debit" : "credit",
          amount: l.debit !== "0.00" ? l.debit : l.credit,
          description: l.description ?? "",
        }))
      : [emptyLine("debit"), emptyLine("credit")],
  );
  const control = new Set(accounts.filter((a) => a.control).map((a) => a.id));
  const options = accounts.map((a) => ({ value: a.id, label: a.label, ...(a.control ? { description: t("controlHint"), disabled: true } : {}) }));
  const total = (side: "debit" | "credit") => lines.filter((l) => l.side === side).reduce((s, l) => s + (satang(l.amount) ?? 0n), 0n);
  const debit = total("debit");
  const credit = total("credit");
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function save(submit: boolean) {
    if (!description.trim()) return toast.error(t("needDescription"));
    const ready = lines.filter((l) => l.accountCode || l.amount);
    if (ready.length < 2 || ready.some((l) => !l.accountCode || control.has(l.accountCode) || satang(l.amount) === null || satang(l.amount) === 0n))
      return toast.error(t("needLines"));
    if (!DAY.test(date) || (autoReverseOn && !DAY.test(autoReverseOn))) return toast.error(tc("failed"));
    const body = {
      documentDate: date,
      description: description.trim(),
      autoReverseOn: autoReverseOn || null,
      submit,
      lines: ready.map((l) => ({ accountCode: l.accountCode, side: l.side, amount: fromSatang(satang(l.amount)!), description: l.description.trim() || null })),
    };
    const saved = await run(
      () =>
        journal
          ? erpSave<Journal>("PUT", factoryId, "/ledger/journals/{entryId}", { entryId: journal.id }, body, etag)
          : erpPost<Journal>(factoryId, "/ledger/journals", {}, body),
      t("saved"),
      "none",
    );
    if (saved) router.push(`/ledger/journals/${saved.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[12rem_1fr_12rem]">
        <Field label={t("date")} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("description")} required>
          <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t("autoReverse")} hint={t("autoReverseHint")}>
          <Input type="date" value={autoReverseOn} onChange={(e) => setAutoReverseOn(e.target.value)} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("lines")}</legend>
        {lines.map((line, i) => (
          <div key={i} className="border-border grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(14rem,2fr)_9rem_10rem_minmax(8rem,1fr)_auto] md:items-end md:border-0 md:p-0">
            <Field label={tc("account")} labelHidden={i > 0}>
              <Select value={line.accountCode || null} options={options} placeholder={tc("accountPlaceholder")} onValueChange={(v) => set(i, { accountCode: v })} aria-label={tc("account")} />
            </Field>
            <Field label={t("side")} labelHidden={i > 0}>
              <SegmentedControl
                label={t("side")}
                size="md"
                value={line.side}
                onValueChange={(v) => set(i, { side: v as "debit" | "credit" })}
                options={[
                  { value: "debit", label: tc("debit") },
                  { value: "credit", label: tc("credit") },
                ]}
              />
            </Field>
            <Field label={tc("amount")} labelHidden={i > 0} error={line.amount && satang(line.amount) === null ? tc("invalidAmount") : undefined}>
              <Input inputMode="decimal" value={line.amount} onChange={(e) => set(i, { amount: e.target.value })} className="text-end" />
            </Field>
            <Field label={t("lineDescription")} labelHidden={i > 0}>
              <Input value={line.description} maxLength={300} onChange={(e) => set(i, { description: e.target.value })} />
            </Field>
            <IconButton name="trash" label={t("removeLine")} variant="ghost" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" iconStart="plus" onClick={() => setLines([...lines, emptyLine(debit > credit ? "credit" : "debit")])}>
            {t("addLine")}
          </Button>
          <p className={debit === credit && debit > 0n ? "text-success text-sm font-medium" : "text-warning text-sm font-medium"} aria-live="polite">
            {t("totals", { debit: format.thb(fromSatang(debit)), credit: format.thb(fromSatang(credit)) })} ·{" "}
            {debit === credit && debit > 0n ? t("balanced") : t("unbalanced", { diff: format.thb(fromSatang(debit > credit ? debit - credit : credit - debit)) })}
          </p>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" iconStart="send" loading={busy} disabled={debit !== credit || debit === 0n} onClick={() => void save(true)}>
          {t("submit")}
        </Button>
        <Button size="lg" variant="secondary" iconStart="save" loading={busy} onClick={() => void save(false)}>
          {t("saveDraft")}
        </Button>
      </div>
    </div>
  );
}

/** D-389: reverse a posted entry on a date with a reason. */
export function ReverseJournal({ journal }: { journal: Journal }) {
  const t = useTranslations("partnerLedger.journal");
  const tc = useTranslations("partnerLedger.common");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInBangkok());
  const [reason, setReason] = useState("");
  const [key] = useState(newIdempotencyKey);

  async function reverse() {
    if (reason.trim().length < 3 || !DAY.test(date)) return;
    const done = await run(
      () => erpPost<Journal>(factoryId, "/ledger/journals/{entryId}/actions/reverse", { entryId: journal.id }, { documentDate: date, reason: reason.trim() }, { idempotencyKey: key }),
      t("reverseDone"),
      "none",
    );
    if (done) router.push(`/ledger/journals/${done.id}`);
  }

  return (
    <>
      <Button size="lg" variant="destructive" iconStart="undo" onClick={() => setOpen(true)}>
        {t("reverseTitle", { no: journal.entryNo ?? "" })}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("reverseTitle", { no: journal.entryNo ?? "" })}
          description={t("reverseBody")}
          closeLabel={tc("close")}
          footer={
            <Button variant="destructive" iconStart="undo" loading={busy} disabled={reason.trim().length < 3} onClick={() => void reverse()}>
              {t("reverseTitle", { no: journal.entryNo ?? "" })}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("reverseDate")} required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={tc("reasonLabel")} required>
              <Input value={reason} minLength={3} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** D-396: the month's posted lines as CSV for the accountant's own software. */
export function ExportJournals({ month }: { month: string }) {
  const t = useTranslations("partnerLedger.journals");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  return (
    <Button
      size="lg"
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        const link = await run(() => erpPost<{ url: string; rows: number }>(factoryId, "/ledger/exports/journals", {}, { month }), (r) => t("exportDone", { rows: r.rows }), "none");
        if (link) window.location.assign(link.url);
      }}
    >
      {t("export")}
    </Button>
  );
}

// ============================================================================================ recurring

type RecLine = { accountCode: string; side: "debit" | "credit"; amount: string };

/** D-389: a recurring journal (or accrual) — balanced lines posted on its day each month. */
export function RecurringDialog({ accounts, recurring, onClose }: { accounts: AccountOption[]; recurring?: Recurring; onClose: () => void }) {
  const t = useTranslations("partnerLedger.recurring");
  const tc = useTranslations("partnerLedger.common");
  const tf = useTranslations("partnerLedger.form");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [name, setName] = useState(recurring?.name ?? "");
  const [description, setDescription] = useState(recurring?.description ?? "");
  const [day, setDay] = useState(String(recurring?.dayOfMonth ?? 28));
  const [start, setStart] = useState(recurring?.startOn ?? todayInBangkok().slice(0, 8) + "01");
  const [end, setEnd] = useState(recurring?.endOn ?? "");
  const [autoReverse, setAutoReverse] = useState(recurring?.autoReverse ?? false);
  const [stopped, setStopped] = useState(recurring?.status === "inactive");
  const [lines, setLines] = useState<RecLine[]>(
    recurring?.lines.map((l) => ({ accountCode: l.accountCode, side: l.side as "debit" | "credit", amount: l.amount })) ?? [
      { accountCode: "", side: "debit", amount: "" },
      { accountCode: "", side: "credit", amount: "" },
    ],
  );
  const options = accounts.filter((a) => !a.control).map((a) => ({ value: a.id, label: a.label }));
  const set = (i: number, patch: Partial<RecLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const sum = (side: string) => lines.filter((l) => l.side === side).reduce((s, l) => s + (satang(l.amount) ?? 0n), 0n);

  async function save() {
    const n = Number(day);
    if (!name.trim() || !description.trim() || !(n >= 1 && n <= 28) || lines.some((l) => !l.accountCode || !satang(l.amount)) || sum("debit") !== sum("credit"))
      return toast.error(tf("needLines"));
    const body = {
      name: name.trim(),
      description: description.trim(),
      dayOfMonth: n,
      startOn: start,
      endOn: end || null,
      autoReverse,
      status: stopped ? "inactive" : "active",
      lines: lines.map((l) => ({ accountCode: l.accountCode, side: l.side, amount: fromSatang(satang(l.amount)!) })),
    };
    const done = await run(
      () =>
        recurring
          ? erpSave("PUT", factoryId, "/ledger/recurring-journals/{recurringId}", { recurringId: recurring.id }, body, null)
          : erpPost(factoryId, "/ledger/recurring-journals", {}, body),
      t("saved"),
    );
    if (done) onClose();
  }

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      closeLabel={tc("close")}
      footer={
        <Button iconStart="save" loading={busy} onClick={() => void save()}>
          {tc("save")}
        </Button>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("name")} required>
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("description")} required>
            <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("day")} required>
            <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label={t("start")} required>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t("end")}>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[2fr_9rem_9rem_auto] md:items-end">
            <Field label={tc("account")} labelHidden={i > 0}>
              <Select value={line.accountCode || null} options={options} placeholder={tc("accountPlaceholder")} onValueChange={(v) => set(i, { accountCode: v })} aria-label={tc("account")} />
            </Field>
            <Field label={tf("side")} labelHidden={i > 0}>
              <SegmentedControl
                label={tf("side")}
                size="md"
                value={line.side}
                onValueChange={(v) => set(i, { side: v as "debit" | "credit" })}
                options={[
                  { value: "debit", label: tc("debit") },
                  { value: "credit", label: tc("credit") },
                ]}
              />
            </Field>
            <Field label={tc("amount")} labelHidden={i > 0}>
              <Input inputMode="decimal" value={line.amount} onChange={(e) => set(i, { amount: e.target.value })} className="text-end" />
            </Field>
            <IconButton name="trash" label={tf("removeLine")} variant="ghost" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setLines([...lines, { accountCode: "", side: "debit", amount: "" }])}>
          {tf("addLine")}
        </Button>
        <Checkbox label={t("autoReverse")} checked={autoReverse} onCheckedChange={(on) => setAutoReverse(on === true)} />
        {recurring ? <Checkbox label={t("stopped")} checked={stopped} onCheckedChange={(on) => setStopped(on === true)} /> : null}
      </div>
    </Dialog>
  );
}

/** The recurring list's add / edit buttons. */
export function RecurringButton({ accounts, recurring, label }: { accounts: AccountOption[]; recurring?: Recurring; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={recurring ? "sm" : "lg"} variant={recurring ? "secondary" : "primary"} iconStart={recurring ? "edit" : "plus"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <RecurringDialog accounts={accounts} {...(recurring ? { recurring } : {})} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// ============================================================================================= settings

const METHOD_ORDER = ["cash", "bank", "receivables", "payables", "grir", "inputVat", "inputVatUndue", "outputVat", "whtPnd3", "whtPnd53", "whtReceivable", "wip", "finishedGoods", "cogs", "sales"];

/** D-387: fiscal year, ledger start, CPA; and catch-up of documents not yet in the books (D-388). */
export function LedgerSettingsForm({ settings, etag, canConfigure }: { settings: Settings; etag: string | null; canConfigure: boolean }) {
  const t = useTranslations("partnerLedger.settings");
  const tc = useTranslations("partnerLedger.common");
  const tk = useTranslations("partnerLedger.reports.itemKinds");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [month, setMonth] = useState(String(settings.fiscalYearStartMonth));
  const [start, setStart] = useState(settings.ledgerStartOn);
  const [cpa, setCpa] = useState(settings.cpaName ?? "");
  const [contact, setContact] = useState(settings.cpaContact ?? "");
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("fiscalYearStart")} hint={t("fiscalYearHint")}>
          <Select
            value={month}
            disabled={!canConfigure}
            onValueChange={setMonth}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`months.${i + 1}` as never) }))}
            aria-label={t("fiscalYearStart")}
          />
        </Field>
        <Field label={t("ledgerStart")} hint={t("ledgerStartHint")}>
          <Input type="date" value={start} disabled={!canConfigure} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t("cpaName")}>
          <Input value={cpa} maxLength={200} disabled={!canConfigure} onChange={(e) => setCpa(e.target.value)} />
        </Field>
        <Field label={t("cpaContact")}>
          <Input value={contact} maxLength={300} disabled={!canConfigure} onChange={(e) => setContact(e.target.value)} />
        </Field>
      </div>
      {canConfigure ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            iconStart="save"
            loading={busy}
            onClick={() =>
              void run(
                () =>
                  erpSave(
                    "PUT",
                    factoryId,
                    "/ledger/settings",
                    {},
                    {
                      ...(Number(month) !== settings.fiscalYearStartMonth ? { fiscalYearStartMonth: Number(month) } : {}),
                      ledgerStartOn: start,
                      cpaName: cpa.trim() || null,
                      cpaContact: contact.trim() || null,
                    },
                    etag,
                  ),
                t("saved"),
              )
            }
          >
            {tc("save")}
          </Button>
          <Button size="lg" variant="secondary" iconStart="refresh" onClick={() => setConfirm(true)}>
            {t("catchUp")}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("itemKinds")}</h3>
          <dl className="border-border divide-border divide-y rounded-lg border text-sm">
            {Object.entries(settings.itemKindAccounts).map(([kind, code]) => (
              <div key={kind} className="flex justify-between px-3 py-2">
                <dt>{tk.has(kind as never) ? tk(kind as never) : kind}</dt>
                <dd className="font-mono">{code}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("methods")}</h3>
          <dl className="border-border divide-border divide-y rounded-lg border text-sm">
            {METHOD_ORDER.filter((k) => settings.methodAccounts[k]).map((k) => (
              <div key={k} className="flex justify-between px-3 py-2">
                <dt className="font-mono text-xs">{k}</dt>
                <dd className="font-mono">{settings.methodAccounts[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      {confirm ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setConfirm(false)}
          title={t("catchUpTitle")}
          description={t("catchUpBody")}
          closeLabel={tc("close")}
          footer={
            <Button
              iconStart="refresh"
              loading={busy}
              onClick={async () => {
                await run(
                  () => erpPost<{ posted: number; skipped: number; failed: string[] }>(factoryId, "/ledger/actions/catch-up", {}),
                  (r) => t("catchUpDone", { posted: r.posted, skipped: r.skipped, failed: r.failed.length }),
                );
                setConfirm(false);
              }}
            >
              {t("catchUp")}
            </Button>
          }
        >
          <p className="text-muted text-sm">{tc("cpaCaveat")}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

// ======================================================================================= chart change

const KINDS = ["create", "update", "deactivate", "reactivate"] as const;
const TYPES = ["asset", "liability", "equity", "revenue", "cost_of_sales", "expense"] as const;
const CASH_FLOWS = ["operating", "investing", "financing", "cash", "equity", "non_cash"] as const;
const LINES = ["cash", "trade_receivables", "other_receivables", "inventory", "tax_assets", "other_current_assets", "ppe", "accumulated_depreciation", "trade_payables", "tax_liabilities", "accrued_expenses", "customer_advances", "other_current_liabilities", "long_term_loans", "capital", "retained_earnings", "revenue", "other_income", "cost_of_sales", "manufacturing_overhead", "selling_admin", "finance_cost", "income_tax"] as const;

/** D-386: propose a chart change — someone else approves it. */
export function ProposeAccountChange({ accounts }: { accounts: Account[] }) {
  const t = useTranslations("partnerLedger.accounts");
  const tc = useTranslations("partnerLedger.common");
  const tl = useTranslations("partnerLedger.reports.lines");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("create");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [type, setType] = useState<string>("expense");
  const [parent, setParent] = useState<string | null>(null);
  const [cashFlow, setCashFlow] = useState<string>("operating");
  const [line, setLine] = useState<string>("selling_admin");
  const [reason, setReason] = useState("");
  const target = accounts.find((a) => a.id === accountId);
  const headings = accounts.filter((a) => !a.isPostable).map((a) => ({ value: a.code, label: `${a.code} ${a.nameTh}` }));

  function pick(id: string) {
    setAccountId(id);
    const a = accounts.find((x) => x.id === id);
    if (a) {
      setNameTh(a.nameTh);
      setNameEn(a.nameEn);
      setType(a.accountType);
      setCashFlow(a.cashFlowClass);
      setLine(a.statementLine);
      setParent(a.parent?.code ?? null);
    }
  }

  async function propose() {
    const edits = kind === "create" || kind === "update";
    if (reason.trim().length < 3 || (kind !== "create" && !accountId) || (kind === "create" && !ACCOUNT_CODE.test(code.trim())) || (edits && (!nameTh.trim() || !nameEn.trim())))
      return toast.error(t("invalid"));
    const done = await run(
      () =>
        erpPost(factoryId, "/ledger/account-changes", {}, {
          kind,
          ...(kind !== "create" ? { accountId } : {}),
          ...(edits
            ? { proposed: { ...(kind === "create" ? { code: code.trim() } : {}), nameTh: nameTh.trim(), nameEn: nameEn.trim(), accountType: type, parentCode: parent, cashFlowClass: cashFlow, statementLine: line } }
            : {}),
          reason: reason.trim(),
        }),
      t("proposed"),
    );
    if (done) setOpen(false);
  }

  return (
    <>
      <Button size="lg" iconStart="plus" onClick={() => setOpen(true)}>
        {t("propose")}
      </Button>
      {open ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("proposeTitle")}
          description={t("proposeBody")}
          closeLabel={tc("close")}
          footer={
            <Button iconStart="send" loading={busy} onClick={() => void propose()}>
              {t("propose")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("kind")}>
              <SegmentedControl label={t("kind")} size="md" value={kind} onValueChange={(v) => setKind(v as (typeof KINDS)[number])} options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
            </Field>
            {kind !== "create" ? (
              <Field label={t("target")} required>
                <Select
                  value={accountId}
                  options={accounts.filter((a) => (kind === "reactivate" ? a.status === "inactive" : kind === "deactivate" ? a.status === "active" : true)).map((a) => ({ value: a.id, label: `${a.code} ${a.nameTh}` }))}
                  placeholder={tc("accountPlaceholder")}
                  onValueChange={pick}
                  aria-label={t("target")}
                />
              </Field>
            ) : null}
            {kind === "create" || kind === "update" ? (
              <>
                <div className="grid gap-3 md:grid-cols-[8rem_1fr_1fr]">
                  <Field label={t("code")} required>
                    <Input value={kind === "create" ? code : (target?.code ?? "")} disabled={kind !== "create"} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
                  </Field>
                  <Field label={t("nameTh")} required>
                    <Input value={nameTh} maxLength={200} onChange={(e) => setNameTh(e.target.value)} />
                  </Field>
                  <Field label={t("nameEn")} required>
                    <Input value={nameEn} maxLength={200} onChange={(e) => setNameEn(e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("type")}>
                    <Select value={type} onValueChange={setType} options={TYPES.map((x) => ({ value: x, label: tc(`types.${x}`) }))} aria-label={t("type")} />
                  </Field>
                  <Field label={t("parent")}>
                    <Select value={parent} onValueChange={setParent} options={headings} placeholder={tc("none")} aria-label={t("parent")} />
                  </Field>
                  <Field label={t("cashFlow")}>
                    <Select value={cashFlow} onValueChange={setCashFlow} options={CASH_FLOWS.map((x) => ({ value: x, label: t(`cashFlows.${x}`) }))} aria-label={t("cashFlow")} />
                  </Field>
                  <Field label={t("line")}>
                    <Select value={line} onValueChange={setLine} options={LINES.map((x) => ({ value: x, label: tl(x) }))} aria-label={t("line")} />
                  </Field>
                </div>
              </>
            ) : null}
            <Field label={t("reason")} required>
              <Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

// ============================================================================================== tax

/** D-392: record that a return was filed. */
export function MarkFiled({ filing }: { filing: Filing }) {
  const t = useTranslations("partnerLedger.overview");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [filedOn, setFiledOn] = useState(todayInBangkok());
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(filing.ledgerAmount);
  const [key] = useState(newIdempotencyKey);
  const form = t(`forms.${filing.form}` as never);
  return (
    <>
      <Button size="sm" variant="secondary" iconStart="file-check" onClick={() => setOpen(true)}>
        {t("markFiled")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("markFiled")}
          description={t("markFiledBody", { form, month: filing.month, amount: format.thb(filing.ledgerAmount) })}
          closeLabel={tc("close")}
          footer={
            <Button
              iconStart="file-check"
              loading={busy}
              onClick={async () => {
                const done = await run(
                  () =>
                    erpPost(factoryId, "/ledger/tax-filings", {}, { form: filing.form, month: filing.month, filedOn, reference: reference.trim() || null, amount: plainNumber(amount) }, { idempotencyKey: key }),
                  t("filedDone"),
                );
                if (done) setOpen(false);
              }}
            >
              {tc("save")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("filedOn")} required>
              <Input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
            </Field>
            <Field label={t("reference")}>
              <Input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label={t("filedAmount")}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-end" />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
