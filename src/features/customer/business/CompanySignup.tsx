"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";

import { isValidThaiTaxId } from "../account/tax-id";

type DocType = "company_certificate" | "vat_registration_pp20" | "signatory_id" | "financial_statement";
type Upload = { name: string; fileId?: string; failed?: boolean };

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Company sign-up (D-120): the company, who signs for it, and the KYC documents — the company
 * certificate (issued within 6 months, date asked for), ภ.พ.20 when VAT-registered, and the
 * signatory's ID. Finance reviews them; ordering prepaid works meanwhile.
 */
export function CompanySignup({ phone: initialPhone }: { phone: string }) {
  const t = useTranslations("business.apply");
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: "",
    taxId: "",
    address: "",
    signatory: "",
    position: "",
    phone: initialPhone,
  });
  const [vat, setVat] = useState(true);
  const [issuedOn, setIssuedOn] = useState("");
  const [docs, setDocs] = useState<Partial<Record<DocType, Upload>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function attach(docType: DocType, file: File) {
    setDocs((current) => ({ ...current, [docType]: { name: file.name } }));
    try {
      const uploaded = await uploadFile("customer", file, "document");
      setDocs((current) => ({ ...current, [docType]: { name: file.name, fileId: uploaded.id } }));
    } catch {
      setDocs((current) => ({ ...current, [docType]: { name: file.name, failed: true } }));
    }
  }

  const needed: DocType[] = [
    "company_certificate",
    ...(vat ? (["vat_registration_pp20"] as const) : []),
    "signatory_id",
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (form.legalName.trim().length < 2) found.legalName = t("errors.legalName");
    if (!isValidThaiTaxId(form.taxId)) found.taxId = t("errors.taxId");
    if (form.address.trim().length < 10) found.address = t("errors.address");
    if (!form.signatory.trim()) found.signatory = t("errors.signatory");
    if (!form.position.trim()) found.position = t("errors.position");
    if (!/^0\d{8,9}$/.test(form.phone)) found.phone = t("errors.phone");
    if (!issuedOn) found.issuedOn = t("errors.issuedOn");
    for (const docType of needed)
      if (!docs[docType]?.fileId) found[docType] = t("errors.document", { name: t(`documents.${docType}`) });
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) {
      document.getElementById("apply-errors")?.focus();
      return;
    }
    setBusy(true);
    try {
      await browserRequests().call("POST /v1/store/companies", {
        body: {
          legalName: form.legalName.trim(),
          taxId: form.taxId,
          isVatRegistered: vat,
          headOffice: { address: form.address.trim() },
          signatory: { name: form.signatory.trim(), position: form.position.trim() },
          contactPhone: form.phone,
          documents: (Object.entries(docs) as [DocType, Upload][])
            .filter(([docType, upload]) => upload.fileId && (docType !== "vat_registration_pp20" || vat))
            .map(([docType, upload]) => ({
              docType,
              fileId: upload.fileId!,
              ...(docType === "company_certificate" ? { issuedOn } : {}),
            })),
        },
        idempotencyKey: key.current,
      });
      router.push("/business?applied=1");
      router.refresh();
    } catch (error) {
      key.current = newKey();
      setFailure(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  }

  const documentField = (docType: DocType, extra?: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" id={`doc-${docType}`}>
        {t(`documents.${docType}`)}
      </p>
      <p className="text-muted text-xs">{t(`documentHints.${docType}`)}</p>
      <FileDropzone
        accept="application/pdf,image/jpeg,image/png"
        maxBytes={20_000_000}
        onFiles={(files) => files[0] && void attach(docType, files[0])}
        labels={{
          prompt: t("drop"),
          browse: t("browse"),
          hint: t("fileHint"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      {docs[docType] ? (
        <p className={`text-sm ${docs[docType]!.failed ? "text-danger" : ""}`} aria-live="polite">
          {docs[docType]!.failed
            ? t("uploadFailed", { name: docs[docType]!.name })
            : docs[docType]!.fileId
              ? t("uploaded", { name: docs[docType]!.name })
              : t("uploading", { name: docs[docType]!.name })}
        </p>
      ) : null}
      {errors[docType] ? <p className="text-danger text-xs">{errors[docType]}</p> : null}
      {extra}
    </div>
  );

  const messages = Object.values(errors);

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-3xl flex-col gap-8">
      {messages.length > 0 ? (
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

      <FormSection title={t("company")}>
        <Field
          label={t("legalName")}
          hint={t("legalNameHint")}
          required
          requiredLabel={t("required")}
          error={errors.legalName}
        >
          <Input
            autoComplete="organization"
            value={form.legalName}
            onChange={(event) => set("legalName")(event.target.value)}
          />
        </Field>
        <Field label={t("taxId")} hint={t("taxIdHint")} required requiredLabel={t("required")} error={errors.taxId}>
          <Input
            inputMode="numeric"
            maxLength={13}
            value={form.taxId}
            onChange={(event) => set("taxId")(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Checkbox checked={vat} onCheckedChange={(value) => setVat(value === true)} label={t("vat")} />
        <Field label={t("address")} required requiredLabel={t("required")} error={errors.address}>
          <Textarea rows={3} value={form.address} onChange={(event) => set("address")(event.target.value)} />
        </Field>
      </FormSection>

      <FormSection title={t("signatoryTitle")} description={t("signatoryIntro")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("signatory")} required requiredLabel={t("required")} error={errors.signatory}>
            <Input
              autoComplete="name"
              value={form.signatory}
              onChange={(event) => set("signatory")(event.target.value)}
            />
          </Field>
          <Field label={t("position")} required requiredLabel={t("required")} error={errors.position}>
            <Input value={form.position} onChange={(event) => set("position")(event.target.value)} />
          </Field>
        </div>
        <Field label={t("phone")} required requiredLabel={t("required")} error={errors.phone}>
          <PhoneInput value={form.phone} onChange={set("phone")} />
        </Field>
      </FormSection>

      <FormSection title={t("kyc")} description={t("kycIntro")}>
        {documentField(
          "company_certificate",
          <Field
            label={t("issuedOn")}
            hint={t("issuedOnHint")}
            required
            requiredLabel={t("required")}
            error={errors.issuedOn}
          >
            <Input
              type="date"
              value={issuedOn}
              onChange={(event) => setIssuedOn(event.target.value)}
              className="max-w-48"
            />
          </Field>,
        )}
        {vat ? documentField("vat_registration_pp20") : null}
        {documentField("signatory_id")}
      </FormSection>

      <Button type="submit" className="self-start" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
