"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { erpPost } from "@/features/partner/sales/api";
import { SalesActions } from "@/features/partner/sales/SalesActions";
import { Select } from "@/features/partner/select";
import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { type AccountOption, todayInBangkok, useRun } from "./LedgerForms";

type Rule = Schemas["ErpGlRuleDetailDto"];
type Version = Schemas["ErpGlRuleVersionDto"];
type Template = Schemas["ErpGlTemplateDto"];
type TemplateLine = Schemas["ErpGlTemplateLineDto"];
type Preview = Schemas["ErpGlPreviewDto"];

const TAX_CODES = [
  "output_vat",
  "output_vat_not_due",
  "input_vat",
  "input_vat_pending",
  "wht_receivable",
  "wht_pnd3",
  "wht_pnd53",
] as const;
const OPS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NONE = "-";

type Line = {
  forEach: string;
  whenField: string;
  whenOp: string;
  whenValue: string;
  mode: "fixed" | "document";
  accountCode: string;
  accountPath: string;
  side: "debit" | "credit";
  amount: string;
  description: string;
  taxCode: string;
  taxBase: string;
  dimensions?: Record<string, string>;
};

const lineOf = (l: TemplateLine): Line => ({
  forEach: l.forEach ?? "",
  whenField: l.when?.field ?? "",
  whenOp: l.when?.op ?? "eq",
  whenValue: l.when?.value ?? "",
  mode: l.accountCode ? "fixed" : "document",
  accountCode: l.accountCode ?? "",
  accountPath: l.accountPath ?? "",
  side: l.side === "credit" ? "credit" : "debit",
  amount: l.amount,
  description: l.description ?? "",
  taxCode: l.taxCode ?? "",
  taxBase: l.taxBase ?? "",
  ...(l.dimensions ? { dimensions: l.dimensions } : {}),
});

const emptyLine = (): Line => ({
  forEach: "",
  whenField: "",
  whenOp: "eq",
  whenValue: "",
  mode: "fixed",
  accountCode: "",
  accountPath: "",
  side: "debit",
  amount: "",
  description: "",
  taxCode: "",
  taxBase: "",
});

const templateOf = (description: string, lines: Line[]): Template => ({
  description: description.trim(),
  lines: lines.map((l) => ({
    forEach: l.forEach || null,
    when: l.whenField ? { field: l.whenField, op: l.whenOp as (typeof OPS)[number], value: l.whenValue.trim() } : null,
    accountCode: l.mode === "fixed" ? l.accountCode || null : null,
    accountPath: l.mode === "document" ? l.accountPath || null : null,
    side: l.side,
    amount: l.amount.trim(),
    description: l.description.trim() || null,
    taxCode: (l.taxCode || null) as TemplateLine["taxCode"],
    taxBase: l.taxCode ? l.taxBase.trim() || null : null,
    ...(l.dimensions ? { dimensions: l.dimensions } : {}),
  })),
});

