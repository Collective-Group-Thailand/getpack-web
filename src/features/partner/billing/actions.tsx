"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidThaiTaxId } from "@/domain/tax-id";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokToday, useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

/**
 * Confirming a statement makes it the basis of the factory's bill to Packio (D-090) — a
 * financial act, so the BS number is typed to confirm and the amount restated (00-master-plan §8).
 */
export function ConfirmStatement({
  statementId,
  bsNumber,
  gross,
}: {
  statementId: string;
  bsNumber: string;
  gross: string;
}) {
  const t = useTranslations("partnerBilling.confirm");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  if (!can("factory_billing.confirm")) return null;
  return (
    <>
      <Button size="xl" block iconStart="check" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title", { no: bsNumber })}
        description={t("body", { no: bsNumber, amount: gross })}
        confirmLabel={t("confirm")}
        confirmationPhrase={bsNumber}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await browserRequests().call(
              "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/confirm",
              { path: { factoryId, statementId }, body: {}, idempotencyKey },
            );
            toast.success(t("done", { no: bsNumber }));
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

export function DisputeStatement({ statementId, bsNumber }: { statementId: string; bsNumber: string }) {
  const t = useTranslations("partnerBilling.dispute");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  if (!can("factory_billing.confirm")) return null;
  return (
    <>
      <Button size="xl" block variant="secondary" iconStart="flag" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        title={t("title", { no: bsNumber })}
        description={t("body")}
        confirmLabel={t("confirm")}
        reason={{ label: t("note"), required: true, minLength: 3, hint: t("noteHint") }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          try {
            await browserRequests().call(
              "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/dispute",
              { path: { factoryId, statementId }, body: { note: reason }, idempotencyKey },
            );
            toast.success(t("done"));
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

/**
 * The factory's own tax invoice against a confirmed statement (D-090, accounting-design §2):
 * its number and date, the seller's tax id and branch, and the invoice itself — a PDF, or the
 * reference of an e-Tax invoice already sent through the Revenue Department's system.
 */
export function TaxInvoiceForm({
  statementId,
  taxId,
  branchCode,
}: {
  statementId: string;
  taxId: string;
  branchCode: string;
}) {
  const t = useTranslations("partnerBilling.invoice");
  const tCommon = useTranslations("common");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState({
    invoiceNo: "",
    invoiceDate: bangkokToday(),
    sellerTaxId: taxId,
    sellerBranchCode: branchCode,
    eTaxReference: "",
  });
  const [source, setSource] = useState<"pdf_upload" | "e_tax">("pdf_upload");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  if (!can("factory_billing.confirm")) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!value.invoiceNo.trim()) next.invoiceNo = t("noRequired");
    if (!isValidThaiTaxId(value.sellerTaxId)) next.sellerTaxId = t("taxIdInvalid");
    if (!/^\d{5}$/.test(value.sellerBranchCode)) next.sellerBranchCode = t("branchInvalid");
    if (source === "pdf_upload" && !file) next.fileId = t("fileRequired");
    if (source === "e_tax" && !value.eTaxReference.trim()) next.eTaxReference = t("referenceRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const uploaded =
        source === "pdf_upload" && file ? await uploadFile("partner", file, "document", { factoryId }) : null;
      await browserRequests().call(
        "POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/tax-invoices",
        {
          path: { factoryId, statementId },
          body: {
            invoiceNo: value.invoiceNo.trim(),
            invoiceDate: value.invoiceDate,
            sellerTaxId: value.sellerTaxId,
            sellerBranchCode: value.sellerBranchCode,
            source,
            ...(uploaded ? { fileId: uploaded.id } : {}),
            ...(source === "e_tax" ? { eTaxReference: value.eTaxReference.trim() } : {}),
          },
          idempotencyKey: key,
        },
      );
      setKey(newIdempotencyKey());
      toast.success(t("done"));
      refresh();
    } catch (error) {
      if (isApiError(error) && error.errors.length)
        setErrors(Object.fromEntries(error.errors.map((item) => [item.path, item.message])));
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("no")} required requiredLabel={tCommon("state.required")} error={errors.invoiceNo}>
          <Input
            inputSize="lg"
            value={value.invoiceNo}
            onChange={(event) => setValue({ ...value, invoiceNo: event.target.value })}
          />
        </Field>
        <Field label={t("date")} required requiredLabel={tCommon("state.required")}>
          <Input
            type="date"
            inputSize="lg"
            max={bangkokToday()}
            value={value.invoiceDate}
            onChange={(event) => setValue({ ...value, invoiceDate: event.target.value })}
          />
        </Field>
        <Field label={t("taxId")} hint={t("taxIdHint")} error={errors.sellerTaxId}>
          <Input
            inputSize="lg"
            inputMode="numeric"
            maxLength={13}
            value={value.sellerTaxId}
            onChange={(event) => setValue({ ...value, sellerTaxId: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label={t("branch")} error={errors.sellerBranchCode}>
          <Input
            inputSize="lg"
            inputMode="numeric"
            maxLength={5}
            value={value.sellerBranchCode}
            onChange={(event) => setValue({ ...value, sellerBranchCode: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
      </div>
      <SegmentedControl
        label={t("source")}
        size="xl"
        value={source}
        onValueChange={setSource}
        options={[
          { value: "pdf_upload", label: t("pdf"), icon: "document" },
          { value: "e_tax", label: t("eTax"), icon: "send" },
        ]}
      />
      {source === "pdf_upload" ? (
        <Field label={t("file")} error={errors.fileId}>
          <FileDropzone
            accept="application/pdf"
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
      ) : (
        <Field label={t("reference")} hint={t("referenceHint")} error={errors.eTaxReference}>
          <Input
            inputSize="lg"
            value={value.eTaxReference}
            onChange={(event) => setValue({ ...value, eTaxReference: event.target.value })}
          />
        </Field>
      )}
      {file && source === "pdf_upload" ? <p className="text-sm">{t("chosen", { name: file.name })}</p> : null}
      <Button type="submit" size="xl" iconStart="upload" loading={busy} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
