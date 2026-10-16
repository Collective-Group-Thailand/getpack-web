"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidThaiTaxId } from "@/domain/tax-id";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokToday, useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { Select } from "@/features/partner/select";
import { toast } from "@/ui/components/Toast";

type Step = Schemas["OnboardingStep"];
type Errors = Record<string, string>;

/** Field errors from a `422`, by path, so a form keeps what was typed and says what is wrong. */
function fieldErrors(error: unknown): Errors {
  if (!isApiError(error)) return {};
  return Object.fromEntries(error.errors.map((item) => [item.path, item.message]));
}

/* --------------------------------------------------------------------------- sign-off */

/**
 * Assisted onboarding (D-100 note): getpack staff entered this step for the factory; the owner
 * confirms it is right. Restated in the dialog, because the sign-off is the factory's word.
 */
export function SignOffStep({ step, stepLabel }: { step: Step; stepLabel: string }) {
  const t = useTranslations("partnerOnboarding.signOff");
  const { factoryId, can } = useFactory();
  const [open, setOpen] = useState(false);
  const [refresh] = useRefresh();
  if (!can("factory_onboarding.sign_off")) return <p className="text-muted text-sm">{t("ownerOnly")}</p>;
  return (
    <>
      <Button size="xl" block iconStart="stamp" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title", { step: stepLabel })}
        description={t("body", { step: stepLabel })}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/onboarding-steps/{step}/actions/sign-off", {
              params: { path: { factoryId, step } },
            });
            toast.success(t("done", { step: stepLabel }));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------- company */

type Company = Pick<
  Schemas["FactoryDto"],
  "legalName" | "tradeName" | "juristicType" | "taxId" | "branchCode" | "isVatRegistered" | "vatRegisteredOn"
>;

