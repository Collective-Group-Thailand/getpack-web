"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidThaiTaxId } from "@/features/customer/account/tax-id";
import { uploadFile } from "@/features/shared/files/upload";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { BANK_CODES } from "./banks";

type Juristic = Schemas["JuristicType"];
type Upload = { name: string; fileId?: string; failed?: boolean };
type Agreement = NonNullable<Schemas["AgentProgrammeDto"]["agreement"]>;

/**
 * Applying to become a sales agent (D-416): who I am for tax (an individual with a citizen id, or a
 * juristic person with its tax id), where to pay me, an identity document, and the agent agreement
 * read and accepted. Files upload as `evidence` as they are added; the application itself is one call
 * (`store.agent.apply`) that records the acceptance with its evidence.
 */
export function ApplyForm({ agreement, defaultName }: { agreement: Agreement; defaultName: string }) {
  const t = useTranslations("agent.apply");
  const router = useRouter();
  const [juristic, setJuristic] = useState<Juristic>("individual");
  const [form, setForm] = useState({
    legalName: defaultName,
    taxId: "",
    address: "",
    postcode: "",
    pitch: "",
    bankCode: "014",
    bankAccountName: defaultName,
    bankAccountNo: "",
    bankBranchName: "",
  });
  const [vat, setVat] = useState(false);
  const [idDocument, setIdDocument] = useState<Upload | null>(null);
  const [bankBook, setBankBook] = useState<Upload | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function attach(file: File, put: (u: Upload | null) => void) {
    put({ name: file.name });
    try {
      const uploaded = await uploadFile("customer", file, "evidence");
      put({ name: file.name, fileId: uploaded.id });
    } catch {
      put({ name: file.name, failed: true });
    }
  }

  function check(): Record<string, string> {
    const found: Record<string, string> = {};
    if (form.legalName.trim().length < 2) found.legalName = t("errors.legalName");
    if (!isValidThaiTaxId(form.taxId)) found.taxId = t("errors.taxId");
    if (form.address.trim().length < 10) found.address = t("errors.address");
    if (!/^\d{5}$/.test(form.postcode)) found.postcode = t("errors.postcode");
    if (form.bankAccountName.trim().length < 2) found.bankAccountName = t("errors.bankAccountName");
    const digits = form.bankAccountNo.replace(/[^0-9]/g, "");
    if (digits.length < 6 || digits.length > 15) found.bankAccountNo = t("errors.bankAccountNo");
    if (!idDocument?.fileId) found.idDocument = t("errors.idDocument");
    if (!accepted) found.agreement = t("errors.agreement");
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) {
      document.getElementById("apply-errors")?.focus();
      return;
    }
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/application", {
        body: {
          juristicType: juristic,
          legalName: form.legalName.trim(),
          taxId: form.taxId,
          isVatRegistered: juristic === "individual" ? false : vat,
          address: form.address.trim(),
          postcode: form.postcode,
          pitch: form.pitch.trim() || null,
          idDocumentFileId: idDocument!.fileId!,
          bankCode: form.bankCode,
          bankBranchName: form.bankBranchName.trim() || null,
          bankAccountName: form.bankAccountName.trim(),
          bankAccountNo: form.bankAccountNo,
          bankBookFileId: bankBook?.fileId ?? null,
          agreementVersionNo: agreement.versionNo,
        },
      });
      router.refresh();
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  }

  const upload = (
    label: string,
    hint: string,
    value: Upload | null,
    put: (u: Upload | null) => void,
    error?: string,
  ) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted text-xs">{hint}</p>
      <FileDropzone
        accept="application/pdf,image/jpeg,image/png"
        maxBytes={20_000_000}
        onFiles={(files) => files[0] && void attach(files[0], put)}
        labels={{
          prompt: t("drop"),
          browse: t("browse"),
          hint: t("fileHint"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      {value ? (
        <p className={`text-sm ${value.failed ? "text-danger" : ""}`} aria-live="polite">
          {value.failed
            ? t("uploadFailed", { name: value.name })
            : value.fileId
              ? t("uploaded", { name: value.name })
              : t("uploading", { name: value.name })}
        </p>
      ) : null}
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );

  const messages = Object.values(errors);
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-3xl flex-col gap-8">
      {messages.length ? (
        <div id="apply-errors" tabIndex={-1} role="alert" className="outline-none">
          <Callout tone="danger" title={t("errors.title", { count: messages.length })}>
            <ul className="list-disc ps-5">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}

      <FormSection title={t("who")}>
        <SegmentedControl
          label={t("juristic")}
          value={juristic}
          onValueChange={(value) => setJuristic(value as Juristic)}
          options={(["individual", "company", "partnership"] as const).map((value) => ({
            value,
            label: t(`juristicTypes.${value}`),
          }))}
        />
        <Field label={t("legalName")} hint={t("legalNameHint")} error={errors.legalName} required>
          <Input value={form.legalName} onChange={(e) => set("legalName")(e.target.value)} autoComplete="name" />
        </Field>
        <Field
          label={juristic === "individual" ? t("citizenId") : t("taxId")}
          hint={t("taxIdHint")}
          error={errors.taxId}
          required
        >
          <Input
            value={form.taxId}
            inputMode="numeric"
            maxLength={13}
            onChange={(e) => set("taxId")(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
        {juristic !== "individual" ? (
          <Checkbox label={t("vatRegistered")} checked={vat} onCheckedChange={(on) => setVat(on === true)} />
        ) : null}
        <Field label={t("address")} hint={t("addressHint")} error={errors.address} required>
          <Textarea rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} />
        </Field>
        <Field label={t("postcode")} error={errors.postcode} required className="w-40">
          <Input
            value={form.postcode}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => set("postcode")(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
        {upload(t("idDocument"), t("idDocumentHint"), idDocument, setIdDocument, errors.idDocument)}
      </FormSection>

      <FormSection title={t("payment")} description={t("paymentIntro")}>
        <Field label={t("bank")} required>
          <SearchableSelect
            value={form.bankCode}
            onValueChange={set("bankCode")}
            options={BANK_CODES.map((code) => ({ value: code, label: t(`banks.${code}`) }))}
          />
        </Field>
        <Field label={t("bankAccountName")} hint={t("bankAccountNameHint")} error={errors.bankAccountName} required>
          <Input value={form.bankAccountName} onChange={(e) => set("bankAccountName")(e.target.value)} />
        </Field>
        <Field label={t("bankAccountNo")} error={errors.bankAccountNo} required>
          <Input
            value={form.bankAccountNo}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => set("bankAccountNo")(e.target.value.replace(/[^0-9-]/g, ""))}
          />
        </Field>
        <Field label={t("bankBranch")}>
          <Input value={form.bankBranchName} onChange={(e) => set("bankBranchName")(e.target.value)} />
        </Field>
        {upload(t("bankBook"), t("bankBookHint"), bankBook, setBankBook)}
      </FormSection>

      <FormSection title={t("aboutYou")}>
        <Field label={t("pitch")} hint={t("pitchHint")}>
          <Textarea rows={3} value={form.pitch} onChange={(e) => set("pitch")(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title={t("agreement", { version: agreement.versionNo })}>
        <div
          className="border-border bg-surface max-h-80 overflow-y-auto rounded-xl border p-4 text-sm whitespace-pre-line"
          tabIndex={0}
          aria-label={t("agreement", { version: agreement.versionNo })}
        >
          {agreement.textTh}
        </div>
        <Checkbox label={t("accept")} checked={accepted} onCheckedChange={(on) => setAccepted(on === true)} />
        {errors.agreement ? <p className="text-danger text-xs">{errors.agreement}</p> : null}
      </FormSection>

      <div>
        <Button type="submit" size="lg" loading={busy}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