/** The result of trying a template on the factory's latest document of the kind (D-398). */
export function PreviewResult({ preview }: { preview: Preview }) {
  const t = useTranslations("partnerLedger.rules");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{t("previewTitle")}</h3>
        {preview.sampleNo ? (
          <span className="text-muted text-sm">
            {t("previewSample", { no: preview.sampleNo, date: preview.sampleAt ? format.date(preview.sampleAt) : "" })}
          </span>
        ) : (
          <span className="text-muted text-sm">{t("previewNone")}</span>
        )}
        {preview.lines.length ? (
          <Badge tone={preview.balanced ? "success" : "danger"}>
            {preview.balanced ? t("balanced") : t("unbalanced")}
          </Badge>
        ) : null}
      </div>
      {preview.lines.length ? (
        <>
          <p className="text-sm">{preview.description}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-start text-xs">
                <th className="py-1 text-start font-medium">{tc("account")}</th>
                <th className="py-1 text-end font-medium">{tc("debit")}</th>
                <th className="py-1 text-end font-medium">{tc("credit")}</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l, i) => (
                <tr key={i} className="border-border border-t">
                  <td className="py-1">
                    <span className="tabular-nums">{l.accountCode}</span> {l.accountName ?? ""}
                    {l.taxCode ? (
                      <span className="text-muted ms-1 text-xs">{t(`taxCodes.${l.taxCode}` as never)}</span>
                    ) : null}
                  </td>
                  <td className="py-1 text-end tabular-nums">{l.side === "debit" ? format.thb(l.amount) : ""}</td>
                  <td className="py-1 text-end tabular-nums">{l.side === "credit" ? format.thb(l.amount) : ""}</td>
                </tr>
              ))}
              <tr className="border-border border-t font-semibold">
                <td className="py-1">{tc("total")}</td>
                <td className="py-1 text-end tabular-nums">{format.thb(preview.totalDebit)}</td>
                <td className="py-1 text-end tabular-nums">{format.thb(preview.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : null}
      {preview.problems.length ? (
        <div className="text-danger text-sm">
          <p className="font-medium">{t("problems")}</p>
          <ul className="list-disc ps-5">
            {preview.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-success text-sm">{t("noProblems")}</p>
      )}
    </div>
  );
}

/**
 * D-398: propose a new version of a posting rule — the lines of the version in force, edited as rows (repeat for a
 * list, condition, fixed or document account, side, amount formula, tax), tried on the latest document, then sent
 * for someone else's approval with the day it takes effect and a reason.
 */
