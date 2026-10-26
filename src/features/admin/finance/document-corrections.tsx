"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DOCUMENT_CORRECTION_STATUS, ETAX_STATUS, ETAX_SUBMISSION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis } from "../console/api";
import { ConfirmAction } from "../console/ConfirmAction";
import { FormDialog, Section } from "../console/FormDialog";
import { problemMessage, QueryError } from "../console/QueryError";
import { StatusChip } from "../console/StatusChip";
import type { CustomerDocument } from "./resources";
import { invalidateMoney } from "./slips";

type Correction = Schemas["DocumentCorrectionDto"];
type Reason = Schemas["RequestCorrectionDto"]["reason"];
type Buyer = Schemas["CorrectedBuyerDto"];

const REASONS: readonly Reason[] = ["buyer_name", "buyer_address", "buyer_tax_id", "other"];

/** D-431: what a replaced or replacing document says about the other one. */
export function ReplacementNotice({ doc }: { doc: CustomerDocument }) {
  const t = useTranslations("finance.documents.replace");
  return (
    <>
      {doc.replacedBy ? (
        <Callout tone="warning" title={t("replacedTitle")}>
          {t.rich("replacedBody", {
            number: doc.replacedBy.docNumber,
            link: (chunks) => (
              <Link
                href={`/finance/documents/${doc.replacedBy!.id}`}
                className="text-primary tabular-nums hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </Callout>
      ) : null}
      {doc.replaces ? (
        <Callout tone="info" title={t("replacesTitle")}>
          {t.rich("replacesBody", {
            number: doc.replaces.docNumber,
            reason: doc.replacementReason ? t(`reasons.${doc.replacementReason}`) : "—",
            link: (chunks) => (
              <Link
                href={`/finance/documents/${doc.replaces!.id}`}
                className="text-primary tabular-nums hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
          {doc.replacementNote ? <> · {doc.replacementNote}</> : null}
        </Callout>
      ) : null}
      {doc.correction?.status === "pending" ? (
        <Callout tone="warning" title={t("pendingTitle")}>
          <Link href={`/finance/corrections/${doc.correction.id}`} className="text-primary hover:underline">
            {t("pendingOpen")}
          </Link>
        </Callout>
      ) : null}
    </>
  );
}

/** D-430: the document's e-Tax by Email state and its e-mails (the cancellation too). */
export function ETaxPanel({ doc }: { doc: CustomerDocument }) {
  const t = useTranslations("finance.documents.etax");
  const format = useFormat();
  if (!doc.isTaxInvoice) return null;
  return (
    <Section
      title={t("title")}
      description={t("description")}
      actions={<StatusChip map={ETAX_STATUS} value={doc.eTaxStatus} />}
    >
      {doc.eTax.length === 0 ? (
        <p className="text-muted text-sm">{doc.eTaxStatus === "not_applicable" ? t("off") : t("none")}</p>
      ) : (
        <DataTable
          caption={t("title")}
          density="compact"
          rows={doc.eTax}
          getRowId={(row) => `${row.kind}-${row.subject}`}
          columns={[
            { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
            {
              id: "subject",
              header: t("subject"),
              cell: (row) => <span className="text-xs tabular-nums">{row.subject}</span>,
            },
            { id: "to", header: t("to"), cell: (row) => row.to ?? "—" },
            {
              id: "status",
              header: t("status"),
              cell: (row) => (
                <span className="flex flex-col gap-1">
                  <StatusChip map={ETAX_SUBMISSION_STATUS} value={row.status} />
                  {row.lastError ? (
                    <span className="text-danger text-xs">
                      {t(`errors.${row.lastError}` as "errors.etax.send_failed")}
                    </span>
                  ) : null}
                </span>
              ),
            },
            { id: "sentAt", header: t("sentAt"), cell: (row) => (row.sentAt ? format.dateTime(row.sentAt) : "—") },
          ]}
        />
      )}
    </Section>
  );
}

/** D-430: queue a failed e-Tax e-mail again, optionally to another buyer address. */
export function ResendETaxDialog({ doc, onClose }: { doc: CustomerDocument; onClose: () => void }) {
  const t = useTranslations("finance.documents.etax");
  const queryClient = useQueryClient();
  const [to, setTo] = useState("");
  return (
    <FormDialog
      title={t("resendTitle", { number: doc.docNumber })}
      description={t("resendBody")}
      submitLabel={t("resend")}
      onClose={onClose}
      onSubmit={async () => {
        const { data } = await adminBrowserApis().contract.POST(
          "/v1/admin/customer-documents/{documentId}/actions/resend-etax",
          { params: { path: { documentId: doc.id } }, body: { to: to.trim() || null } },
        );
        queryClient.setQueryData(queryKeys.detail("admin", "customer-document", doc.id), data);
        toast.success(t("resent"));
      }}
    >
      <Field label={t("resendTo")} hint={t("resendToHint")}>
        <Input type="email" value={to} onChange={(event) => setTo(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

function BuyerFields({ buyer, onChange }: { buyer: Buyer; onChange: (next: Buyer) => void }) {
  const t = useTranslations("finance.documents.replace");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("buyerName")} required className="sm:col-span-2">
        <Input
          value={buyer.name}
          maxLength={300}
          onChange={(event) => onChange({ ...buyer, name: event.target.value })}
        />
      </Field>
      <Field label={t("buyerTaxId")} hint={t("buyerTaxIdHint")}>
        <Input
          inputMode="numeric"
          value={buyer.taxId ?? ""}
          maxLength={13}
          onChange={(event) => onChange({ ...buyer, taxId: event.target.value.replace(/\D/g, "") || null })}
        />
      </Field>
      <Field label={t("buyerBranch")} hint={t("buyerBranchHint")}>
        <Input
          inputMode="numeric"
          value={buyer.branchCode ?? ""}
          maxLength={5}
          onChange={(event) => onChange({ ...buyer, branchCode: event.target.value.replace(/\D/g, "") || null })}
        />
      </Field>
      <Field label={t("buyerAddress")} className="sm:col-span-2">
        <Textarea
          rows={2}
          value={buyer.address ?? ""}
          maxLength={600}
          onChange={(event) => onChange({ ...buyer, address: event.target.value || null })}
        />
      </Field>
    </div>
  );
}

/**
 * D-431 (ป.86/2542 ข้อ 25): cancel the document and issue it again with the corrected buyer — the same date
 * and amounts under a new number; the ledger does not move. Confirmed by typing the document number.
 */
export function ReplaceDialog({
  doc,
  onClose,
  onReplaced,
}: {
  doc: CustomerDocument;
  onClose: () => void;
  onReplaced: (next: CustomerDocument) => void;
}) {
  const t = useTranslations("finance.documents.replace");
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<Reason>("buyer_name");
  const [note, setNote] = useState("");
  const [buyer, setBuyer] = useState<Buyer>({
    name: doc.buyer.name,
    taxId: doc.buyer.taxId,
    branchCode: doc.buyer.branchCode,
    address: doc.buyer.address,
  });
  const [confirming, setConfirming] = useState(false);
  return (
    <FormDialog
      size="lg"
      title={t("title", { number: doc.docNumber })}
      description={t("description")}
      submitLabel={t("review")}
      onClose={onClose}
      onSubmit={async () => setConfirming(true)}
    >
      <Field label={t("reason")} required>
        <NativeSelect
          value={reason}
          onValueChange={(value) => setReason(value)}
          options={REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
        />
      </Field>
      <BuyerFields buyer={buyer} onChange={setBuyer} />
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea rows={2} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t("confirmBody", { number: doc.docNumber })}
        confirmLabel={t("confirm")}
        tone="destructive"
        confirmationPhrase={doc.docNumber}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            const { data } = await adminBrowserApis().contract.POST(
              "/v1/admin/customer-documents/{documentId}/actions/replace",
              {
                params: { path: { documentId: doc.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason, note: note.trim() || null, buyer },
              },
            );
            invalidateMoney(queryClient);
            toast.success(t("done", { number: data!.docNumber }));
            onReplaced(data!);
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </FormDialog>
  );
}

// ------------------------------------------------------------------------------------------- the queue

/** D-431: customers' correction requests — pending first — and their decisions. */
export function CorrectionsQueue() {
  const t = useTranslations("finance.corrections");
  const tReasons = useTranslations("finance.documents.replace.reasons");
  const format = useFormat();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const query = useQuery({
    queryKey: queryKeys.list("admin", "document-corrections", { status }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/document-corrections", {
          params: { query: { ...(status === "pending" ? { status: "pending" as const } : {}), perPage: 100 } },
        })
      ).data!,
  });
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} description={t("description")} />
      <SegmentedControl
        label={t("title")}
        value={status}
        onValueChange={(value) => setStatus(value as "pending" | "all")}
        options={[
          { value: "pending", label: t("pending") },
          { value: "all", label: t("all") },
        ]}
      />
      {query.isError ? <QueryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? <EmptyState title={t("empty")} /> : null}
      {query.data && query.data.data.length > 0 ? (
        <DataTable
          caption={t("title")}
          rows={query.data.data}
          getRowId={(row) => row.id}
          columns={[
            {
              id: "document",
              header: t("document"),
              cell: (row) => (
                <Link href={`/finance/corrections/${row.id}`} className="text-primary tabular-nums hover:underline">
                  {row.document.docNumber}
                </Link>
              ),
            },
            { id: "reason", header: t("reason"), cell: (row) => tReasons(row.reason) },
            { id: "by", header: t("requestedBy"), cell: (row) => row.requestedBy.name },
            { id: "at", header: t("requestedAt"), cell: (row) => format.dateTime(row.createdAt) },
            {
              id: "status",
              header: t("status"),
              cell: (row) => <StatusChip map={DOCUMENT_CORRECTION_STATUS} value={row.status} />,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

/** One request: the buyer as printed and as asked, and the decision. */
export function CorrectionDetail({ requestId }: { requestId: string }) {
  const t = useTranslations("finance.corrections");
  const tReplace = useTranslations("finance.documents.replace");
  const format = useFormat();
  const queryClient = useQueryClient();
  const key = queryKeys.detail("admin", "document-correction", requestId);
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/document-corrections/{requestId}", {
          params: { path: { requestId } },
        })
      ).data!,
  });
  const [deciding, setDeciding] = useState<"approve" | "decline" | null>(null);
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const row = query.data;
  if (!row) return null;
  const changed = (field: keyof Correction["buyer"]) => row.buyer[field] !== row.currentBuyer[field];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("detailTitle", { number: row.document.docNumber })}
        meta={<StatusChip map={DOCUMENT_CORRECTION_STATUS} value={row.status} size="md" />}
        description={t("requested", { name: row.requestedBy.name, at: format.dateTime(row.createdAt) })}
        actions={
          row.status === "pending" ? (
            <>
              <Button variant="secondary" onClick={() => setDeciding("decline")}>
                {t("decline")}
              </Button>
              <Button onClick={() => setDeciding("approve")}>{t("approve")}</Button>
            </>
          ) : null
        }
      />
      <Section title={t("reason")}>
        <p>{tReplace(`reasons.${row.reason}`)}</p>
        {row.note ? <p className="text-muted text-sm">{row.note}</p> : null}
      </Section>
      <Section title={t("compare")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-1 text-start font-medium" />
              <th className="py-1 text-start font-medium">{t("printed")}</th>
              <th className="py-1 text-start font-medium">{t("asked")}</th>
            </tr>
          </thead>
          <tbody>
            {(["name", "taxId", "branchCode", "address"] as const).map((field) => (
              <tr key={field} className="border-border border-t">
                <td className="text-muted py-2 pe-3">{tReplace(`fields.${field}`)}</td>
                <td className="py-2 pe-3">{row.currentBuyer[field] ?? "—"}</td>
                <td className={changed(field) ? "py-2 font-semibold" : "py-2"}>{row.buyer[field] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title={t("documents")}>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href={`/finance/documents/${row.document.id}`} className="text-primary tabular-nums hover:underline">
            {row.document.docNumber}
          </Link>
          {row.replacement ? (
            <span>
              → {t("replacement")}{" "}
              <Link
                href={`/finance/documents/${row.replacement.id}`}
                className="text-primary tabular-nums hover:underline"
              >
                {row.replacement.docNumber}
              </Link>
            </span>
          ) : null}
        </p>
        {row.decisionNote ? <p className="text-muted mt-2 text-sm">{row.decisionNote}</p> : null}
      </Section>
      {deciding ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setDeciding(null))}
          title={deciding === "approve" ? t("approveTitle") : t("declineTitle")}
          description={deciding === "approve" ? t("approveBody", { number: row.document.docNumber }) : t("declineBody")}
          confirmLabel={deciding === "approve" ? t("approve") : t("decline")}
          tone={deciding === "approve" ? "primary" : "destructive"}
          reason={deciding === "decline" ? { label: t("declineNote"), required: true, minLength: 3 } : undefined}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const { data } = await adminBrowserApis().contract.POST(
                "/v1/admin/document-corrections/{requestId}/decision",
                {
                  params: { path: { requestId: row.id }, header: { "Idempotency-Key": idempotencyKey } },
                  body: deciding === "approve" ? { approve: true } : { approve: false, note: reason },
                },
              );
              queryClient.setQueryData(key, data);
              invalidateMoney(queryClient);
              void queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "document-corrections", {}) });
              toast.success(deciding === "approve" ? t("approved") : t("declined"));
              setDeciding(null);
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
