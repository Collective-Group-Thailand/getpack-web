"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { BANK_ACCOUNT_STATUS, KYC_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { When } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

import { StatusChip, useCan } from "../../console";
import { adminBrowserApis } from "../../console/api";
import { useFactoryPart, useFactoryRefresh } from "../hooks";
import { FormDialog, FormError, Section } from "../parts";
import type { Factory } from "../resources";

type Kyc = Schemas["KycDocumentDto"];
type Bank = Schemas["BankAccountDto"];
type Agreement = Schemas["AgreementStatusDto"];

const DOC_TYPES: Schemas["KycDocType"][] = [
  "company_certificate",
  "vat_registration_pp20",
  "director_id",
  "signatory_id",
  "bank_book",
  "factory_licence",
  "financial_statement",
  "other",
];

function Upload({ onFile, file }: { onFile: (file: File | null) => void; file: File | null }) {
  const t = useTranslations("partners.compliance");
  return (
    <FileDropzone
      accept="application/pdf,image/*"
      maxBytes={20 * 1024 * 1024}
      onFiles={([picked]) => onFile(picked ?? null)}
      labels={{
        prompt: file ? t("chosen", { name: file.name }) : t("drop"),
        browse: t("browse"),
        tooLarge: (name) => t("tooLarge", { name }),
        wrongType: (name) => t("wrongType", { name }),
      }}
    />
  );
}

/**
 * What makes the factory payable and bound: KYC documents with their review (D-011), bank
 * accounts — a change is approved by Finance after a call-back to a number on file (D-033) —
 * and the agreements, accepted in the partner zone or as a signed copy (D-011).
 */
