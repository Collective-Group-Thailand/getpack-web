"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidThaiTaxId } from "@/domain/tax-id";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokToday, useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

/**
 * Confirming a statement makes it the basis of the factory's bill to getpack (D-090) — a
 * financial act the API marks irreversible, so the BS number is typed to confirm and the gross
 * amount restated (00-master-plan §8). One `Idempotency-Key` per intent.
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
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
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
            await browserApi().POST("/v1/partner/billing-statements/{statementId}/actions/confirm", {
              params: { path: { statementId }, header: { "Idempotency-Key": idempotencyKey } },
            });
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

/**
 * Disputing says what is wrong (D-090): a note, and — when the factory can name them — the lines
 * (`lineNos`, U-B0.3). Finance answers with a new version.
 */
export function DisputeStatement({
  statementId,
  bsNumber,
  lines,
}: {
  statementId: string;
  bsNumber: string;
  lines: { lineNo: number; label: string }[];
}) {
  const t = useTranslations("partnerBilling.dispute");
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <>
      <Button
        size="xl"
        block
        variant="secondary"
        iconStart="flag"
        onClick={() => {
          setPicked([]);
          setOpen(true);
        }}
      >
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        title={t("title", { no: bsNumber })}
        description={t("body")}
        confirmLabel={t("confirm")}
        reason={{
          label: t("note"),
          required: true,
          minLength: 3,
          hint: t("noteHint"),
          placeholder: t("notePlaceholder"),
        }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          try {
            await browserApi().POST("/v1/partner/billing-statements/{statementId}/actions/dispute", {
              params: { path: { statementId }, header: { "Idempotency-Key": idempotencyKey } },
              body: { note: reason, ...(picked.length ? { lineNos: [...picked].sort((a, b) => a - b) } : {}) },
            });
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      >
        {lines.length ? (
          <fieldset className="mt-4 flex max-h-56 flex-col gap-2 overflow-y-auto">
            <legend className="mb-1 font-medium">{t("lines")}</legend>
            {lines.map((line) => (
              <Checkbox
                key={line.lineNo}
                label={line.label}
                checked={picked.includes(line.lineNo)}
                onCheckedChange={(checked) =>
                  setPicked(checked ? [...picked, line.lineNo] : picked.filter((no) => no !== line.lineNo))
                }
              />
            ))}
          </fieldset>
        ) : null}
      </ConfirmAction>
    </>
  );
}

type Source = Schemas["TaxInvoiceCaptureSource"];
/** The format `CaptureTaxInvoiceDto` takes for an amount: a decimal string, two places. */
const AMOUNT = /^\d{1,12}\.\d{2}$/;

/**
 * The factory's own tax invoice against a statement (D-090, accounting-design §2): its number and
 * date, the seller's tax id and branch, the net and VAT **as printed on the factory's invoice** —
 * keyed by the factory and checked by Finance against the statement, never worked out here — and the
 * file: a PDF, or the e-Tax Invoice document, whose reference is the invoice number.
 */
export function TaxInvoiceForm({
  statementId,
  taxId,
  branchCode,
  expected,
}: {
  statementId: string;
  taxId: string;
  branchCode: string;
  /** The statement's own before-VAT and VAT, filled in to start from — the invoice normally matches them. */
  expected?: { net: string; vat: string };
}) {
  const t = useTranslations("partnerBilling.invoice");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [value, setValue] = useState({
    invoiceNo: "",
    invoiceDate: bangkokToday(),
    sellerTaxId: taxId,
    sellerBranchCode: branchCode,
    netAmount: expected?.net ?? "",
    vatAmount: expected?.vat ?? "",
  });
  const [source, setSource] = useState<Source>("pdf_upload");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!value.invoiceNo.trim()) next.vendorInvoiceNo = t("noRequired");
    if (!isValidThaiTaxId(value.sellerTaxId)) next.sellerTaxId = t("taxIdInvalid");
    if (!/^\d{5}$/.test(value.sellerBranchCode)) next.sellerBranchCode = t("branchInvalid");
    if (!AMOUNT.test(value.netAmount.trim())) next.netAmount = t("amountFormat");
    if (!AMOUNT.test(value.vatAmount.trim())) next.vatAmount = t("amountFormat");
    if (source === "pdf_upload" && !file) next.fileId = t("fileRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const uploaded = file ? await uploadFile("partner", file, "document", { factoryId }) : null;
      await browserApi().POST("/v1/partner/billing-statements/{statementId}/tax-invoices", {
        params: { path: { statementId }, header: { "Idempotency-Key": key } },
        body: {
          vendorInvoiceNo: value.invoiceNo.trim(),
          invoiceDate: value.invoiceDate,
          sellerTaxId: value.sellerTaxId,
          sellerBranchCode: value.sellerBranchCode,
          netAmount: value.netAmount.trim(),
          vatAmount: value.vatAmount.trim(),
          source,
          ...(uploaded ? { fileId: uploaded.id } : {}),
        },
      });
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
        <Field
          label={t("no")}
          hint={source === "e_tax" ? t("eTaxNoHint") : undefined}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.vendorInvoiceNo}
        >
          <Input
            placeholder={t("noPlaceholder")}
            inputSize="lg"
            maxLength={64}
            value={value.invoiceNo}
            onChange={(event) => setValue({ ...value, invoiceNo: event.target.value })}
          />
        </Field>
        <Field
          label={t("date")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.invoiceDate}
          // The date box follows the browser (ค.ศ.); the พ.ศ. date under it is the one on the invoice.
          hint={value.invoiceDate ? format.date(value.invoiceDate) : undefined}
        >
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
            placeholder={t("taxIdPlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            maxLength={13}
            value={value.sellerTaxId}
            onChange={(event) => setValue({ ...value, sellerTaxId: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label={t("branch")} error={errors.sellerBranchCode}>
          <Input
            placeholder={t("branchPlaceholder")}
            inputSize="lg"
            inputMode="numeric"
            maxLength={5}
            value={value.sellerBranchCode}
            onChange={(event) => setValue({ ...value, sellerBranchCode: event.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field
          label={t("netAmount")}
          hint={t("amountHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.netAmount}
        >
          <Input
            inputSize="lg"
            inputMode="decimal"
            placeholder={t("amountPlaceholder")}
            value={value.netAmount}
            onChange={(event) => setValue({ ...value, netAmount: event.target.value })}
          />
        </Field>
        <Field
          label={t("vatAmount")}
          hint={t("amountHint")}
          required
          requiredLabel={tCommon("state.required")}
          error={errors.vatAmount}
        >
          <Input
            inputSize="lg"
            inputMode="decimal"
            placeholder={t("amountPlaceholder")}
            value={value.vatAmount}
            onChange={(event) => setValue({ ...value, vatAmount: event.target.value })}
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
      <Field label={source === "e_tax" ? t("eTaxFile") : t("file")} error={errors.fileId}>
        <FileDropzone
          accept={source === "e_tax" ? "application/pdf,application/xml,text/xml" : "application/pdf"}
          maxBytes={20 * 1024 * 1024}
          onFiles={(files) => setFile(files[0] ?? null)}
          labels={{
            prompt: t("drop"),
            browse: t("browse"),
            hint: source === "e_tax" ? t("eTaxRules") : t("rules"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
      </Field>
      {file ? <p className="text-sm">{t("chosen", { name: file.name })}</p> : null}
      <Button type="submit" size="xl" iconStart="upload" loading={busy} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