export function RuleEditor({
  rule,
  current,
  accounts,
  documentAccounts,
}: {
  rule: Rule;
  current: Version | null;
  accounts: AccountOption[];
  documentAccounts: AccountOption[];
}) {
  const t = useTranslations("partnerLedger.rules");
  const tc = useTranslations("partnerLedger.common");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const start = () => ({
    description: current?.template.description ?? "",
    lines: current?.template.lines.map(lineOf) ?? [emptyLine()],
  });
  const [description, setDescription] = useState(start().description);
  const [lines, setLines] = useState<Line[]>(start().lines);
  const [effectiveFrom, setEffectiveFrom] = useState(todayInBangkok());
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [trying, setTrying] = useState(false);

  const offered = rule.nextActions.find((a) => a.key === "erp_rule.propose");
  if (!offered) return null;

  const lists = rule.variables.filter((v) => v.kind === "list");
  const fields = rule.variables.filter((v) => v.kind !== "list" && v.kind !== "account");
  const amounts = rule.variables.filter((v) => v.kind === "amount");
  const fixedOptions = accounts.map((a) => ({ value: a.id, label: a.label }));
  const docOptions = documentAccounts.map((a) => ({
    value: a.id,
    label: a.label,
    ...(a.hint ? { description: a.hint } : {}),
  }));
  const listOptions = [
    { value: NONE, label: t("once") },
    ...lists.map((v) => ({ value: v.path, label: v.label, description: v.path })),
  ];
  const fieldOptions = [
    { value: NONE, label: t("always") },
    ...fields.map((v) => ({ value: v.path, label: v.label, description: v.path })),
  ];
  const taxOptions = [
    { value: NONE, label: t("noTax") },
    ...TAX_CODES.map((c) => ({ value: c, label: t(`taxCodes.${c}`) })),
  ];
  const opOptions = OPS.map((o) => ({ value: o, label: t(`ops.${o}`) }));
  const set = (i: number, patch: Partial<Line>) => {
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setPreview(null);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...lines];
    const [l] = next.splice(i, 1);
    next.splice(i + by, 0, l!);
    setLines(next);
  };
  const reset = () => {
    const s = start();
    setDescription(s.description);
    setLines(s.lines);
    setPreview(null);
  };
  const ready = () =>
    description.trim() !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.amount.trim() !== "" && (l.mode === "fixed" ? l.accountCode : l.accountPath));

  async function tryIt(): Promise<Preview | null> {
    if (!ready()) {
      toast.error(t("invalid"));
      return null;
    }
    setTrying(true);
    try {
      const result = await erpPost<Preview>(
        factoryId,
        "/ledger/rules/{ruleId}/actions/preview",
        { ruleId: rule.id },
        { template: templateOf(description, lines) },
      );
      setPreview(result);
      return result;
    } catch {
      toast.error(tc("failed"));
      return null;
    } finally {
      setTrying(false);
    }
  }

  async function submit() {
    if (!ready() || !DAY.test(effectiveFrom) || reason.trim().length < 3) return toast.error(t("invalid"));
    const checked = await tryIt();
    if (!checked || checked.problems.length) return;
    const saved = await run(
      () =>
        erpPost<Rule>(
          factoryId,
          "/ledger/rules/{ruleId}/versions",
          { ruleId: rule.id },
          { template: templateOf(description, lines), effectiveFrom, reason: reason.trim() },
        ),
      t("proposed"),
    );
    if (saved) {
      setOpen(false);
      setReason("");
      setPreview(null);
    }
  }

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button iconStart="edit" disabled={!!offered.disabledReason} onClick={() => setOpen(true)}>
          {t("edit")}
        </Button>
        {offered.disabledReason ? <span className="text-muted text-sm">{offered.disabledReason}</span> : null}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("editBody")}</p>
      <Field label={t("entryText")} hint={t("entryTextHint")} required>
        <Input
          value={description}
          maxLength={300}
          onChange={(e) => (setDescription(e.target.value), setPreview(null))}
        />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("lines")}</legend>
        {lines.map((line, i) => (
          <div key={i} className="border-border flex flex-col gap-3 rounded-lg border p-3" data-testid="rule-line">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t("line", { n: i + 1 })}</span>
              <div className="flex gap-1">
                <IconButton
                  name="chevron-up"
                  label={t("moveUp")}
                  variant="ghost"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                />
                <IconButton
                  name="chevron-down"
                  label={t("moveDown")}
                  variant="ghost"
                  disabled={i === lines.length - 1}
                  onClick={() => move(i, 1)}
                />
                <IconButton
                  name="trash"
                  label={t("removeLine")}
                  variant="ghost"
                  disabled={lines.length <= 1}
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("accountMode")}>
                <SegmentedControl
                  label={t("accountMode")}
                  size="md"
                  value={line.mode}
                  onValueChange={(v) => set(i, { mode: v as Line["mode"] })}
                  options={[
                    { value: "fixed", label: t("fixed") },
                    { value: "document", label: t("fromDocument") },
                  ]}
                />
              </Field>
              {line.mode === "fixed" ? (
                <Field label={t("account")}>
                  <Select
                    value={line.accountCode || null}
                    options={fixedOptions}
                    placeholder={tc("accountPlaceholder")}
                    onValueChange={(v) => set(i, { accountCode: v })}
                    aria-label={t("account")}
                  />
                </Field>
              ) : (
                <Field label={t("documentAccount")}>
                  <Select
                    value={line.accountPath || null}
                    options={docOptions}
                    placeholder={tc("accountPlaceholder")}
                    onValueChange={(v) => set(i, { accountPath: v })}
                    aria-label={t("documentAccount")}
                  />
                </Field>
              )}
              <Field label={t("side")}>
                <SegmentedControl
                  label={t("side")}
                  size="md"
                  value={line.side}
                  onValueChange={(v) => set(i, { side: v as Line["side"] })}
                  options={[
                    { value: "debit", label: tc("debit") },
                    { value: "credit", label: tc("credit") },
                  ]}
                />
              </Field>
              <Field label={t("amount")} hint={t("amountHint")} required>
                <Input
                  value={line.amount}
                  list={`amounts-${rule.id}`}
                  className="tabular-nums"
                  maxLength={200}
                  onChange={(e) => set(i, { amount: e.target.value })}
                />
              </Field>
              {lists.length ? (
                <Field label={t("repeat")}>
                  <Select
                    value={line.forEach || NONE}
                    options={listOptions}
                    onValueChange={(v) => set(i, { forEach: v === NONE ? "" : v })}
                    aria-label={t("repeat")}
                  />
                </Field>
              ) : null}
              <Field label={t("condition")}>
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-48 flex-1">
                    <Select
                      value={line.whenField || NONE}
                      options={fieldOptions}
                      onValueChange={(v) => set(i, { whenField: v === NONE ? "" : v })}
                      aria-label={t("condition")}
                    />
                  </div>
                  {line.whenField ? (
                    <>
                      <div className="w-36">
                        <Select
                          value={line.whenOp}
                          options={opOptions}
                          onValueChange={(v) => set(i, { whenOp: v })}
                          aria-label={t("condition")}
                        />
                      </div>
                      <Input
                        className="w-28"
                        value={line.whenValue}
                        aria-label={t("value")}
                        placeholder={t("value")}
                        onChange={(e) => set(i, { whenValue: e.target.value })}
                      />
                    </>
                  ) : null}
                </div>
              </Field>
              <Field label={t("taxCode")}>
                <Select
                  value={line.taxCode || NONE}
                  options={taxOptions}
                  onValueChange={(v) => set(i, { taxCode: v === NONE ? "" : v })}
                  aria-label={t("taxCode")}
                />
              </Field>
              {line.taxCode ? (
                <Field label={t("taxBase")}>
                  <Input
                    value={line.taxBase}
                    list={`amounts-${rule.id}`}
                    className="tabular-nums"
                    maxLength={200}
                    onChange={(e) => set(i, { taxBase: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label={t("lineText")}>
                <Input
                  value={line.description}
                  maxLength={200}
                  onChange={(e) => set(i, { description: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        <datalist id={`amounts-${rule.id}`}>
          {amounts.map((v) => (
            <option key={v.path} value={v.path} label={v.label} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" iconStart="plus" onClick={() => setLines([...lines, emptyLine()])}>
            {t("addLine")}
          </Button>
          <Button variant="ghost" iconStart="undo" onClick={reset}>
            {t("reset")}
          </Button>
        </div>
      </fieldset>
      <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
        <Field label={t("effectiveFrom")} required>
          <Input
            type="date"
            value={effectiveFrom}
            min={todayInBangkok()}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field label={t("reason")} required>
          <Input
            value={reason}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
      {preview ? <PreviewResult preview={preview} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" iconStart="play" loading={trying} onClick={() => void tryIt()}>
          {t("preview")}
        </Button>
        <Button iconStart="send" loading={busy || trying} onClick={() => void submit()}>
          {t("submit")}
        </Button>
        <Button variant="ghost" onClick={() => (setOpen(false), reset())}>
          {tc("cancel")}
        </Button>
      </div>
    </div>
  );
}

/** D-398: approve / reject (another person) or withdraw (the proposer) a waiting version. */
export function RuleVersionActions({ ruleId, version: v }: { ruleId: string; version: Version }) {
  const t = useTranslations("partnerLedger.rules");
  const tc = useTranslations("partnerLedger.common");
  const format = useFormat();
  const path = (action: string) => `/ledger/rules/{ruleId}/versions/{versionId}/actions/${action}`;
  const params = { ruleId, versionId: v.id };
  return (
    <SalesActions
      offered={v.nextActions}
      actions={[
        {
          key: "erp_rule_version.approve",
          kind: "post",
          path: path("approve"),
          params,
          title: t("approveTitle", { n: v.versionNo }),
          description: t("approveBody", { date: format.date(v.effectiveFrom) }),
          body: () => ({}),
          done: t("approveDone"),
          primary: true,
        },
        {
          key: "erp_rule_version.reject",
          kind: "post",
          path: path("reject"),
          params,
          title: t("rejectTitle", { n: v.versionNo }),
          description: t("rejectBody"),
          reason: { label: tc("noteLabel") },
          body: (note: string) => ({ note }),
          done: t("rejectDone"),
        },
        {
          key: "erp_rule_version.withdraw",
          kind: "post",
          path: path("withdraw"),
          params,
          title: t("withdrawTitle", { n: v.versionNo }),
          description: t("withdrawBody"),
          body: () => ({}),
          done: t("withdrawDone"),
        },
      ]}
    />
  );
}
