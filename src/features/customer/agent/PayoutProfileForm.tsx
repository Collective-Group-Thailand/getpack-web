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

import { BANK_CODES } from "./banks";

type Mine = Schemas["MyPayoutProfileDto"];
type Upload = { name: string; fileId?: string; failed?: boolean };

/**
 * D-466 step 2 — the payout profile: the legal name and tax id the withholding certificate carries, the address,
 * an identity document and the bank account in the same name (`agents.bank_name_mismatch` otherwise). Saved as a
 * draft (`store.agentPayoutProfile.upsert`, If-Match once it exists), then sent to Finance
 * (`store.agentPayoutProfile.submit`). The full account number never comes back — only its last four digits.
 */
export function PayoutProfileForm({ mine, etag }: { mine: Mine; etag: string | null }) {
  const t = useTranslations("agent.apply");
  const tp = useTranslations("agent.payout");
  const router = useRouter();
  const profile = mine.profile;
  const juristic = mine.juristicType;
  const [form, setForm] = useState({
    legalName: profile?.legalName ?? "",
    taxId: profile?.taxId ?? "",
    branchCode: profile?.branchCode ?? "00000",
    address: profile?.address ?? "",
    postcode: profile?.postcode ?? "",
    bankCode: profile?.bankCode ?? "014",
    bankAccountName: profile?.bankAccountName ?? "",
    bankAccountNo: "",
    bankBranchName: profile?.bankBranchName ?? "",
  });
  const [vat, setVat] = useState(profile?.isVatRegistered ?? false);
  const [idDocument, setIdDocument] = useState<Upload | null>(
    profile?.idDocument ? { name: profile.idDocument.originalName, fileId: profile.idDocument.id } : null,
  );
  const [bankBook, setBankBook] = useState<Upload | null>(
    profile?.bankBook ? { name: profile.bankBook.originalName, fileId: profile.bankBook.id } : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const locked = profile?.status === "submitted";

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
    if (juristic !== "individual" && !/^\d{5}$/.test(form.branchCode)) found.branchCode = tp("errors.branchCode");
    if (form.address.trim().length < 10) found.address = t("errors.address");
    if (!/^\d{5}$/.test(form.postcode)) found.postcode = t("errors.postcode");
    if (form.bankAccountName.trim().length < 2) found.bankAccountName = t("errors.bankAccountName");
    const digits = form.bankAccountNo.replace(/[^0-9]/g, "");
    const hasAccount = Boolean(profile?.bankAccountNoLast4);
    if (!(hasAccount && digits.length === 0) && (digits.length < 6 || digits.length > 15))
      found.bankAccountNo = t("errors.bankAccountNo");
    if (!idDocument?.fileId) found.idDocument = t("errors.idDocument");
    return found;
  }

  async function save(andSubmit: boolean) {
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) {
      document.getElementById("payout-errors")?.focus();
      return;
    }
    setBusy(andSubmit ? "submit" : "save");
    try {
      const api = browserApi();
      const saved = await api.PUT("/v1/store/agent/payout-profile", {
        params: { header: etag ? { "If-Match": etag } : {} },
        body: {
          legalName: form.legalName.trim(),
          taxId: form.taxId,
          branchCode: juristic === "individual" ? "00000" : form.branchCode,
          isVatRegistered: juristic === "individual" ? false : vat,
          address: form.address.trim(),
          postcode: form.postcode,
          idDocumentFileId: idDocument?.fileId ?? null,
          bankCode: form.bankCode,
          bankBranchName: form.bankBranchName.trim() || null,
          bankAccountName: form.bankAccountName.trim(),
          ...(form.bankAccountNo ? { bankAccountNo: form.bankAccountNo } : {}),
          bankBookFileId: bankBook?.fileId ?? null,
        },
      });
      if (andSubmit) {
        await api.POST("/v1/store/agent/payout-profile/actions/submit", {
          params: { header: { "If-Match": saved.response.headers.get("ETag") ?? "" } },
        });
      }
      router.refresh();
      setBusy(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : tp("failed"));
      setBusy(null);
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
      {locked ? null : (
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
      )}
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
    <form noValidate onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-8">
      {messages.length ? (
        <div id="payout-errors" tabIndex={-1} role="alert" className="outline-none">
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

      <fieldset disabled={locked} className="flex flex-col gap-8">
        <FormSection title={t("who")} description={tp("whoIntro", { type: t(`juristicTypes.${juristic}`) })}>
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
              autoComplete="off"
              onChange={(e) => set("taxId")(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </Field>
          {juristic !== "individual" ? (
            <>
              <Field label={tp("branchCode")} hint={tp("branchCodeHint")} error={errors.branchCode} className="w-40">
                <Input
                  value={form.branchCode}
                  inputMode="numeric"
                  maxLength={5}
                  onChange={(e) => set("branchCode")(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </Field>
              <Checkbox label={t("vatRegistered")} checked={vat} onCheckedChange={(on) => setVat(on === true)} />
            </>
          ) : null}
          <Field label={t("address")} hint={t("addressHint")} error={errors.address} required>
            <Textarea rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </Field>
          <Field label={t("postcode")} error={errors.postcode} required className="w-40">
            <Input
              value={form.postcode}
              inputMode="numeric"
              maxLength={5}
              autoComplete="postal-code"
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
          <Field label={t("bankAccountName")} hint={tp("bankNameHint")} error={errors.bankAccountName} required>
            <Input value={form.bankAccountName} onChange={(e) => set("bankAccountName")(e.target.value)} />
          </Field>
          <Field
            label={t("bankAccountNo")}
            hint={profile?.bankAccountNoLast4 ? tp("accountKept", { last4: profile.bankAccountNoLast4 }) : undefined}
            error={errors.bankAccountNo}
            required={!profile?.bankAccountNoLast4}
          >
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
      </fieldset>

      {locked ? null : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            loading={busy === "submit"}
            disabled={busy !== null}
            onClick={() => void save(true)}
          >
            {tp("submit")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            loading={busy === "save"}
            disabled={busy !== null}
            onClick={() => void save(false)}
          >
            {tp("saveDraft")}
          </Button>
        </div>
      )}
    </form>
  );
}
