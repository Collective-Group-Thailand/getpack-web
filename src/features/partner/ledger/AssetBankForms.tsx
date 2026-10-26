"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber } from "@/features/partner/erp/format";
import { erpPost, erpSave } from "@/features/partner/sales/api";
import { Select } from "@/features/partner/select";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { type AccountOption, satang, todayInBangkok, useRun } from "./LedgerForms";

type Category = Schemas["ErpGlAssetCategoryDto"];
type Asset = Schemas["ErpGlAssetDto"];
type Bank = Schemas["ErpGlBankAccountDto"];
type Line = Schemas["ErpGlBankLineDto"];
type Option = { id: string; label: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^-?\d{1,12}(\.\d{1,2})?$/;

// ========================================================================================== categories

/** D-393: an asset category — useful life and its four accounts. */
export function CategoryButton({ accounts, category }: { accounts: AccountOption[]; category?: Category }) {
  const t = useTranslations("partnerLedger.assets");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [life, setLife] = useState(String(category?.usefulLifeMonths ?? 60));
  const [asset, setAsset] = useState<string | null>(category?.assetAccount.code ?? "1230");
  const [accumulated, setAccumulated] = useState<string | null>(category?.accumulatedAccount.code ?? "1239");
  const [expense, setExpense] = useState<string | null>(category?.expenseAccount.code ?? "5240");
  const [gainLoss, setGainLoss] = useState<string | null>(category?.gainLossAccount.code ?? "4920");
  const options = accounts.filter((a) => !a.control).map((a) => ({ value: a.id, label: a.label }));
  const pick = (label: string, value: string | null, set: (v: string) => void) => (
    <Field label={label} required>
      <Select
        value={value}
        options={options}
        placeholder={tc("accountPlaceholder")}
        onValueChange={set}
        aria-label={label}
      />
    </Field>
  );

  async function save() {
    const n = Number(life);
    if (!name.trim() || !(n >= 1 && n <= 600) || !asset || !accumulated || !expense || !gainLoss)
      return toast.error(t("invalid"));
    const body = {
      name: name.trim(),
      usefulLifeMonths: n,
      assetAccountCode: asset,
      accumulatedAccountCode: accumulated,
      expenseAccountCode: expense,
      gainLossAccountCode: gainLoss,
    };
    const done = await run(
      () =>
        category
          ? erpSave("PUT", factoryId, "/ledger/asset-categories/{categoryId}", { categoryId: category.id }, body, null)
          : erpPost(factoryId, "/ledger/asset-categories", {}, body),
      t("saved"),
    );
    if (done) setOpen(false);
  }

  return (
    <>
      <Button
        size={category ? "sm" : "md"}
        variant="secondary"
        iconStart={category ? "edit" : "plus"}
        onClick={() => setOpen(true)}
      >
        {category ? t("editCategory") : t("newCategory")}
      </Button>
      {open ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(next) => !next && setOpen(false)}
          title={category ? t("editCategory") : t("newCategory")}
          closeLabel={tc("close")}
          footer={
            <Button iconStart="save" loading={busy} onClick={() => void save()}>
              {tc("save")}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("category")} required>
              <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("life")} required>
              <Input inputMode="numeric" value={life} onChange={(e) => setLife(e.target.value)} />
            </Field>
            {pick(t("assetAccount"), asset, setAsset)}
            {pick(t("accumulatedAccount"), accumulated, setAccumulated)}
            {pick(t("expenseAccount"), expense, setExpense)}
            {pick(t("gainLossAccount"), gainLoss, setGainLoss)}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

// ============================================================================================ assets

/** D-393: register an asset (its purchase is posted by the supplier invoice or an opening journal). */
export function AssetButton({ categories, machines }: { categories: Category[]; machines: Option[] }) {
  const t = useTranslations("partnerLedger.assets");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [name, setName] = useState("");
  const [acquiredOn, setAcquiredOn] = useState(todayInBangkok());
  const [cost, setCost] = useState("");
  const [salvage, setSalvage] = useState("");
  const [life, setLife] = useState("");
  const [start, setStart] = useState("");
  const [opening, setOpening] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);
  const money = (v: string) => (v ? plainNumber(v) : undefined);

  async function save() {
    if (
      !categoryId ||
      !name.trim() ||
      !DAY.test(acquiredOn) ||
      !satang(cost) ||
      (salvage && satang(salvage) === null) ||
      (opening && satang(opening) === null)
    )
      return toast.error(t("invalid"));
    const done = await run(
      () =>
        erpPost(
          factoryId,
          "/ledger/fixed-assets",
          {},
          {
            categoryId,
            name: name.trim(),
            acquiredOn,
            cost: plainNumber(cost),
            ...(money(salvage) ? { salvageValue: money(salvage) } : {}),
            ...(life ? { usefulLifeMonths: Number(life) } : {}),
            ...(start ? { depreciationStart: start } : {}),
            ...(money(opening) ? { openingAccumulated: money(opening) } : {}),
            machineId,
          },
          { idempotencyKey: key },
        ),
      t("registered"),
    );
    if (done) setOpen(false);
  }

  return (
    <>
      <Button size="lg" iconStart="plus" disabled={!categories.length} onClick={() => setOpen(true)}>
        {t("new")}
      </Button>
      {open ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("new")}
          closeLabel={tc("close")}
          footer={
            <Button iconStart="save" loading={busy} onClick={() => void save()}>
              {tc("save")}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("name")} required>
              <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("category")} required>
              <Select
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name, description: `${c.usefulLifeMonths}` }))}
                onValueChange={setCategoryId}
                aria-label={t("category")}
              />
            </Field>
            <Field label={t("acquiredOn")} required>
              <Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
            </Field>
            <Field label={t("cost")} required>
              <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="text-end" />
            </Field>
            <Field label={t("salvage")}>
              <Input
                inputMode="decimal"
                value={salvage}
                onChange={(e) => setSalvage(e.target.value)}
                className="text-end"
              />
            </Field>
            <Field label={t("life")}>
              <Input
                inputMode="numeric"
                value={life}
                placeholder={String(categories.find((c) => c.id === categoryId)?.usefulLifeMonths ?? "")}
                onChange={(e) => setLife(e.target.value)}
              />
            </Field>
            <Field label={t("start")} hint={t("startHint")}>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t("opening")} hint={t("openingHint")}>
              <Input
                inputMode="decimal"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="text-end"
              />
            </Field>
            {machines.length ? (
              <Field label={t("machine")}>
                <Select
                  value={machineId}
                  options={machines.map((m) => ({ value: m.id, label: m.label }))}
                  placeholder={tc("none")}
                  onValueChange={setMachineId}
                  aria-label={t("machine")}
                />
              </Field>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** D-393: sell or write off an asset (F16D). */
export function DisposeAsset({ asset, etag, banks }: { asset: Asset; etag: string | null; banks: Option[] }) {
  const t = useTranslations("partnerLedger.assets");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInBangkok());
  const [proceeds, setProceeds] = useState("0");
  const [bankId, setBankId] = useState<string | null>(banks[0]?.id ?? null);
  const [key] = useState(newIdempotencyKey);
  return (
    <>
      <Button size="sm" variant="destructive" iconStart="archive" onClick={() => setOpen(true)}>
        {t("dispose", { name: asset.assetNo })}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("dispose", { name: `${asset.assetNo} ${asset.name}` })}
          description={t("disposeBody")}
          closeLabel={tc("close")}
          footer={
            <Button
              variant="destructive"
              iconStart="archive"
              loading={busy}
              onClick={async () => {
                if (!DAY.test(date) || satang(proceeds || "0") === null) return toast.error(t("invalid"));
                const done = await run(
                  () =>
                    erpPost(
                      factoryId,
                      "/ledger/fixed-assets/{assetId}/actions/dispose",
                      { assetId: asset.id },
                      { disposedOn: date, proceeds: plainNumber(proceeds || "0"), bankAccountId: bankId },
                      { idempotencyKey: key, etag },
                    ),
                  t("disposed"),
                );
                if (done) setOpen(false);
              }}
            >
              {t("dispose", { name: asset.assetNo })}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("disposedOn")} required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("proceeds")}>
              <Input
                inputMode="decimal"
                value={proceeds}
                onChange={(e) => setProceeds(e.target.value)}
                className="text-end"
              />
            </Field>
            {banks.length ? (
              <Field label={t("bank")}>
                <Select
                  value={bankId}
                  options={banks.map((b) => ({ value: b.id, label: b.label }))}
                  onValueChange={setBankId}
                  aria-label={t("bank")}
                />
              </Field>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** D-393: the month's depreciation, once, posted at once (F16). */
export function RunDepreciation({ month }: { month: string }) {
  const t = useTranslations("partnerLedger.assets");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [key] = useState(newIdempotencyKey);
  return (
    <>
      <Button size="lg" variant="secondary" iconStart="calculator" onClick={() => setOpen(true)}>
        {t("run")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("runTitle", { month })}
          description={t("runBody")}
          closeLabel={tc("close")}
          footer={
            <Button
              iconStart="calculator"
              loading={busy}
              onClick={async () => {
                const done = await run(
                  () =>
                    erpPost<{ total: string }>(
                      factoryId,
                      "/ledger/depreciation-runs",
                      {},
                      { month },
                      { idempotencyKey: key },
                    ),
                  (r) => t("runDone", { total: format.thb(r.total) }),
                );
                if (done) setOpen(false);
              }}
            >
              {t("run")}
            </Button>
          }
        >
          <p className="text-muted text-sm">{tc("cpaCaveat")}</p>
        </Dialog>
      ) : null}
    </>
  );
}

// ============================================================================================== bank

/** D-394: add or edit a bank account (last four digits only). */
export function BankAccountButton({ bank }: { bank?: Bank }) {
  const t = useTranslations("partnerLedger.bank");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(bank?.name ?? "");
  const [bankName, setBankName] = useState(bank?.bankName ?? "");
  const [last4, setLast4] = useState(bank?.accountNoLast4 ?? "");
  const [isDefault, setIsDefault] = useState(bank?.isDefault ?? false);
  const [inactive, setInactive] = useState(bank?.status === "inactive");

  async function save() {
    if (!name.trim() || !bankName.trim() || !/^\d{4}$/.test(last4)) return toast.error(t("invalid"));
    const body = {
      name: name.trim(),
      bankName: bankName.trim(),
      accountNoLast4: last4,
      isDefault,
      ...(bank ? { status: inactive ? "inactive" : "active" } : {}),
    };
    const done = await run(
      () =>
        bank
          ? erpSave("PUT", factoryId, "/ledger/bank-accounts/{bankAccountId}", { bankAccountId: bank.id }, body, null)
          : erpPost(factoryId, "/ledger/bank-accounts", {}, body),
      t("saved"),
    );
    if (done) setOpen(false);
  }

  return (
    <>
      <Button
        size={bank ? "sm" : "lg"}
        variant={bank ? "secondary" : "primary"}
        iconStart={bank ? "edit" : "plus"}
        onClick={() => setOpen(true)}
      >
        {bank ? t("editAccount") : t("newAccount")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={bank ? t("editAccount") : t("newAccount")}
          closeLabel={tc("close")}
          footer={
            <Button iconStart="save" loading={busy} onClick={() => void save()}>
              {tc("save")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("name")} required>
              <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bankName")} required>
                <Input value={bankName} maxLength={50} onChange={(e) => setBankName(e.target.value)} />
              </Field>
              <Field label={t("last4")} required>
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
                  className="tabular-nums"
                />
              </Field>
            </div>
            <Checkbox label={t("isDefault")} checked={isDefault} onCheckedChange={(on) => setIsDefault(on === true)} />
            {bank ? (
              <Checkbox label={t("inactive")} checked={inactive} onCheckedChange={(on) => setInactive(on === true)} />
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** Parses pasted rows "date,amount,description,reference" (one per line). */
function parseRows(text: string): {
  rows: { txnDate: string; amount: string; description: string; reference: string | null }[];
  bad: number | null;
} {
  const rows = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const [date, amount, description, ...rest] = line.split(",").map((x) => x.trim());
    const value = plainNumber(amount ?? "");
    if (!date || !DAY.test(date) || !AMOUNT.test(value) || !description) return { rows: [], bad: i + 1 };
    rows.push({ txnDate: date, amount: value, description, reference: rest.join(",").trim() || null });
  }
  return { rows, bad: null };
}

/** D-394: import a statement — a CSV file (getpack's bank-file format) or pasted rows. */
export function ImportStatement({ bank }: { bank: Bank }) {
  const t = useTranslations("partnerLedger.bank");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [key] = useState(newIdempotencyKey);

  async function submit() {
    let body: Record<string, unknown>;
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      body = { format: "generic_csv", file: btoa(binary) };
    } else {
      const { rows, bad } = parseRows(text);
      if (bad) return toast.error(t("badRows", { n: bad }));
      if (!rows.length) return toast.error(t("nothing"));
      body = { rows };
    }
    const done = await run(
      () =>
        erpPost<{ imported: number; duplicates: number; autoMatched: number }>(
          factoryId,
          "/ledger/bank-accounts/{bankAccountId}/statements",
          { bankAccountId: bank.id },
          body,
          { idempotencyKey: key },
        ),
      (r) => t("imported", r),
    );
    if (done) {
      setOpen(false);
      setText("");
      setFile(null);
    }
  }

  return (
    <>
      <Button size="sm" iconStart="upload" onClick={() => setOpen(true)}>
        {t("import")}
      </Button>
      {open ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("importTitle", { name: bank.name })}
          description={t("importBody")}
          closeLabel={tc("close")}
          footer={
            <Button iconStart="upload" loading={busy} onClick={() => void submit()}>
              {t("import")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("file")}>
              <span className="flex flex-wrap items-center gap-2">
                <FilePickButton
                  label={t("chooseCsv")}
                  accept=".csv,text/csv"
                  icon="document"
                  onFiles={([chosen]) => setFile(chosen ?? null)}
                />
                {file ? <span className="text-muted text-sm">{file.name}</span> : null}
              </span>
            </Field>
            <Field label={t("paste")}>
              <Textarea
                rows={6}
                value={text}
                placeholder={t("pastePlaceholder")}
                onChange={(e) => setText(e.target.value)}
                className="text-sm tabular-nums"
              />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** D-394: match an open statement line — a same-amount payment or receipt, or a fee / interest. */
export function MatchBankLine({ line }: { line: Line }) {
  const t = useTranslations("partnerLedger.bank");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const out = line.amount.startsWith("-");
  const match = async (targetType: string, targetId?: string | null) => {
    const done = await run(
      () =>
        erpPost(
          factoryId,
          "/ledger/bank-lines/{lineId}/actions/match",
          { lineId: line.id },
          { targetType, ...(targetId ? { targetId } : {}) },
          { idempotencyKey: key },
        ),
      t("matched"),
    );
    if (done) setOpen(false);
  };
  return (
    <>
      <Button size="sm" iconStart="link" onClick={() => setOpen(true)}>
        {t("matchButton")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("match", { amount: format.thb(line.amount), date: format.date(line.txnDate) })}
          description={t("matchBody")}
          closeLabel={tc("close")}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm">{line.description}</p>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("candidates")}</h3>
              {line.candidates.length ? (
                <ul className="border-border divide-border divide-y rounded-lg border">
                  {line.candidates.map((c) => (
                    <li
                      key={c.targetId ?? c.targetNo}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span>
                        {t(`targets.${c.targetType}` as never)} <span className="tabular-nums">{c.targetNo}</span>
                      </span>
                      <Button size="sm" loading={busy} onClick={() => void match(c.targetType, c.targetId)}>
                        {t("matched")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">{t("noCandidates")}</p>
              )}
            </section>
            <Button
              variant="secondary"
              iconStart={out ? "receipt" : "coins"}
              loading={busy}
              onClick={() => void match(out ? "bank_fee" : "interest")}
            >
              {out ? t("asFee") : t("asInterest")}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