export function Compliance({ factory }: { factory: Factory }) {
  const t = useTranslations("partners.compliance");
  const canManage = useCan("partners.manage");
  const canVerify = useCan("vendor_bank_accounts.verify");
  const refresh = useFactoryRefresh(factory.id);
  const kyc = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/kyc-documents");
  const banks = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/bank-accounts");
  const agreements = useFactoryPart(factory.id, "/v1/admin/factories/{factoryId}/agreements");

  const [open, setOpen] = useState<
    | { kind: "upload" }
    | { kind: "review"; doc: Kyc }
    | { kind: "bank" }
    | { kind: "call"; bank: Bank }
    | { kind: "signed"; agreement: Agreement }
    | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<Schemas["KycDocType"]>("company_certificate");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [outcome, setOutcome] = useState<Schemas["KycReviewOutcome"]>("verified");
  const [note, setNote] = useState("");
  const [bank, setBank] = useState({ bankCode: "", accountNo: "", accountName: factory.legalName, branchName: "" });
  const [call, setCall] = useState<{
    calledNumber: string;
    calledAt: string;
    outcome: Schemas["BankVerificationOutcome"];
    note: string;
  }>({
    calledNumber: "",
    calledAt: "",
    outcome: "confirmed",
    note: "",
  });

  const reset = () => {
    setFile(null);
    setNote("");
    setOpen(null);
  };

  const kycColumns: DataTableColumn<Kyc>[] = [
    { id: "docType", header: t("docType"), cell: (row) => t(`docTypes.${row.docType}`) },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={KYC_STATUS} value={row.status} /> },
    { id: "issuedOn", header: t("issuedOn"), cell: (row) => row.issuedOn ?? "–" },
    { id: "expiresOn", header: t("expiresOn"), cell: (row) => row.expiresOn ?? "–" },
    { id: "note", header: t("note"), cell: (row) => row.note ?? "" },
    ...(canManage
      ? [
          {
            id: "review",
            header: <span className="sr-only">{t("review")}</span>,
            cell: (row: Kyc) =>
              row.status === "pending" ? (
                <Button size="sm" variant="secondary" onClick={() => setOpen({ kind: "review", doc: row })}>
                  {t("reviewDoc", { doc: t(`docTypes.${row.docType}`) })}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  const bankColumns: DataTableColumn<Bank>[] = [
    {
      id: "account",
      header: t("account"),
      cell: (row) => (
        <div>
          <p className="font-mono">{t("accountNo", { bank: row.bankCode, last4: row.accountNoLast4 })}</p>
          <p className="text-muted text-xs">{row.accountName}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusChip map={BANK_ACCOUNT_STATUS} value={row.status} />
          {row.duplicateOfOtherVendor ? (
            <Badge tone="danger" size="sm" icon="warning">
              {t("duplicate")}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "verification",
      header: t("verification"),
      cell: (row) =>
        row.verification ? (
          <span className="text-sm">
            {t(`outcomes.${row.verification.outcome}`)} · {row.verification.calledNumberMasked} ·{" "}
            <When at={row.verification.calledAt} />
          </span>
        ) : canVerify && row.status === "pending_approval" ? (
          <Button size="sm" variant="secondary" iconStart="phone" onClick={() => setOpen({ kind: "call", bank: row })}>
            {t("recordCall")}
          </Button>
        ) : (
          <span className="text-muted text-sm">{t("noCall")}</span>
        ),
    },
    {
      id: "approval",
      header: t("approval"),
      cell: (row) =>
        row.approvalRequestId ? (
          <a href={`/approvals/${row.approvalRequestId}`} className="text-primary text-sm hover:underline">
            {t("openApproval")}
          </a>
        ) : (
          "–"
        ),
    },
  ];

  const agreementColumns: DataTableColumn<Agreement>[] = [
    { id: "name", header: t("agreement"), cell: (row) => <span className="font-medium">{row.name}</span> },
    {
      id: "version",
      header: t("agreementVersion"),
      cell: (row) => (row.versionNo ? t("versionNo", { no: row.versionNo }) : "–"),
    },
    {
      id: "accepted",
      header: t("accepted"),
      cell: (row) =>
        row.accepted ? (
          <span className="text-sm">
            {t(`methods.${row.method ?? "e_acceptance"}`)} · {row.acceptedAt ? <When at={row.acceptedAt} /> : null}
          </span>
        ) : (
          <Badge tone="warning" size="sm">
            {t("notAccepted")}
          </Badge>
        ),
    },
    ...(canManage
      ? [
          {
            id: "signed",
            header: <span className="sr-only">{t("recordSigned")}</span>,
            cell: (row: Agreement) =>
              row.accepted ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="upload"
                  onClick={() => setOpen({ kind: "signed", agreement: row })}
                >
                  {t("recordSignedFor", { name: row.name })}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("kyc")}
        actions={
          canManage ? (
            <Button size="sm" variant="secondary" iconStart="upload" onClick={() => setOpen({ kind: "upload" })}>
              {t("upload")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("kyc")}
          columns={kycColumns}
          rows={kyc.data ?? []}
          getRowId={(row) => row.id}
          loading={kyc.isPending}
          density="compact"
        />
      </Section>

      <Section
        title={t("banks")}
        description={t("banksNote")}
        actions={
          canManage ? (
            <Button size="sm" variant="secondary" iconStart="plus" onClick={() => setOpen({ kind: "bank" })}>
              {t("proposeBank")}
            </Button>
          ) : null
        }
      >
        <DataTable
          caption={t("banks")}
          columns={bankColumns}
          rows={banks.data ?? []}
          getRowId={(row) => row.id}
          loading={banks.isPending}
          density="compact"
        />
      </Section>

      <Section title={t("agreements")}>
        <DataTable
          caption={t("agreements")}
          columns={agreementColumns}
          rows={agreements.data ?? []}
          getRowId={(row) => row.key}
          loading={agreements.isPending}
          density="compact"
        />
      </Section>

      {open?.kind === "upload" ? (
        <FormDialog
          title={t("upload")}
          description={t("uploadBody", { code: factory.code })}
          submitLabel={t("save")}
          onClose={reset}
          onSubmit={async () => {
            if (!file) throw new FormError(t("needFile"));
            const uploaded = await uploadFile("admin", file, "evidence");
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/kyc-documents", {
              params: { path: { factoryId: factory.id } },
              body: { docType, fileId: uploaded.id, issuedOn: issuedOn || null, expiresOn: expiresOn || null },
            });
            toast.success(t("uploaded"));
            refresh();
          }}
        >
          <Field label={t("docType")}>
            <SearchableSelect
              value={docType}
              onValueChange={(value) => setDocType(value as Schemas["KycDocType"])}
              options={DOC_TYPES.map((value) => ({ value, label: t(`docTypes.${value}`) }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("issuedOn")}>
              <Input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
            </Field>
            <Field label={t("expiresOn")}>
              <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
            </Field>
          </div>
          <Upload file={file} onFile={setFile} />
        </FormDialog>
      ) : null}

      {open?.kind === "review" ? (
        <FormDialog
          title={t("reviewTitle", { doc: t(`docTypes.${open.doc.docType}`) })}
          description={t("reviewBody", { code: factory.code })}
          submitLabel={t("saveReview")}
          onClose={reset}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST(
              "/v1/admin/factories/{factoryId}/kyc-documents/{documentId}/actions/review",
              {
                params: { path: { factoryId: factory.id, documentId: open.doc.id } },
                body: { outcome, note: note.trim() || null },
              },
            );
            toast.success(t("reviewed"));
            refresh();
          }}
        >
          <SegmentedControl
            label={t("outcome")}
            value={outcome}
            onValueChange={setOutcome}
            options={[
              { value: "verified", label: t("verify"), icon: "check" },
              { value: "rejected", label: t("reject"), icon: "ban" },
            ]}
          />
          <Field
            label={t("note")}
            hint={outcome === "rejected" ? t("rejectHint") : t("noteHint")}
            required={outcome === "rejected"}
          >
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </FormDialog>
      ) : null}

      {open?.kind === "bank" ? (
        <FormDialog
          title={t("proposeBank")}
          description={t("proposeBody", { code: factory.code })}
          submitLabel={t("propose")}
          onClose={reset}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/bank-accounts", {
              params: { path: { factoryId: factory.id } },
              body: { ...bank, branchName: bank.branchName.trim() || null },
            });
            toast.success(t("proposed"));
            refresh();
          }}
        >
          <Callout tone="info" title={t("dualApproval")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("bankCode")} hint={t("bankCodeHint")} required>
              <Input
                inputMode="numeric"
                value={bank.bankCode}
                onChange={(event) => setBank({ ...bank, bankCode: event.target.value })}
              />
            </Field>
            <Field label={t("accountNoLabel")} required>
              <Input
                inputMode="numeric"
                value={bank.accountNo}
                onChange={(event) => setBank({ ...bank, accountNo: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t("accountName")} required>
            <Input
              value={bank.accountName}
              onChange={(event) => setBank({ ...bank, accountName: event.target.value })}
            />
          </Field>
          <Field label={t("branchName")}>
            <Input value={bank.branchName} onChange={(event) => setBank({ ...bank, branchName: event.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {open?.kind === "call" ? (
        <FormDialog
          title={t("callTitle")}
          description={t("callBody", { code: factory.code, last4: open.bank.accountNoLast4 })}
          submitLabel={t("saveCall")}
          onClose={reset}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/vendor-bank-accounts/{accountId}/verification-calls", {
              params: { path: { accountId: open.bank.id } },
              body: {
                calledNumber: call.calledNumber,
                calledAt: `${call.calledAt}:00+07:00`,
                outcome: call.outcome,
                note: call.note.trim() || null,
              },
            });
            toast.success(t("callSaved"));
            refresh();
          }}
        >
          <Field label={t("calledNumber")} hint={t("calledNumberHint")} required>
            <Input
              inputMode="tel"
              value={call.calledNumber}
              onChange={(event) => setCall({ ...call, calledNumber: event.target.value })}
            />
          </Field>
          <Field label={t("calledAt")} hint={t("bangkokTime")} required>
            <Input
              type="datetime-local"
              value={call.calledAt}
              onChange={(event) => setCall({ ...call, calledAt: event.target.value })}
            />
          </Field>
          <Field label={t("outcome")}>
            <SearchableSelect
              value={call.outcome}
              onValueChange={(value) => setCall({ ...call, outcome: value as Schemas["BankVerificationOutcome"] })}
              options={(["confirmed", "mismatch", "unreachable"] as const).map((value) => ({
                value,
                label: t(`outcomes.${value}`),
              }))}
            />
          </Field>
          <Field label={t("note")}>
            <Textarea rows={2} value={call.note} onChange={(event) => setCall({ ...call, note: event.target.value })} />
          </Field>
        </FormDialog>
      ) : null}

      {open?.kind === "signed" ? (
        <FormDialog
          title={t("recordSignedFor", { name: open.agreement.name })}
          description={t("signedBody", { code: factory.code })}
          submitLabel={t("save")}
          onClose={reset}
          onSubmit={async () => {
            if (!file) throw new FormError(t("needFile"));
            const uploaded = await uploadFile("admin", file, "document");
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/agreements/{key}/signed-copies", {
              params: { path: { factoryId: factory.id, key: open.agreement.key } },
              body: { signedFileId: uploaded.id },
            });
            toast.success(t("signedSaved"));
            refresh();
          }}
        >
          <Upload file={file} onFile={setFile} />
        </FormDialog>
      ) : null}
    </div>
  );
}
