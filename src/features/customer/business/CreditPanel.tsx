"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

type Company = ResponseOf<Requests, "GET /v1/store/me/company">;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Applying for credit (D-121): the limit and term wanted, on the strength of paid orders or a
 * financial statement. Eligibility, the terms on offer and who decides are the API's.
 */
export function CreditApplication({ company }: { company: Company }) {
  const t = useTranslations("business.credit");
  const format = useFormat();
  const router = useRouter();
  const [limit, setLimit] = useState("");
  const [term, setTerm] = useState(
    String(company.credit.allowedTerms.includes(30) ? 30 : (company.credit.allowedTerms[0] ?? 30)),
  );
  const [basis, setBasis] = useState<"paid_orders" | "financial_review">(
    company.credit.eligible ? "paid_orders" : "financial_review",
  );
  const [statement, setStatement] = useState<{ name: string; fileId?: string } | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const application = company.credit.application;

  if (application?.status === "submitted")
    return (
      <Callout tone="info" title={t("pendingTitle")}>
        {t("pending", {
          limit: format.thb(application.requestedLimit),
          days: application.termDays,
          date: format.date(application.submittedAt),
        })}
        {application.note ? <span className="mt-1 block">{application.note}</span> : null}
      </Callout>
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,9}$/.test(limit)) return setError(t("errors.limit"));
    if (basis === "financial_review" && !statement?.fileId) return setError(t("errors.statement"));
    setError(undefined);
    setBusy(true);
    try {
      await browserRequests().call("POST /v1/store/me/company/credit-applications", {
        body: {
          requestedLimit: `${limit}.00`,
          termDays: Number(term),
          basis,
          ...(basis === "financial_review" && statement?.fileId
            ? { financialStatementFileIds: [statement.fileId] }
            : {}),
        },
        idempotencyKey: key.current,
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
      <p className="text-muted text-sm">
        {company.credit.eligible
          ? t("eligible", { count: company.credit.paidOrdersCount })
          : t("notEligible", { count: company.credit.paidOrdersCount, needed: company.credit.paidOrdersNeeded })}
      </p>
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
        <Field label={t("term")}>
          <Select
            value={term}
            onValueChange={setTerm}
            options={company.credit.allowedTerms.map((days) => ({ value: String(days), label: t("days", { days }) }))}
          />
        </Field>
      </div>
      <Field label={t("basis")}>
        <RadioCards
          value={basis}
          onValueChange={setBasis}
          options={[
            {
              value: "paid_orders",
              label: t("bases.paid_orders"),
              description: t("basisHints.paid_orders"),
              disabled: !company.credit.eligible,
            },
            {
              value: "financial_review",
              label: t("bases.financial_review"),
              description: t("basisHints.financial_review"),
            },
          ]}
        />
      </Field>
      {basis === "financial_review" ? (
        <div className="flex flex-col gap-2">
          <FileDropzone
            accept="application/pdf"
            maxBytes={30_000_000}
            onFiles={async (files) => {
              const file = files[0];
              if (!file) return;
              setStatement({ name: file.name });
              try {
                const uploaded = await uploadFile("customer", file, "document");
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
      <Button type="submit" className="self-start" loading={busy}>
        {t("apply")}
      </Button>
    </form>
  );
}

/** A statement's PDF: a signed URL asked for on click, opened on a second, explicit click. */
export function StatementLink({ statementId, period }: { statementId: string; period: string }) {
  const t = useTranslations("business.credit");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url)
    return (
      <Button asChild size="sm" variant="secondary" iconStart="external">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t("open")}
          <span className="sr-only"> {period}</span>
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
          const signed = await browserRequests().call(
            "POST /v1/store/me/company/statements/{statementId}/actions/download",
            {
              path: { statementId },
            },
          );
          setUrl(signed.url);
        } catch (failure) {
          toast.error(isApiError(failure) ? failure.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("download")}
      <span className="sr-only"> {period}</span>
    </Button>
  );
}
