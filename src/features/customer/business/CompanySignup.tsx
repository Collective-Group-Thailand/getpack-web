"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { PostcodeAreaField, type ChosenArea } from "@/features/customer/account/PostcodeArea";
import { isValidThaiTaxId } from "@/features/customer/account/tax-id";
import { uploadFile } from "@/features/shared/files/upload";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";

type DocType = Extract<Schemas["CompanyKycDocType"], "company_certificate" | "vat_registration_pp20" | "signatory_id">;
type Upload = { name: string; fileId?: string; failed?: boolean };

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Company sign-up (D-120, D-121), in the API's three steps: the company with its head office and
 * signatory (`store.companies.apply`, which makes me its Company Admin), each KYC document
 * (`store.companies.addKycDocument`, files uploaded as `evidence`), then the application sent for
 * review (`store.companies.submitKyc`). The head office starts from its postcode, which gives the
 * province and sub-district ids it is filed under. A step that fails is retried from where it
 * stopped: the company and the documents already filed are not sent twice.
 */
export function CompanySignup({ phone: initialPhone }: { phone: string }) {
  const t = useTranslations("business.apply");
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: "",
    taxId: "",
    line1: "",
    line2: "",
    signatory: "",
    position: "",
    phone: initialPhone,
  });
  const [postcode, setPostcode] = useState("");
  const [area, setArea] = useState<ChosenArea | null>(null);
  const [vat, setVat] = useState(true);
  const [issuedOn, setIssuedOn] = useState("");
  const [docs, setDocs] = useState<Partial<Record<DocType, Upload>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  /** What the API already holds: the company once created, and the files already filed. */
  const companyId = useRef<string | null>(null);
  const filed = useRef(new Set<string>());
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function attach(docType: DocType, file: File) {
    setDocs((current) => ({ ...current, [docType]: { name: file.name } }));
    try {
      const uploaded = await uploadFile("customer", file, "evidence");
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

  function check(): Record<string, string> {
    const found: Record<string, string> = {};
    if (form.legalName.trim().length < 2) found.legalName = t("errors.legalName");
    if (!isValidThaiTaxId(form.taxId)) found.taxId = t("errors.taxId");
    if (form.line1.trim().length < 3) found.line1 = t("errors.address");
    if (!/^\d{5}$/.test(postcode)) found.postcode = t("errors.postcode");
    else if (!area) found.subdistrict = t("errors.subdistrict");
    if (!form.signatory.trim()) found.signatory = t("errors.signatory");
    if (!form.position.trim()) found.position = t("errors.position");
    if (!/^0\d{8,9}$/.test(form.phone)) found.phone = t("errors.phone");
    if (!issuedOn) found.issuedOn = t("errors.issuedOn");
    for (const docType of needed)
      if (!docs[docType]?.fileId) found[docType] = t("errors.document", { name: t(`documents.${docType}`) });
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || !area) {
      document.getElementById("apply-errors")?.focus();
      return;
    }
    setBusy(true);
    const api = browserApi();
    try {
      if (!companyId.current) {
        const { data } = await api.POST("/v1/store/companies", {
          params: { header: { "Idempotency-Key": key.current } },
          body: {
            legalName: form.legalName.trim(),
            taxId: form.taxId,
            isVatRegistered: vat,
            headOffice: {
              name: t("headOfficeName"),
              line1: form.line1.trim(),
              line2: form.line2.trim() || null,
              postcode: area.postcode,
              provinceId: area.provinceId,
              subdistrictId: area.subdistrictId,
            },
            signatory: { name: form.signatory.trim(), position: form.position.trim() },
            contactPhone: form.phone,
          },
        });
        companyId.current = data!.id;
      }
      const id = companyId.current;
      for (const docType of needed) {
        const fileId = docs[docType]!.fileId!;
        if (filed.current.has(fileId)) continue;
        await api.POST("/v1/store/companies/{companyId}/kyc-documents", {
          params: { path: { companyId: id } },
          body: { docType, fileId, issuedOn: docType === "company_certificate" ? issuedOn : null },
        });
        filed.current.add(fileId);
      }
      await api.POST("/v1/store/companies/{companyId}/actions/submit-kyc", { params: { path: { companyId: id } } });
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
      </FormSection>

      <FormSection title={t("address")} description={t("addressIntro")}>
        <PostcodeAreaField
          idPrefix="head-office"
          postcode={postcode}
          subdistrictId={area?.subdistrictId ?? ""}
          errors={{ postcode: errors.postcode, subdistrict: errors.subdistrict }}
          onChange={(next) => {
            setPostcode(next.postcode);
            setArea(next.area);
          }}
        />
        <Field label={t("line1")} hint={t("line1Hint")} required requiredLabel={t("required")} error={errors.line1}>
          <Input
            autoComplete="address-line1"
            value={form.line1}
            onChange={(event) => set("line1")(event.target.value)}
          />
        </Field>
        <Field label={t("line2")}>
          <Input
            autoComplete="address-line2"
            value={form.line2}
            onChange={(event) => set("line2")(event.target.value)}
          />
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
