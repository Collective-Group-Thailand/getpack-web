"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

type Credit = Schemas["CompanyCreditDto"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Applying for credit (D-121): the limit and term wanted, on the strength of paid orders or a
 * financial statement. Eligibility, the terms on offer and who decides are the API's.
 *
 * CONTRACT-GAP store.company-credit — the published credit says only whether a request is pending,
 * not whether the company is eligible or which terms are on offer, so the form offers both bases
 * and takes the term in days; the API refuses what it does not allow.
 */
export function CreditApplication({ credit }: { credit: Credit | null }) {
  const t = useTranslations("business.credit");
  const format = useFormat();
  const router = useRouter();
  const [limit, setLimit] = useState("");
  const [term, setTerm] = useState("30");
  const [basis, setBasis] = useState<"paid_orders" | "financial_review">("paid_orders");
  const [statement, setStatement] = useState<{ name: string; fileId?: string } | null>(null);
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,9}$/.test(limit)) return setError(t("errors.limit"));
    if (!/^\d{1,3}$/.test(term)) return setError(t("errors.term"));
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
        <Field label={t("term")} hint={t("termHint")}>
          <Input
            inputMode="numeric"
            value={term}
            onChange={(event) => setTerm(event.target.value.replace(/\D/g, ""))}
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
