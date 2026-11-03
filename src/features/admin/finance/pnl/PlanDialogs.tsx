"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { newIdempotencyKey } from "@/lib/api/client";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage } from "../../console";
import { usePnlFormat } from "./format";
import { PNL_SCENARIOS, type PnlPlan, type PnlScenario } from "./resources";

/**
 * Create a plan (D-472 `admin.pnl.createPlan`): name, calendar year, scenario, an optional note. The API computes it at
 * once; the planner then opens it.
 */
export function CreatePlanDialog({
  open,
  onOpenChange,
  year,
  scenario,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  scenario: PnlScenario;
  onCreated: (plan: PnlPlan) => void;
}) {
  const t = useTranslations("finance.pnl.create");
  const tScenario = useTranslations("finance.pnl.header.scenarios");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(year));
  const [chosen, setChosen] = useState<PnlScenario>(scenario);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; year?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (!/^\d{4}$/.test(fiscalYear.trim())) next.year = t("yearInvalid");
    setErrors(next);
    if (next.name || next.year) return;
    setBusy(true);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/finance/pnl/plans", {
        body: {
          name: name.trim(),
          fiscalYear: Number(fiscalYear.trim()),
          scenario: chosen,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      toast.success(t("created"));
      onCreated(data!);
      setName("");
      setNote("");
    } catch (error) {
      setErrors({ form: problemMessage(error, t("failed")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      closeLabel={t("cancel")}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {errors.form ? (
          <Callout tone="danger" live>
            {errors.form}
          </Callout>
        ) : null}
        <Field label={t("name")} error={errors.name} required requiredLabel={tCommon("state.required")}>
          <Input
            value={name}
            maxLength={120}
            placeholder={t("namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("year")}
            hint={t("yearHint")}
            error={errors.year}
            required
            requiredLabel={tCommon("state.required")}
          >
            <Input
              inputMode="numeric"
              value={fiscalYear}
              maxLength={4}
              onChange={(event) => setFiscalYear(event.target.value)}
            />
          </Field>
          <Field label={t("scenario")}>
            <NativeSelect
              value={chosen}
              onValueChange={setChosen}
              options={PNL_SCENARIOS.map((value) => ({ value, label: tScenario(value) }))}
            />
          </Field>
        </div>
        <Field label={t("note")} hint={t("noteHint")}>
          <Textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy} iconStart="calculator">
            {t("submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Copy a plan to a scenario (D-472 `admin.pnl.copyPlan`): a new draft with the entered and overridden values. */
export function CopyPlanDialog({
  plan,
  open,
  onOpenChange,
  scenario,
  onCopied,
}: {
  plan: PnlPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: PnlScenario;
  onCopied: (plan: PnlPlan) => void;
}) {
  const t = useTranslations("finance.pnl.copyDialog");
  const tScenario = useTranslations("finance.pnl.header.scenarios");
  const firstOther = PNL_SCENARIOS.find((value) => value !== plan.scenario)!;
  const [chosen, setChosen] = useState<PnlScenario>(scenario ?? firstOther);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/finance/pnl/plans/{planId}/actions/copy", {
        params: { path: { planId: plan.id } },
        body: {
          scenario: chosen,
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      toast.success(t("copied"));
      onCopied(data!);
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { name: plan.name })}
      closeLabel={t("cancel")}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {error ? (
          <Callout tone="danger" live>
            {error}
          </Callout>
        ) : null}
        <Field label={t("scenario")}>
          <NativeSelect
            value={chosen}
            onValueChange={setChosen}
            options={PNL_SCENARIOS.map((value) => ({ value, label: tScenario(value) }))}
          />
        </Field>
        <Field label={t("name")} hint={t("nameHint")}>
          <Input
            value={name}
            maxLength={120}
            placeholder={plan.name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t("note")}>
          <Textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy} iconStart="copy">
            {t("submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Lock a plan (D-472 `admin.pnl.lockPlan`): final — a revision is a copy. Sent with the plan's ETag as `If-Match` and
 * one `Idempotency-Key` per confirmation (made when the dialog opens, reused on a retry).
 */
export function LockPlanDialog({
  plan,
  emptyManualCells,
  open,
  onOpenChange,
  onLocked,
}: {
  plan: PnlPlan;
  emptyManualCells: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocked: (plan: PnlPlan) => void;
}) {
  const t = useTranslations("finance.pnl.lockDialog");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const format = usePnlFormat();

  const lock = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/finance/pnl/plans/{planId}/actions/lock", {
        params: { path: { planId: plan.id }, header: { "If-Match": plan.etag, "Idempotency-Key": key } },
      });
      toast.success(t("locked"));
      onLocked(data!);
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setKey(newIdempotencyKey());
        setError(null);
        onOpenChange(next);
      }}
      title={t("title", { name: `${plan.name} (${format.year(plan.fiscalYear)})` })}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={lock}
      loading={busy}
    >
      {emptyManualCells > 0 || error ? (
        <div className="mt-4 flex flex-col gap-2">
          {emptyManualCells > 0 ? (
            <Callout tone="warning" icon="edit">
              {t("emptyManual", { count: emptyManualCells })}
            </Callout>
          ) : null}
          {error ? (
            <Callout tone="danger" live>
              {error}
            </Callout>
          ) : null}
        </div>
      ) : null}
    </AlertDialog>
  );
}
