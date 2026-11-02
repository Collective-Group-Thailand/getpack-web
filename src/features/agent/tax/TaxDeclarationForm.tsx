"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useRouter } from "next/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/** ล.ย.01 allowance groups as the Revenue Department's form orders them (D-465). */
const GROUPS = {
  family: ["spouse", "children", "parents", "disabledDependants"],
  savings: [
    "lifeInsurance",
    "healthInsurance",
    "parentsHealthInsurance",
    "pensionInsurance",
    "providentFund",
    "rmf",
    "ssf",
    "thaiEsg",
    "socialSecurity",
  ],
  housing: ["homeLoanInterest"],
  donations: ["donations", "educationDonations"],
} as const;

type AllowanceKey = (typeof GROUPS)[keyof typeof GROUPS][number];
type Upload = { key: string; name: string; fileId?: string; failed?: boolean };

/** Amounts are validated as text and sent as decimal strings — the web adds nothing up (D-465). */
const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * The agent's ล.ย.01 for the current tax year (D-465): amounts by group with evidence; Finance checks it before
 * the progressive withholding uses it. Without one, only the personal allowance applies.
 */
export function TaxDeclarationForm({
  initial,
  locked,
}: {
  /** The last declaration's amounts, to start a new one from. */
  initial: Partial<Record<AllowanceKey, string>>;
  /** A declaration is waiting for Finance: nothing can be sent until it is decided. */
  locked: boolean;
}) {
  const t = useTranslations("agent.tax");
  const tApply = useTranslations("agent.apply");
  const router = useRouter();
  const [values, setValues] = useState<Partial<Record<AllowanceKey, string>>>(initial);
  const [files, setFiles] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<Partial<Record<AllowanceKey | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  async function attach(file: File) {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setFiles((current) => [...current, { key, name: file.name }]);
    try {
      const uploaded = await uploadFile("agent", file, "evidence");
      setFiles((current) => current.map((f) => (f.key === key ? { ...f, fileId: uploaded.id } : f)));
    } catch {
      setFiles((current) => current.map((f) => (f.key === key ? { ...f, failed: true } : f)));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    const allowances: Record<string, string> = {};
    for (const [key, raw] of Object.entries(values)) {
      const value = (raw ?? "").replace(/,/g, "").trim();
      if (!value) continue;
      if (!AMOUNT.test(value)) next[key as AllowanceKey] = t("invalidAmount");
      else allowances[key] = value;
    }
    if (Object.keys(next).length === 0 && Object.keys(allowances).length === 0) next.form = t("nothing");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/tax-declaration", {
        body: {
          allowances,
          evidenceFileIds: files.flatMap((f) => (f.fileId ? [f.fileId] : [])),
        },
      });
      toast.success(t("sent"));
      setFiles([]);
      router.refresh();
    } catch (error) {
      setErrors({ form: isApiError(error) ? error.detail : t("failed") });
    } finally {
      setBusy(false);
    }
  }

  const uploading = files.some((f) => !f.fileId && !f.failed);
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
        <fieldset key={group} className="border-border rounded-card border p-4 sm:p-5" disabled={locked || busy}>
          <legend className="px-1 text-base font-semibold">{t(`groups.${group}`)}</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {GROUPS[group].map((key) => (
              <Field key={key} label={t(`fields.${key}`)} hint={t("amountHint")} error={errors[key]}>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[key] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      ))}

      <section className="flex flex-col gap-2" aria-labelledby="tax-evidence">
        <h2 id="tax-evidence" className="text-base font-semibold">
          {t("evidence")}
        </h2>
        <p className="text-muted text-sm">{t("evidenceHint")}</p>
        {locked ? null : (
          <FileDropzone
            accept="application/pdf,image/jpeg,image/png"
            maxBytes={20_000_000}
            multiple
            onFiles={(picked) => picked.forEach((file) => void attach(file))}
            labels={{
              prompt: tApply("drop"),
              browse: tApply("browse"),
              hint: tApply("fileHint"),
              tooLarge: (name) => tApply("tooLarge", { name }),
              wrongType: (name) => tApply("wrongType", { name }),
            }}
          />
        )}
        {files.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
            {files.map((f) => (
              <li key={f.key} className={f.failed ? "text-danger" : ""}>
                {f.failed
                  ? tApply("uploadFailed", { name: f.name })
                  : f.fileId
                    ? tApply("uploaded", { name: f.name })
                    : tApply("uploading", { name: f.name })}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {errors.form ? <Callout tone="danger" title={errors.form} /> : null}
      {locked ? (
        <Callout tone="info" title={t("waiting")} />
      ) : (
        <div>
          <Button type="submit" loading={busy} disabled={uploading}>
            {t("submit")}
          </Button>
        </div>
      )}
    </form>
  );
}
