"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

type Credit = Schemas["CompanyCreditDto"];
type Basis = Schemas["CreditEligibilityBasis"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Applying for credit (D-121, `store.companyCredit.apply`): the limit wanted and one of the terms
 * on offer, on the strength of the paid orders once the company is eligible, or of a financial
 * statement it adds as a KYC document (Finance reviews it). Eligibility, the terms on offer and
 * who decides are the API's.
 */
export function CreditApplication({ companyId, credit }: { companyId: string; credit: Credit | null }) {
  const t = useTranslations("business.credit");
  const format = useFormat();
  const router = useRouter();
  const eligibility = credit?.eligibility ?? null;
  const terms = eligibility?.allowedTermDays ?? [];
  const [limit, setLimit] = useState("");
  const [term, setTerm] = useState(String(eligibility?.defaultTermDays ?? terms[0] ?? 30));
  const [basis, setBasis] = useState<Basis>(
    eligibility?.reason === "financial_statement" || !eligibility?.eligible ? "financial_statement" : "paid_orders",
  );
  const [statement, setStatement] = useState<{ name: string; fileId?: string } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const pending = credit?.pendingRequest;

  if (pending)
    return (
      <Callout tone="info" title={t("pendingTitle")}>
        {t("pending", {
          limit: format.thb(pending.limitAmount),
          days: pending.termDays,
          date: format.date(pending.requestedAt),
        })}
      </Callout>
    );

  const statementOnFile = eligibility?.financialStatementOnFile ?? false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,9}$/.test(limit)) return setError(t("errors.limit"));
    if (basis === "financial_statement" && !statementOnFile && !statement?.fileId)
      return setError(t("errors.statement"));
    setError(undefined);
    setBusy(true);
    try {
      const api = browserApi();
      // A financial statement is a KYC document of the company (D-120); Finance reviews it.
      if (basis === "financial_statement" && statement?.fileId)
        await api.POST("/v1/store/companies/{companyId}/kyc-documents", {
          params: { path: { companyId } },
          body: { docType: "financial_statement", fileId: statement.fileId },
        });
      await api.POST("/v1/store/companies/{companyId}/credit-applications", {
        params: { path: { companyId }, header: { "Idempotency-Key": key.current } },
        body: {
          limitAmount: limit,
          ...(terms.length > 0 ? { termDays: Number(term) } : {}),
          basis,
          note: note.trim(),
        },
      });
      toast.success(t("sent"));
      router.refresh();
    } catch (failure) {
      key.current = newKey();
      setError(isApiError(failure) ? failure.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-xl flex-col gap-4">
      {eligibility ? (
        <p className="text-muted text-sm">
          {eligibility.eligible
            ? t("eligible", { count: format.number(eligibility.paidOrdersCount) })
            : t("notEligible", {
                count: format.number(eligibility.paidOrdersCount),
                needed: format.number(eligibility.paidOrdersNeeded),
              })}
        </p>
      ) : null}
      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("limit")} hint={t("limitHint")}>
          <Input
            inputMode="numeric"
            value={limit}
            onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        {terms.length > 0 ? (
          <Field label={t("term")}>
            <Select
              value={term}
              onValueChange={setTerm}
              options={terms.map((days) => ({ value: String(days), label: t("days", { days }) }))}
            />
          </Field>
        ) : null}
      </div>
      <Field label={t("basis")}>
        <RadioCards
          value={basis}
          onValueChange={(value) => setBasis(value as Basis)}
          options={[
            {
              value: "paid_orders",
              label: t("bases.paid_orders"),
              description: t("basisHints.paid_orders", { needed: eligibility?.paidOrdersNeeded ?? 0 }),
              disabled: eligibility ? !eligibility.eligible || eligibility.reason !== "paid_orders" : false,
            },
            {
              value: "financial_statement",
              label: t("bases.financial_statement"),
              description: statementOnFile ? t("statementOnFile") : t("basisHints.financial_statement"),
            },
          ]}
        />
      </Field>
      {basis === "financial_statement" && !statementOnFile ? (
        <div className="flex flex-col gap-2">
          <FileDropzone
            accept="application/pdf"
            maxBytes={30_000_000}
            onFiles={async (files) => {
              const file = files[0];
              if (!file) return;
              setStatement({ name: file.name });
              try {
                const uploaded = await uploadFile("customer", file, "evidence", { companyId });
                setStatement({ name: file.name, fileId: uploaded.id });
              } catch {
                setStatement(null);
                toast.error(t("uploadFailed"));
              }
            }}
            labels={{
              prompt: t("statementDrop"),
              browse: t("browse"),
              hint: t("statementHint"),
              tooLarge: (name) => t("tooLarge", { name }),
              wrongType: (name) => t("wrongType", { name }),
            }}
          />
          {statement ? (
            <p className="text-sm" aria-live="polite">
              {statement.fileId ? t("uploaded", { name: statement.name }) : t("uploading", { name: statement.name })}
            </p>
          ) : null}
        </div>
      ) : null}
      <Field label={t("note")}>
        <Textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" className="self-start" loading={busy}>
        {t("apply")}
      </Button>
    </form>
  );
}

/**
 * A month's statement PDF (`store.documents.companyStatementPdf`): a signed URL asked for on click,
 * opened on a second, explicit click. The API answers `409` until the PDF is rendered.
 */
export function StatementLink({ companyId, month }: { companyId: string; month: string }) {
  const t = useTranslations("business.credit");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url)
    return (
      <Button asChild size="sm" variant="secondary" iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t("open")}
          <span className="sr-only"> {month}</span>
        </a>
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/companies/{companyId}/statements/{month}/pdf", {
            params: { path: { companyId, month } },
          });
          setUrl(data!.url);
        } catch (failure) {
          toast.error(isApiError(failure) ? failure.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("download")}
      <span className="sr-only"> {month}</span>
    </Button>
  );
}