/** The company as registered (D-011). Editable while applying; the API holds it under `If-Match`. */
export function CompanyForm({ initial, etag }: { initial: Company; etag: string | null }) {
  const t = useTranslations("partnerOnboarding.company");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!value.legalName.trim()) next.legalName = t("legalNameRequired");
    if (!isValidThaiTaxId(value.taxId)) next.taxId = t("taxIdInvalid");
    if (!/^\d{5}$/.test(value.branchCode)) next.branchCode = t("branchCodeInvalid");
    if (value.isVatRegistered && !value.vatRegisteredOn) next.vatRegisteredOn = t("vatDateRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await browserApi().PATCH("/v1/partner/factories/{factoryId}", {
        params: { path: { factoryId }, header: { "If-Match": etag ?? "" } },
        body: {
          legalName: value.legalName.trim(),
          tradeName: value.tradeName?.trim() || null,
          juristicType: value.juristicType,
          taxId: value.taxId,
          branchCode: value.branchCode,
          isVatRegistered: value.isVatRegistered,
          vatRegisteredOn: value.isVatRegistered ? value.vatRegisteredOn : null,
        },
      });
      toast.success(t("saved"));
      refresh();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(isApiError(error) && error.status === 412 ? t("stale") : problemMessage(error, t("failed")));
      if (isApiError(error) && error.status === 412) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("legalName")} required requiredLabel={tCommon("state.required")} error={errors.legalName}>
        <Input
          placeholder={t("legalNamePlaceholder")}
          inputSize="lg"
          value={value.legalName}
          onChange={(event) => setValue({ ...value, legalName: event.target.value })}
        />
      </Field>
      <Field label={t("tradeName")} hint={t("tradeNameHint")}>
        <Input
          placeholder={t("tradeNamePlaceholder")}
          inputSize="lg"
          value={value.tradeName ?? ""}
          onChange={(event) => setValue({ ...value, tradeName: event.target.value })}
        />
      </Field>
      <Field label={t("juristicType")}>
        <Select
          value={value.juristicType}
          onValueChange={(juristicType) => setValue({ ...value, juristicType })}
          options={(["company", "partnership", "individual"] as const).map((key) => ({
            value: key,
            label: t(`juristic.${key}`),
          }))}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("taxId")}
          hint={t("taxIdHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.taxId}
        >
          <Input
            placeholder={t("taxIdPlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            autoComplete="off"
            maxLength={13}
            value={value.taxId}
            onChange={(event) => setValue({ ...value, taxId: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label={t("branchCode")} hint={t("branchCodeHint")} error={errors.branchCode}>
          <Input
            placeholder={t("branchCodePlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            maxLength={5}
            value={value.branchCode}
            onChange={(event) => setValue({ ...value, branchCode: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
      </div>
      <Checkbox
        label={t("vatRegistered")}
        description={t("vatRegisteredHint")}
        checked={value.isVatRegistered}
        onCheckedChange={(checked) => setValue({ ...value, isVatRegistered: checked === true })}
      />
      {value.isVatRegistered ? (
        <Field label={t("vatRegisteredOn")} error={errors.vatRegisteredOn}>
          <Input
            type="date"
            inputSize="lg"
            max={bangkokToday()}
            value={value.vatRegisteredOn ?? ""}
            onChange={(event) => setValue({ ...value, vatRegisteredOn: event.target.value || null })}
          />
        </Field>
      ) : null}
      <Button type="submit" size="xl" loading={busy} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ addresses, contacts */

export function AddressForm() {
  const t = useTranslations("partnerOnboarding.addresses");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const empty = { kind: "registered" as Schemas["FactoryAddressKind"], line1: "", line2: "", postcode: "" };
  const [value, setValue] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!value.line1.trim()) return setErrors({ line1: t("line1Required") });
    if (value.postcode && !/^\d{5}$/.test(value.postcode)) return setErrors({ postcode: t("postcodeInvalid") });
    setBusy(true);
    try {
      await browserApi().POST("/v1/partner/factories/{factoryId}/addresses", {
        params: { path: { factoryId } },
        body: {
          kind: value.kind,
          line1: value.line1.trim(),
          line2: value.line2.trim() || null,
          postcode: value.postcode || null,
        },
      });
      setValue(empty);
      setErrors({});
      toast.success(t("added"));
      refresh();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void add(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("kind")}>
        <Select
          value={value.kind}
          onValueChange={(kind) => setValue({ ...value, kind })}
          options={(["registered", "plant", "pickup"] as const).map((key) => ({
            value: key,
            label: t(`kinds.${key}`),
          }))}
        />
      </Field>
      <Field label={t("line1")} required requiredLabel={tCommon("state.required")} error={errors.line1}>
        <Input
          placeholder={t("line1Placeholder")}
          inputSize="lg"
          value={value.line1}
          onChange={(event) => setValue({ ...value, line1: event.target.value })}
        />
      </Field>
      <Field label={t("line2")}>
        <Input
          placeholder={t("line2Placeholder")}
          inputSize="lg"
          value={value.line2}
          onChange={(event) => setValue({ ...value, line2: event.target.value })}
        />
      </Field>
      <Field label={t("postcode")} error={errors.postcode}>
        <Input
          placeholder={t("postcodePlaceholder")}
          inputSize="lg"
          inputMode="numeric"
          maxLength={5}
          value={value.postcode}
          onChange={(event) => setValue({ ...value, postcode: event.target.value.replace(/\D/g, "") })}
        />
      </Field>
      <Button type="submit" size="xl" variant="secondary" iconStart="plus" loading={busy} className="self-start">
        {t("add")}
      </Button>
    </form>
  );
}

export function ContactForm() {
  const t = useTranslations("partnerOnboarding.contacts");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const empty = { name: "", roleTitle: "", phone: "", email: "", isPrimary: false };
  const [value, setValue] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!value.name.trim()) next.name = t("nameRequired");
    if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) next.email = t("emailInvalid");
    if (value.phone && !/^0\d{8,9}$/.test(value.phone)) next.phone = t("phoneInvalid");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await browserApi().POST("/v1/partner/factories/{factoryId}/contacts", {
        params: { path: { factoryId } },
        body: {
          name: value.name.trim(),
          roleTitle: value.roleTitle.trim() || null,
          phone: value.phone || null,
          email: value.email.trim() || null,
          isPrimary: value.isPrimary,
        },
      });
      setValue(empty);
      toast.success(t("added"));
      refresh();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void add(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("name")} required requiredLabel={tCommon("state.required")} error={errors.name}>
        <Input
          placeholder={t("namePlaceholder")}
          inputSize="lg"
          autoComplete="name"
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </Field>
      <Field label={t("roleTitle")}>
        <Input
          placeholder={t("roleTitlePlaceholder")}
          inputSize="lg"
          value={value.roleTitle}
          onChange={(event) => setValue({ ...value, roleTitle: event.target.value })}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("phone")} error={errors.phone}>
          <Input
            placeholder={t("phonePlaceholder")}
            inputSize="lg"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value.phone}
            onChange={(event) => setValue({ ...value, phone: event.target.value.replace(/[^\d]/g, "") })}
          />
        </Field>
        <Field label={t("email")} error={errors.email}>
          <Input
            placeholder={t("emailPlaceholder")}
            inputSize="lg"
            type="email"
            autoComplete="email"
            value={value.email}
            onChange={(event) => setValue({ ...value, email: event.target.value })}
          />
        </Field>
      </div>
      <Checkbox
        label={t("primary")}
        checked={value.isPrimary}
        onCheckedChange={(checked) => setValue({ ...value, isPrimary: checked === true })}
      />
      <Button type="submit" size="xl" variant="secondary" iconStart="plus" loading={busy} className="self-start">
        {t("add")}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------- submit application */

/** `applied → under_review` (D-011): the Partner team starts reviewing. Once, under `If-Match`. */
export function SubmitApplication({ etag, factoryName }: { etag: string | null; factoryName: string }) {
  const t = useTranslations("partnerOnboarding.submit");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  if (!can("factory_profile.manage")) return null;
  return (
    <div className="flex flex-col gap-3">
      {missing.length ? (
        <ul role="alert" className="text-danger list-disc ps-5 text-sm">
          {missing.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <Button size="xl" block iconStart="send" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body", { name: factoryName })}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/actions/submit-application", {
              params: { path: { factoryId }, header: { "If-Match": etag ?? "" } },
              body: { reason: t("reason") },
            });
            setMissing([]);
            toast.success(t("done"));
            refresh();
          } catch (error) {
            if (isApiError(error) && error.errors.length) setMissing(error.errors.map((item) => item.message));
            toast.error(problemMessage(error, t("failed")));
            if (isApiError(error) && error.status === 412) refresh();
            throw error;
          }
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------------- KYC */

const KYC_TYPES = [
  "company_certificate",
  "vat_registration_pp20",
  "director_id",
  "signatory_id",
  "bank_book",
  "factory_licence",
  "financial_statement",
  "other",
] as const satisfies readonly Schemas["KycDocType"][];

/** A KYC document (D-011): uploaded to storage directly (presign → PUT), then referenced. */
export function KycUpload() {
  const t = useTranslations("partnerOnboarding.kyc");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [docType, setDocType] = useState<Schemas["KycDocType"]>("company_certificate");
  const [file, setFile] = useState<File | null>(null);
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError(t("fileRequired"));
    setError(null);
    setProgress(0);
    try {
      const uploaded = await uploadFile("partner", file, "document", {
        factoryId,
        onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
      });
      await browserApi().POST("/v1/partner/factories/{factoryId}/kyc-documents", {
        params: { path: { factoryId } },
        body: { docType, fileId: uploaded.id, issuedOn: issuedOn || null, expiresOn: expiresOn || null },
      });
      setFile(null);
      setIssuedOn("");
      setExpiresOn("");
      toast.success(t("added"));
      refresh();
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("docType")}>
        <Select
          value={docType}
          onValueChange={setDocType}
          options={KYC_TYPES.map((key) => ({ value: key, label: t(`types.${key}`) }))}
        />
      </Field>
      <Field label={t("file")} hint={t("fileHint")} error={error ?? undefined}>
        <FileDropzone
          accept="application/pdf,image/jpeg,image/png"
          maxBytes={20 * 1024 * 1024}
          onFiles={(files) => setFile(files[0] ?? null)}
          labels={{
            prompt: t("drop"),
            browse: t("browse"),
            hint: t("rules"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
      </Field>
      {file ? <p className="text-sm">{t("chosen", { name: file.name })}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("issuedOn")}>
          <Input
            type="date"
            inputSize="lg"
            max={bangkokToday()}
            value={issuedOn}
            onChange={(event) => setIssuedOn(event.target.value)}
          />
        </Field>
        <Field label={t("expiresOn")}>
          <Input type="date" inputSize="lg" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
        </Field>
      </div>
      <Button type="submit" size="xl" iconStart="upload" loading={progress !== null} className="self-start">
        {progress !== null ? t("uploading", { pct: progress }) : t("upload")}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------------ bank account */

/**
 * A new payout account is never an edit (D-033, D-169): it waits for Finance and a Finance
 * Manager after a logged call-back, and the old one pays until then. High-risk, so the owner
 * retypes the last four digits (design-system.md §4 typed confirmation).
 */
export function BankAccountForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("partnerOnboarding.bank");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState({ bankCode: "", accountNo: "", accountName: defaultName, branchName: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const digits = value.accountNo.replace(/[\s-]/g, "");

  function review(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!/^\d{3}$/.test(value.bankCode)) next.bankCode = t("bankCodeInvalid");
    if (!/^\d{10,15}$/.test(digits)) next.accountNo = t("accountNoInvalid");
    if (!value.accountName.trim()) next.accountName = t("accountNameRequired");
    setErrors(next);
    if (!Object.keys(next).length) setConfirming(true);
  }

  return (
    <form onSubmit={review} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t("bankCode")}
          hint={t("bankCodeHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.bankCode}
        >
          <Input
            placeholder={t("bankCodePlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            maxLength={3}
            value={value.bankCode}
            onChange={(event) => setValue({ ...value, bankCode: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label={t("accountNo")} required requiredLabel={tCommon("state.required")} error={errors.accountNo}>
          <Input
            placeholder={t("accountNoPlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            autoComplete="off"
            value={value.accountNo}
            onChange={(event) => setValue({ ...value, accountNo: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t("accountName")} hint={t("accountNameHint")} error={errors.accountName}>
        <Input
          placeholder={t("accountNamePlaceholder")}
          inputSize="lg"
          value={value.accountName}
          onChange={(event) => setValue({ ...value, accountName: event.target.value })}
        />
      </Field>
      <Field label={t("branchName")}>
        <Input
          placeholder={t("branchNamePlaceholder")}
          inputSize="lg"
          value={value.branchName}
          onChange={(event) => setValue({ ...value, branchName: event.target.value })}
        />
      </Field>
      <Button type="submit" size="xl" iconStart="shield" className="self-start">
        {t("propose")}
      </Button>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", { bank: value.bankCode, last4: digits.slice(-4) })}
        confirmLabel={t("confirm")}
        confirmationPhrase={digits.slice(-4)}
        onConfirm={async () => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/bank-accounts", {
              params: { path: { factoryId } },
              body: {
                bankCode: value.bankCode,
                accountNo: digits,
                accountName: value.accountName.trim(),
                branchName: value.branchName.trim() || null,
              },
            });
            setValue({ ...value, accountNo: "", branchName: "" });
            toast.success(t("proposed"));
            refresh();
          } catch (error) {
            setErrors(fieldErrors(error));
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </form>
  );
}

/* --------------------------------------------------------------------------- agreement */

/** E-acceptance of the version in force (D-011): who, when and a digest are kept by the API. */
export function AcceptAgreement({
  agreementKey,
  name,
  versionNo,
}: {
  agreementKey: string;
  name: string;
  versionNo: number;
}) {
  const t = useTranslations("partnerOnboarding.agreement");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [read, setRead] = useState(false);
  const [open, setOpen] = useState(false);
  if (!can("factory_agreements.accept")) return <p className="text-muted text-sm">{t("ownerOnly")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        label={t("haveRead", { name, version: versionNo })}
        checked={read}
        onCheckedChange={(checked) => setRead(checked === true)}
      />
      <Button size="xl" iconStart="handshake" disabled={!read} onClick={() => setOpen(true)} className="self-start">
        {t("accept")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle", { name })}
        description={t("confirmBody", { name, version: versionNo })}
        confirmLabel={t("accept")}
        onConfirm={async () => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/agreements/{key}/acceptances", {
              params: { path: { factoryId, key: agreementKey } },
            });
            toast.success(t("accepted", { name }));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
